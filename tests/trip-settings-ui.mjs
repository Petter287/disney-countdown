import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Uses synthetic sessions and intercepts api.js; never signs in or modifies production.
export async function runBrowserTests(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [url, file, contentType] of [
    ['https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css', 'bootstrap.min.css', 'text/css'],
    ['https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js', 'bootstrap.bundle.min.js', 'text/javascript'],
    ['https://cdn.jsdelivr.net/npm/country-state-city@3.2.1/+esm', 'country-state-city.js', 'text/javascript'],
    ['https://cdn.jsdelivr.net/npm/tz-lookup@6.1.25/+esm', 'tz-lookup.js', 'text/javascript'],
  ]) {
    const body = await readFile(new URL('../tmp/' + file, import.meta.url));
    await page.route(url, route => route.fulfill({body,contentType,headers:{'Access-Control-Allow-Origin':'*'}}));
  }
  await page.route('**/assets/js/api.js', route => route.fulfill({ contentType: 'text/javascript', body: `
    const trip = { id: 'trip-1', slug: 'orlando-2027', name: 'Orlando 2027', countryCode: 'US', regionCode: 'FL', destination: 'Orlando', startsOn: '2027-01-10' };
    let settings = { eyebrow: 'Próxima parada: Orlando', title: 'La aventura está cada vez más cerca', subtitle: 'Cuenta regresiva para nuestro viaje', photoCredit: '', backgroundUrl: null,
      startAt: '2026-01-01T00:00:00Z', defaultArrivalAt: '2027-01-10T05:00:00Z', defaultTimezone: 'America/New_York', updatedAt: '2026-09-08T12:00:00Z' };
    const role = new URLSearchParams(location.search).get('role') || 'editor';
    const permissions = role === 'viewer' ? ['trip.view'] : ['trip.view', 'trip.edit'];
    window.settingsTest = { calls: [], wait: false };
    export const supabase = { auth: { getSession: async () => ({data:{session:{user:{id:'test-user'}}}}) } };
    export const secureSignOut = async () => {};
    export const systemUserApi = async () => ({users:[], trips:[], roles:[]});
    export async function tripApi(action,payload={}) {
      if (action === 'bootstrap') return { profile:{email:'test@example.invalid',systemOwner:role==='owner'}, memberships:[], accessibleTrips:[{trip,membership:null,permissions}] };
      if (action === 'trip-detail') return {trip,settings,permissions};
      if (action === 'trip-settings-update') {
        window.settingsTest.calls.push(payload);
        if (window.settingsTest.wait) await new Promise(resolve => { window.settingsTest.finish = resolve; });
        settings = {...settings,...payload};
        return {trip};
      }
      throw new Error('Unexpected action: '+action);
    }
  ` }));
  await page.goto(baseUrl + '/#/trips/orlando-2027/settings');
  await page.getByRole('heading', { name: 'Configurar apariencia' }).waitFor();
  assert.equal(await page.getByLabel('Título', { exact: true }).inputValue(), 'La aventura está cada vez más cerca');
  await page.getByLabel('Título', { exact: true }).fill('  ');
  await page.getByRole('button', { name: 'Guardar configuración' }).click();
  assert.equal(await page.evaluate(() => window.settingsTest.calls.length), 0);
  await page.getByLabel('Título', { exact: true }).fill('<img src=x onerror=alert(1)>');
  assert.equal(await page.locator('#tripSettingsPreviewTitle').textContent(), '<img src=x onerror=alert(1)>');
  assert.equal(await page.locator('#tripSettingsPreviewTitle img').count(), 0);
  await page.getByLabel('Título', { exact: true }).fill('Nos vamos de viaje');
  await page.getByLabel('Subtítulo', { exact: false }).fill('Todo listo para la aventura');
  await page.getByRole('button', { name: 'Guardar configuración' }).click();
  await page.locator('#tripTitle').waitFor();
  assert.equal(await page.locator('#tripTitle').textContent(), 'Nos vamos de viaje');
  assert.match(await page.locator('#datePill').textContent(), /10/);
  await page.getByRole('button', { name: 'Configurar apariencia' }).click();
  await page.getByRole('heading', { name: 'Configurar apariencia' }).waitFor();
  assert.equal(await page.getByLabel('Título', { exact: true }).inputValue(), 'Nos vamos de viaje');
  await page.getByLabel('Título', { exact: true }).fill('Cambio sin guardar');
  await page.getByRole('button', { name: 'Volver al viaje' }).click();
  await page.locator('#tripTitle').waitFor();
  assert.equal(await page.locator('#tripTitle').textContent(), 'Nos vamos de viaje');
  await page.getByRole('button', { name: 'Configurar apariencia' }).click();
  await page.getByRole('heading', { name: 'Configurar apariencia' }).waitFor();
  await page.locator('#tripSettingsBackground').setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
  assert.match(await page.locator('#tripSettingsStatus').textContent(), /JPG, PNG o WebP/);
  assert.equal(await page.locator('#tripSettingsBackground').inputValue(), '');
  await page.locator('#tripSettingsBackground').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64')});
  assert.match(await page.locator('#tripSettingsPreview').getAttribute('style'), /blob:/);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({path:fileURLToPath(new URL('../tmp/trip-settings-mobile.png', import.meta.url)),fullPage:true});
  await page.evaluate(() => { window.settingsTest.wait = true; });
  await page.getByRole('button', { name: 'Guardar configuración' }).click();
  await page.waitForFunction(() => Boolean(window.settingsTest.finish));
  await page.getByRole('button', { name: 'Cerrar sesión', exact:true }).click();
  await page.getByRole('button', { name: 'Iniciar sesión' }).waitFor();
  await page.evaluate(() => window.settingsTest.finish());
  assert.equal(await page.locator('#tripSettingsGate').getAttribute('aria-hidden'), 'true');
  assert.equal(await page.locator('#tripSettingsTitle').inputValue(), '');
  assert.equal(await page.locator('#tripSettingsPreviewTitle').textContent(), '');
  assert.doesNotMatch(await page.locator('#tripSettingsPreview').getAttribute('style') || '', /blob:/);
  await page.goto(baseUrl + '/?role=viewer#/trips/orlando-2027/settings');
  await page.getByText('No tenés permiso para configurar este viaje.', {exact:true}).waitFor();
  assert.equal(await page.getByRole('button', {name:'Guardar configuración'}).isVisible(), false);
  assert.equal(await page.getByRole('button', {name:'Configurar apariencia'}).count(), 0);
  await page.goto(baseUrl + '/?role=owner#/');
  await page.getByRole('button', {name:'Configurar apariencia'}).click();
  await page.getByRole('heading', {name:'Configurar apariencia'}).waitFor();
  await page.setViewportSize({width:1280,height:1000});
  await page.screenshot({path:fileURLToPath(new URL('../tmp/trip-settings-desktop.png', import.meta.url)),fullPage:true});
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('app:session-expired')));
  await page.getByRole('button', { name: 'Iniciar sesión' }).waitFor();
  assert.equal(await page.locator('#tripSettingsTitle').inputValue(), '');
  assert.deepEqual(errors, []);
  await page.close();
  return 'UI: editor save/reopen/cancel, XSS text, image validation/preview, mobile layout, viewer denial, owner without membership, logout during save and session expiry passed';
}
