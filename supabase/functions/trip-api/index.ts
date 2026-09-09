import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.114.0";

const PROD_ORIGIN = "https://petter287.github.io";
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const ROLE_CODES = new Set(["admin", "editor", "viewer"]);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
const REGION_RE = /^[A-Za-z0-9-]{1,12}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STORAGE_BUCKET = "trip-backgrounds";
const STORAGE_REF_PREFIX = `storage://${STORAGE_BUCKET}/`;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function allowedOrigin(origin: string | null) {
  if (!origin) return null;
  return origin === PROD_ORIGIN || LOCAL_ORIGIN.test(origin) ? origin : null;
}

function corsHeaders(origin: string | null) {
  const allowed = allowedOrigin(origin);
  return {
    ...(allowed ? { "Access-Control-Allow-Origin": allowed } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders(origin), "Cache-Control": "no-store" },
  });
}

function decodeJwtPayload(token: string) {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function isValidDateOnly(value: string) {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function normalizeTrip(trip: any) {
  if (!trip) return null;
  return {
    id: trip.id,
    slug: trip.slug,
    name: trip.name,
    destination: trip.destination || "",
    countryCode: trip.country_code || null,
    regionCode: trip.region_code || null,
    startsOn: trip.starts_on || null,
    endsOn: trip.ends_on || null,
  };
}

function imageSignatureMatches(bytes: Uint8Array, contentType: string) {
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= sig.length && sig.every((value, index) => bytes[index] === value);
  }
  if (contentType === "image/webp") {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

function parseBackgroundImage(value: unknown) {
  if (!value) return { image: null as null | { bytes: Uint8Array; contentType: string; extension: string }, error: null as string | null };
  if (typeof value !== "object") return { image: null, error: "Imagen inválida." };

  const input = value as Record<string, unknown>;
  const contentType = String(input.contentType || "").trim().toLowerCase();
  const contentBase64 = String(input.contentBase64 || "").trim();
  const extension = IMAGE_TYPES[contentType];
  if (!extension) return { image: null, error: "La imagen debe ser JPG, PNG o WebP." };
  if (!contentBase64) return { image: null, error: "La imagen está vacía." };
  if (contentBase64.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 8) {
    return { image: null, error: "La imagen no puede superar los 4 MB." };
  }

  try {
    const binary = atob(contentBase64);
    if (binary.length > MAX_IMAGE_BYTES) return { image: null, error: "La imagen no puede superar los 4 MB." };
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    if (!imageSignatureMatches(bytes, contentType)) return { image: null, error: "El contenido del archivo no coincide con un formato de imagen permitido." };
    return { image: { bytes, contentType, extension }, error: null };
  } catch {
    return { image: null, error: "No se pudo decodificar la imagen." };
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && !allowedOrigin(origin)) return json({ error: "Origen no permitido." }, 403, origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405, origin);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "No autenticado." }, 401, origin);

    const url = Deno.env.get("SUPABASE_URL")!;
    const publishable = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")!)["default"];
    const secret = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"];
    const userClient = createClient(url, publishable, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(url, secret, { auth: { persistSession: false } });

    const token = authHeader.slice(7);
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user?.id) return json({ error: "Sesión inválida." }, 401, origin);

    const claims = decodeJwtPayload(token);
    const sessionId = typeof claims?.session_id === "string" ? claims.session_id : "";
    if (!sessionId || claims?.sub !== user.id) return json({ error: "Sesión inválida." }, 401, origin);

    const { data: sessionActive, error: sessionError } = await admin.rpc("is_active_auth_session", {
      p_session_id: sessionId,
      p_user_id: user.id,
    });
    if (sessionError) throw sessionError;
    if (sessionActive !== true) return json({ error: "Sesión revocada." }, 401, origin);

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("user_id,email,display_name,system_access_enabled,is_system_owner,must_change_password")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.system_access_enabled) return json({ error: "Tu acceso al sistema está deshabilitado." }, 403, origin);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "bootstrap").trim().toLowerCase();

    async function membershipFor(tripId: string) {
      const { data, error } = await admin
        .from("trip_members")
        .select("trip_id,user_id,role_id,is_owner,roles(code,name)")
        .eq("trip_id", tripId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    }

    async function allPermissionCodes() {
      const { data, error } = await admin.from("permissions").select("code").order("code");
      if (error) throw error;
      return (data || []).map((permission) => permission.code);
    }

    async function permissionCodesForRole(roleId: number) {
      const { data, error } = await admin
        .from("role_permissions")
        .select("permissions(code)")
        .eq("role_id", roleId);
      if (error) throw error;
      return (data || [])
        .map((grant) => grant.permissions?.code)
        .filter((code): code is string => typeof code === "string");
    }

    async function effectivePermissionsForMembership(membership: { role_id: number } | null) {
      if (profile.is_system_owner) return allPermissionCodes();
      if (!membership) return [];
      return permissionCodesForRole(membership.role_id);
    }

    async function hasPermission(tripId: string, permissionCode: string) {
      if (profile.is_system_owner) return true;
      const membership = await membershipFor(tripId);
      if (!membership) return false;
      const permissions = await permissionCodesForRole(membership.role_id);
      return permissions.includes(permissionCode);
    }

    async function requireTripView(tripId: string) {
      return hasPermission(tripId, "trip.view");
    }

    function readTripInput() {
      return {
        slug: String(body.slug || "").trim().toLowerCase(),
        name: String(body.name || "").trim(),
        destination: String(body.destination || "").trim(),
        countryCode: String(body.countryCode || "").trim().toUpperCase(),
        regionCode: body.regionCode ? String(body.regionCode).trim() : null,
        startsOn: String(body.startsOn || "").trim(),
        endsOn: body.endsOn ? String(body.endsOn).trim() : null,
        defaultTimezone: String(body.defaultTimezone || "").trim(),
      };
    }

    function validateTripInput(input: ReturnType<typeof readTripInput>) {
      if (!input.slug || !input.name || !input.countryCode || !input.startsOn || !input.defaultTimezone) {
        return "No se pudo completar la ubicación y fecha del viaje.";
      }
      if (!SLUG_RE.test(input.slug)) return "El slug solo puede usar minúsculas, números y guiones.";
      if (!COUNTRY_RE.test(input.countryCode)) return "País inválido.";
      if (input.regionCode && !REGION_RE.test(input.regionCode)) return "Provincia o estado inválido.";
      if (input.name.length > 120 || input.destination.length > 160 || input.slug.length > 120 || input.defaultTimezone.length > 100) {
        return "Alguno de los campos supera la longitud permitida.";
      }
      if (!isValidDateOnly(input.startsOn) || (input.endsOn && !isValidDateOnly(input.endsOn))) return "Fecha inválida.";
      if (input.endsOn && input.endsOn < input.startsOn) return "La fecha de fin no puede ser anterior al inicio.";
      return null;
    }

    function rpcValidationError(error: any) {
      const message = String(error?.message || "");
      if (error?.code === "23505") return { message: "Ya existe un viaje con ese slug.", status: 409 };
      if (error?.code === "23514") return { message: "La ubicación seleccionada no es válida.", status: 400 };
      if (message.includes("INVALID_TIMEZONE")) return { message: "No se pudo determinar correctamente la hora local del destino.", status: 400 };
      if (message.includes("TRIP_NOT_FOUND")) return { message: "Viaje inexistente.", status: 404 };
      return null;
    }

    async function uploadBackground(tripId: string, image: { bytes: Uint8Array; contentType: string; extension: string }) {
      const path = `${tripId}/${crypto.randomUUID()}.${image.extension}`;
      const { error } = await admin.storage.from(STORAGE_BUCKET).upload(path, image.bytes, {
        contentType: image.contentType,
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) throw error;
      return { path, reference: `${STORAGE_REF_PREFIX}${path}` };
    }

    function ownedBackgroundPath(value: string | null | undefined) {
      if (!value) return null;
      if (value.startsWith(STORAGE_REF_PREFIX)) return value.slice(STORAGE_REF_PREFIX.length);

      const legacyPrefix = `${url}/storage/v1/object/public/${STORAGE_BUCKET}/`;
      if (!value.startsWith(legacyPrefix)) return null;
      try {
        return decodeURIComponent(value.slice(legacyPrefix.length).split("?")[0]);
      } catch {
        return null;
      }
    }

    async function backgroundUrlForClient(value: string | null | undefined) {
      if (!value) return null;
      const path = ownedBackgroundPath(value);
      if (!path) return value;
      const { data, error } = await admin.storage.from(STORAGE_BUCKET).createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    }

    async function removeStoragePath(path: string | null) {
      if (!path) return;
      const { error } = await admin.storage.from(STORAGE_BUCKET).remove([path]);
      if (error) console.warn("trip-api storage cleanup", error);
    }

    async function removeTripBackgroundObjects(tripId: string) {
      const { data, error } = await admin.storage.from(STORAGE_BUCKET).list(tripId, { limit: 100 });
      if (error) {
        console.warn("trip-api storage list cleanup", error);
        return;
      }
      const paths = (data || []).filter((item) => item.name).map((item) => `${tripId}/${item.name}`);
      if (!paths.length) return;
      const { error: removeError } = await admin.storage.from(STORAGE_BUCKET).remove(paths);
      if (removeError) console.warn("trip-api storage remove cleanup", removeError);
    }

    async function resolveTripReference() {
      const slug = String(body.slug || "").trim().toLowerCase();
      const legacyTripId = String(body.tripId || "").trim();
      if (!slug && !legacyTripId) return { trip: null, missingReference: true };

      let query = admin.from("trips").select("id,slug");
      query = slug ? query.eq("slug", slug) : query.eq("id", legacyTripId);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return { trip: data, missingReference: false };
    }

    if (action === "bootstrap") {
      const { data: memberships, error: membershipsError } = await admin
        .from("trip_members")
        .select("trip_id,role_id,is_owner,created_at,roles(code,name),trips(id,slug,name,destination,country_code,region_code,starts_on,ends_on)")
        .eq("user_id", user.id)
        .order("created_at");
      if (membershipsError) throw membershipsError;

      const membershipRows = memberships || [];
      const membershipByTrip = new Map(membershipRows.map((membership) => [membership.trip_id, membership]));
      const permissionEntries = await Promise.all(membershipRows.map(async (membership) => [
        membership.trip_id,
        await effectivePermissionsForMembership(membership),
      ] as const));
      const permissionsByTrip = new Map(permissionEntries);

      let accessibleTripRows = membershipRows.map((membership) => membership.trips).filter(Boolean);
      let systemOwnerPermissions: string[] = [];

      if (profile.is_system_owner) {
        const { data: allTrips, error: tripsError } = await admin
          .from("trips")
          .select("id,slug,name,destination,country_code,region_code,starts_on,ends_on")
          .order("starts_on", { ascending: true, nullsFirst: false })
          .order("name");
        if (tripsError) throw tripsError;
        accessibleTripRows = allTrips || [];
        systemOwnerPermissions = await allPermissionCodes();
      }

      const normalizedMemberships = membershipRows.map((membership) => ({
        tripId: membership.trip_id,
        roleId: membership.role_id,
        isOwner: membership.is_owner,
        role: membership.roles,
        trip: normalizeTrip(membership.trips),
        permissions: permissionsByTrip.get(membership.trip_id) || [],
      }));

      const accessibleTrips = accessibleTripRows.map((trip) => {
        const membership = membershipByTrip.get(trip.id) || null;
        return {
          trip: normalizeTrip(trip),
          membership: membership ? {
            tripId: membership.trip_id,
            roleId: membership.role_id,
            isOwner: membership.is_owner,
            role: membership.roles,
          } : null,
          permissions: profile.is_system_owner ? systemOwnerPermissions : (permissionsByTrip.get(trip.id) || []),
        };
      });

      return json({
        profile: {
          id: profile.user_id,
          email: profile.email,
          displayName: profile.display_name,
          enabled: profile.system_access_enabled,
          systemOwner: profile.is_system_owner,
          mustChangePassword: profile.must_change_password,
        },
        memberships: normalizedMemberships,
        accessibleTrips,
      }, 200, origin);
    }

    if (action === "trip-manage-detail") {
      if (!profile.is_system_owner) return json({ error: "Solo el propietario del sistema puede editar viajes." }, 403, origin);
      const slug = String(body.slug || "").trim().toLowerCase();
      if (!slug) return json({ error: "Falta identificar el viaje." }, 400, origin);

      const { data: trip, error: tripError } = await admin
        .from("trips")
        .select("id,slug,name,destination,country_code,region_code,starts_on,ends_on")
        .eq("slug", slug)
        .maybeSingle();
      if (tripError) throw tripError;
      if (!trip) return json({ error: "Viaje inexistente." }, 404, origin);

      const { data: settings, error: settingsError } = await admin
        .from("trip_settings")
        .select("default_timezone,background_url")
        .eq("trip_id", trip.id)
        .maybeSingle();
      if (settingsError) throw settingsError;
      if (!settings) return json({ error: "El viaje no tiene configuración." }, 404, origin);

      return json({
        trip: normalizeTrip(trip),
        settings: {
          defaultTimezone: settings.default_timezone,
          backgroundUrl: await backgroundUrlForClient(settings.background_url),
        },
      }, 200, origin);
    }

    if (action === "trip-create") {
      if (!profile.is_system_owner) return json({ error: "Solo el propietario del sistema puede crear viajes." }, 403, origin);
      const input = readTripInput();
      const validation = validateTripInput(input);
      if (validation) return json({ error: validation }, 400, origin);

      const parsedImage = parseBackgroundImage(body.backgroundImage);
      if (parsedImage.error) return json({ error: parsedImage.error }, 400, origin);

      const tripId = crypto.randomUUID();
      let uploaded: { path: string; reference: string } | null = null;
      try {
        if (parsedImage.image) uploaded = await uploadBackground(tripId, parsedImage.image);

        const { error: createError } = await admin.rpc("create_trip_with_defaults_v4", {
          p_trip_id: tripId,
          p_created_by: user.id,
          p_slug: input.slug,
          p_name: input.name,
          p_destination: input.destination,
          p_country_code: input.countryCode,
          p_region_code: input.regionCode,
          p_starts_on: input.startsOn,
          p_ends_on: input.endsOn,
          p_default_timezone: input.defaultTimezone,
          p_background_url: uploaded?.reference || null,
        });
        if (createError) {
          await removeStoragePath(uploaded?.path || null);
          const friendly = rpcValidationError(createError);
          if (friendly) return json({ error: friendly.message }, friendly.status, origin);
          throw createError;
        }
      } catch (error) {
        if (uploaded) await removeStoragePath(uploaded.path);
        throw error;
      }

      const { data: trip, error: tripError } = await admin
        .from("trips")
        .select("id,slug,name,destination,country_code,region_code,starts_on,ends_on")
        .eq("id", tripId)
        .single();
      if (tripError) throw tripError;
      return json({ ok: true, trip: normalizeTrip(trip) }, 201, origin);
    }

    if (action === "trip-update") {
      if (!profile.is_system_owner) return json({ error: "Solo el propietario del sistema puede editar viajes." }, 403, origin);
      const currentSlug = String(body.currentSlug || "").trim().toLowerCase();
      if (!currentSlug) return json({ error: "Falta identificar el viaje a editar." }, 400, origin);
      const input = readTripInput();
      const validation = validateTripInput(input);
      if (validation) return json({ error: validation }, 400, origin);

      const parsedImage = parseBackgroundImage(body.backgroundImage);
      if (parsedImage.error) return json({ error: parsedImage.error }, 400, origin);
      const removeBackground = body.removeBackground === true;

      const { data: current, error: currentError } = await admin
        .from("trips")
        .select("id")
        .eq("slug", currentSlug)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current) return json({ error: "Viaje inexistente." }, 404, origin);

      const { data: currentSettings, error: settingsError } = await admin
        .from("trip_settings")
        .select("background_url")
        .eq("trip_id", current.id)
        .maybeSingle();
      if (settingsError) throw settingsError;
      if (!currentSettings) return json({ error: "El viaje no tiene configuración." }, 404, origin);

      let uploaded: { path: string; reference: string } | null = null;
      try {
        if (parsedImage.image) uploaded = await uploadBackground(current.id, parsedImage.image);
        const nextBackgroundRef = uploaded?.reference || (removeBackground ? null : currentSettings.background_url);

        const { error: updateError } = await admin.rpc("update_trip_basics_v3", {
          p_trip_id: current.id,
          p_slug: input.slug,
          p_name: input.name,
          p_destination: input.destination,
          p_country_code: input.countryCode,
          p_region_code: input.regionCode,
          p_starts_on: input.startsOn,
          p_ends_on: input.endsOn,
          p_default_timezone: input.defaultTimezone,
          p_background_url: nextBackgroundRef,
        });
        if (updateError) {
          await removeStoragePath(uploaded?.path || null);
          const friendly = rpcValidationError(updateError);
          if (friendly) return json({ error: friendly.message }, friendly.status, origin);
          throw updateError;
        }

        if (currentSettings.background_url !== nextBackgroundRef) {
          await removeStoragePath(ownedBackgroundPath(currentSettings.background_url));
        }
      } catch (error) {
        if (uploaded) await removeStoragePath(uploaded.path);
        throw error;
      }

      const { data: trip, error: tripError } = await admin
        .from("trips")
        .select("id,slug,name,destination,country_code,region_code,starts_on,ends_on")
        .eq("id", current.id)
        .single();
      if (tripError) throw tripError;
      return json({ ok: true, trip: normalizeTrip(trip) }, 200, origin);
    }

    if (action === "trip-delete") {
      if (!profile.is_system_owner) return json({ error: "Solo el propietario del sistema puede eliminar viajes." }, 403, origin);
      const slug = String(body.slug || "").trim().toLowerCase();
      if (!slug) return json({ error: "Falta identificar el viaje." }, 400, origin);

      const { data: trip, error: tripError } = await admin.from("trips").select("id,name").eq("slug", slug).maybeSingle();
      if (tripError) throw tripError;
      if (!trip) return json({ error: "Viaje inexistente." }, 404, origin);

      const { error: deleteError } = await admin.from("trips").delete().eq("id", trip.id);
      if (deleteError) throw deleteError;
      await removeTripBackgroundObjects(trip.id);
      return json({ ok: true }, 200, origin);
    }

    const { trip, missingReference } = await resolveTripReference();
    if (missingReference) return json({ error: "Falta identificar el viaje." }, 400, origin);
    if (!trip) return json({ error: "Viaje inexistente." }, 404, origin);
    const tripId = trip.id;

    if (action === "trip-settings-update") {
      if (!(await hasPermission(tripId, "trip.edit"))) return json({ error: "No tenés permiso para configurar este viaje." }, 403, origin);
      if (profile.must_change_password) return json({ error: "Cambiá tu contraseña antes de continuar." }, 403, origin);

      const fields = { eyebrow: 160, title: 200, subtitle: 500, photoCredit: 300 };
      const values: Record<string, string> = {};
      for (const [field, limit] of Object.entries(fields)) {
        if (typeof body[field] !== "string" || body[field].trim().length > limit) {
          return json({ error: "Revisá los textos: alguno falta o supera la longitud permitida." }, 400, origin);
        }
        values[field] = body[field].trim();
      }
      if (!values.title) return json({ error: "Ingresá un título." }, 400, origin);
      if (body.removeBackground !== undefined && typeof body.removeBackground !== "boolean") {
        return json({ error: "La opción de quitar imagen no es válida." }, 400, origin);
      }
      const parsedImage = parseBackgroundImage(body.backgroundImage);
      if (parsedImage.error) return json({ error: parsedImage.error }, 400, origin);
      if (parsedImage.image && body.removeBackground) return json({ error: "Elegí reemplazar o quitar la imagen." }, 400, origin);

      const { data: current, error: readError } = await admin.from("trip_settings")
        .select("background_url,updated_at").eq("trip_id", tripId).maybeSingle();
      if (readError) throw readError;
      if (!current) return json({ error: "El viaje no tiene configuración." }, 404, origin);
      if (typeof body.updatedAt !== "string" || body.updatedAt !== current.updated_at) {
        return json({ error: "La configuración cambió. Volvé a abrirla antes de guardar." }, 409, origin);
      }

      let uploaded: { path: string; reference: string } | null = null;
      let saved = false;
      try {
        if (parsedImage.image) uploaded = await uploadBackground(tripId, parsedImage.image);
        const patch: Record<string, unknown> = {
          eyebrow: values.eyebrow, title: values.title, subtitle: values.subtitle,
          photo_credit: values.photoCredit || null,
          updated_at: new Date().toISOString(),
        };
        if (uploaded || body.removeBackground) patch.background_url = uploaded?.reference || null;
        const { data: updated, error: updateError } = await admin.from("trip_settings")
          .update(patch).eq("trip_id", tripId).eq("updated_at", current.updated_at)
          .select("trip_id").maybeSingle();
        if (updateError) throw updateError;
        if (!updated) return json({ error: "La configuración cambió. Volvé a abrirla antes de guardar." }, 409, origin);
        saved = true;
        if ('background_url' in patch && current.background_url !== patch.background_url) {
          await removeStoragePath(ownedBackgroundPath(current.background_url));
        }
        return json({ ok: true, trip: { id: trip.id, slug: trip.slug } }, 200, origin);
      } finally {
        if (uploaded && !saved) await removeStoragePath(uploaded.path);
      }
    }

    if (action === "trip-detail") {
      if (!(await requireTripView(tripId))) return json({ error: "No tenés acceso a este viaje." }, 403, origin);
      const membership = await membershipFor(tripId);
      const permissions = await effectivePermissionsForMembership(membership);
      const { data: settings, error } = await admin
        .from("trip_settings")
        .select("trip_id,eyebrow,title,subtitle,start_at,default_arrival_at,spain_arrival_at,canary_arrival_at,background_url,photo_credit,default_timezone,spain_timezone,canary_timezone,updated_at")
        .eq("trip_id", tripId)
        .maybeSingle();
      if (error) throw error;
      if (!settings) return json({ error: "El viaje no tiene configuración." }, 404, origin);
      return json({
        trip: { id: trip.id, slug: trip.slug },
        permissions,
        settings: {
          tripId: settings.trip_id,
          eyebrow: settings.eyebrow,
          title: settings.title,
          subtitle: settings.subtitle,
          startAt: settings.start_at,
          defaultArrivalAt: settings.default_arrival_at,
          spainArrivalAt: settings.spain_arrival_at,
          canaryArrivalAt: settings.canary_arrival_at,
          backgroundUrl: await backgroundUrlForClient(settings.background_url),
          photoCredit: settings.photo_credit,
          updatedAt: settings.updated_at,
          defaultTimezone: settings.default_timezone,
          spainTimezone: settings.spain_timezone,
          canaryTimezone: settings.canary_timezone,
        },
      }, 200, origin);
    }

    if (action === "trip-admin") {
      if (!(await hasPermission(tripId, "members.manage"))) return json({ error: "No tenés permiso para administrar este viaje." }, 403, origin);
      const [rolesResult, membersResult, profilesResult] = await Promise.all([
        admin.from("roles").select("id,code,name").order("id"),
        admin.from("trip_members").select("user_id,role_id,is_owner,created_at,roles(code,name),profiles(email,display_name,system_access_enabled)").eq("trip_id", tripId).order("created_at"),
        admin.from("profiles").select("user_id,email,display_name").eq("system_access_enabled", true).order("display_name").order("email"),
      ]);
      if (rolesResult.error) throw rolesResult.error;
      if (membersResult.error) throw membersResult.error;
      if (profilesResult.error) throw profilesResult.error;
      const members = membersResult.data || [];
      const memberIds = new Set(members.map((member) => member.user_id));
      return json({
        roles: rolesResult.data || [],
        members: members.map((member) => ({
          userId: member.user_id,
          roleId: member.role_id,
          isOwner: member.is_owner,
          role: member.roles,
          profile: {
            email: member.profiles?.email || "",
            displayName: member.profiles?.display_name || null,
            enabled: member.profiles?.system_access_enabled !== false,
          },
        })),
        availableUsers: (profilesResult.data || [])
          .filter((candidate) => !memberIds.has(candidate.user_id))
          .map((candidate) => ({ id: candidate.user_id, email: candidate.email, displayName: candidate.display_name })),
      }, 200, origin);
    }

    if (!(await hasPermission(tripId, "members.manage"))) return json({ error: "No tenés permiso para administrar este viaje." }, 403, origin);

    const targetUserId = String(body.userId || "").trim();
    if (!targetUserId) return json({ error: "Falta identificar al usuario." }, 400, origin);

    if (action === "assign") {
      const roleCode = String(body.role || "viewer").trim().toLowerCase();
      if (!ROLE_CODES.has(roleCode)) return json({ error: "Rol inválido." }, 400, origin);
      const { data: target, error: targetError } = await admin
        .from("profiles")
        .select("user_id,system_access_enabled")
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (targetError) throw targetError;
      if (!target?.system_access_enabled) return json({ error: "El usuario no tiene acceso activo al sistema." }, 409, origin);
      const { data: role, error: roleError } = await admin.from("roles").select("id").eq("code", roleCode).maybeSingle();
      if (roleError) throw roleError;
      if (!role) return json({ error: "Rol inválido." }, 400, origin);
      const { data: existing, error: existingError } = await admin.from("trip_members").select("id").eq("trip_id", tripId).eq("user_id", targetUserId).maybeSingle();
      if (existingError) throw existingError;
      if (existing) return json({ error: "El usuario ya pertenece a este viaje." }, 409, origin);
      const { error } = await admin.from("trip_members").insert({ trip_id: tripId, user_id: targetUserId, role_id: role.id, is_owner: false });
      if (error) throw error;
      return json({ ok: true }, 200, origin);
    }

    const { data: targetMembership, error: targetMembershipError } = await admin
      .from("trip_members")
      .select("id,is_owner")
      .eq("trip_id", tripId)
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (targetMembershipError) throw targetMembershipError;
    if (!targetMembership) return json({ error: "El usuario no pertenece a este viaje." }, 404, origin);
    if (targetMembership.is_owner) return json({ error: "No se puede modificar al propietario del viaje." }, 403, origin);

    if (action === "update-role") {
      const roleCode = String(body.role || "viewer").trim().toLowerCase();
      if (!ROLE_CODES.has(roleCode)) return json({ error: "Rol inválido." }, 400, origin);
      const { data: role, error: roleError } = await admin.from("roles").select("id").eq("code", roleCode).maybeSingle();
      if (roleError) throw roleError;
      if (!role) return json({ error: "Rol inválido." }, 400, origin);
      const { error } = await admin.from("trip_members").update({ role_id: role.id }).eq("id", targetMembership.id);
      if (error) throw error;
      return json({ ok: true }, 200, origin);
    }

    if (action === "remove") {
      const { error } = await admin.from("trip_members").delete().eq("id", targetMembership.id);
      if (error) throw error;
      return json({ ok: true }, 200, origin);
    }

    return json({ error: "Acción inválida." }, 400, origin);
  } catch (error) {
    console.error("trip-api", error);
    return json({ error: "No se pudo completar la operación." }, 500, origin);
  }
});
