import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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
    await page.route(url, route => route.fulfill({ body, contentType, headers: { 'Access-Control-Allow-Origin': '*' } }));
  }

  await page.route('**/assets/js/api.js', route => route.fulfill({ contentType: 'text/javascript', body: `
    const trip = { id:'trip-1', slug:'orlando-2027', name:'Orlando 2027', countryCode:'US', regionCode:'FL', destination:'Orlando', startsOn:'2027-01-10' };
    const roles = [
      {id:1,code:'admin',name:'Administrador'},
      {id:2,code:'editor',name:'Editor'},
      {id:3,code:'viewer',name:'Visualización'},
    ];
    let members = [
      {userId:'owner-1',roleId:1,isOwner:true,role:roles[0],profile:{email:'owner@example.invalid',displayName:'Owner User',enabled:true}},
      {userId:'member-1',roleId:3,isOwner:false,role:roles[2],profile:{email:'member@example.invalid',displayName:'Existing User',enabled:false}},
    ];
    let available = [
      {id:'available-1',email:'xss@example.invalid',displayName:'<img src=x onerror=alert(1)>'},
      {id:'available-2',email:'new@example.invalid',displayName:'New User'},
    ];
    const role = new URLSearchParams(location.search).get('role') || 'admin';
    const permissions = role === 'viewer' ? ['trip.view'] : role === 'editor' ? ['trip.view','trip.edit'] : ['trip.view','trip.edit','members.manage'];
    window.participantsTest = { calls: [] };
    export const supabase = { auth: { getSession: async () => ({data:{session:{user:{id:'test-user'}}}}) } };
    export const secureSignOut = async () => {};
    export const systemUserApi = async () => ({users:[],trips:[],roles:[]});
    export async function tripApi(action,payload={}) {
      if (action === 'bootstrap') return { profile:{email:'test@example.invalid',systemOwner:role==='owner'}, memberships:[], accessibleTrips:[{trip,membership:role==='owner'?null:{role:{name:'Administrador'}},permissions}] };
      if (action === 'trip-detail') return { trip, permissions, settings:{eyebrow:'Próxima parada',title:'Viaje',subtitle:'',photoCredit:'',backgroundUrl:null,startAt:'2026-01-01T00:00:00Z',defaultArrivalAt:'2027-01-10T05:00:00Z',defaultTimezone:'America/New_York'} };
      if (action === 'trip-admin') return { roles, members, availableUsers: available };
      if (action === 'assign') {
        window.participantsTest.calls.push({action,payload});
        const user = available.find(item => item.id === payload.userId);
        const selectedRole = roles.find(item => item.code === payload.role);
        if (user && selectedRole) {
          members.push({userId:user.id,roleId:selectedRole.id,isOwner:false,role:selectedRole,profile:{email:user.email,displayName:user.displayName,enabled:true}});
          available = available.filter(item => item.id !== user.id);
        }
        return {ok:true};
      }
      if (action === 'update-role') {
        window.participantsTest.calls.push({action,payload});
        const member = members.find(item => item.userId === payload.userId);
        const selectedRole = roles.find(item => item.code === payload.role);
        if (member && selectedRole) { member.roleId = selectedRole.id; member.role = selectedRole; }
        return {ok:true};
      }
      if (action === 'remove') {
        window.participantsTest.calls.push({action,payload});
        const member = members.find(item => item.userId === payload.userId);
        if (member) available.push({id:member.userId,email:member.profile.email,displayName:member.profile.displayName});
        members = members.filter(item => item.userId !== payload.userId);
        return {ok:true};
      }
      throw new Error('Unexpected action: '+action);
    }
  ` }));

  await page.goto(baseUrl + '/?role=admin#/trips/orlando-2027/participants');
  await page.getByRole('heading', { name: 'Participantes', exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('#tripParticipantsCount')?.textContent === '2');
  assert.equal(await page.locator('#tripParticipantsActiveCount').textContent(), '1');
  assert.equal(await page.locator('#tripParticipantsAvailableCount').textContent(), '2');
  assert.equal(await page.locator('#tripParticipantsAvailable img').count(), 0);
  assert.match(await page.locator('#tripParticipantsAvailable').textContent(), /<img src=x onerror=alert\(1\)>/);

  const ownerRow = page.locator('#tripParticipantsMembers article').filter({ hasText: 'Owner User' });
  assert.equal(await ownerRow.getByRole('button', { name: 'Quitar del viaje' }).count(), 0);
  assert.match(await ownerRow.textContent(), /Propietario/);

  await page.locator('#participant-available-available-1').check();
  await page.locator('#tripParticipantsRole').selectOption('editor');
  await page.getByRole('button', { name: 'Agregar seleccionados' }).click();
  await page.waitForFunction(() => document.querySelector('#tripParticipantsCount')?.textContent === '3');
  assert.equal(await page.locator('#tripParticipantsAvailableCount').textContent(), '1');
  assert.equal(await page.evaluate(() => window.participantsTest.calls.some(call => call.action === 'assign' && call.payload.role === 'editor')), true);

  await page.getByLabel('Rol de Existing User').selectOption('editor');
  await page.waitForFunction(() => window.participantsTest.calls.some(call => call.action === 'update-role'));

  page.once('dialog', dialog => dialog.accept());
  const existingRow = page.locator('#tripParticipantsMembers article').filter({ hasText: 'Existing User' });
  await existingRow.getByRole('button', { name: 'Quitar del viaje' }).click();
  await page.waitForFunction(() => document.querySelector('#tripParticipantsCount')?.textContent === '2');
  assert.equal(await page.evaluate(() => window.participantsTest.calls.some(call => call.action === 'remove')), true);

  await page.getByRole('button', { name: 'Volver al viaje' }).click();
  await page.locator('#tripTitle').waitFor();
  assert.equal(await page.getByRole('button', { name: '👥 Participantes' }).count() > 0, true);
  await page.getByRole('button', { name: '👥 Participantes' }).click();
  await page.getByRole('heading', { name: 'Participantes', exact: true }).waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

  await page.goto(baseUrl + '/?role=viewer#/trips/orlando-2027/participants');
  await page.getByText('No tenés permiso para gestionar los participantes de este viaje.', { exact: true }).waitFor();
  assert.equal(await page.locator('#tripParticipantsGate').getAttribute('aria-hidden'), 'true');

  await page.goto(baseUrl + '/?role=owner#/');
  await page.getByRole('button', { name: '👥 Participantes' }).click();
  await page.getByRole('heading', { name: 'Participantes', exact: true }).waitFor();

  await page.evaluate(() => window.dispatchEvent(new CustomEvent('app:session-expired')));
  await page.getByRole('button', { name: 'Iniciar sesión' }).waitFor();
  assert.equal(await page.locator('#tripParticipantsGate').getAttribute('aria-hidden'), 'true');
  assert.equal(await page.locator('#tripParticipantsMembers').textContent(), '');
  assert.deepEqual(errors, []);

  await page.close();
  return 'UI: dedicated route, summaries, XSS-safe rendering, owner protection, assign/update/remove, permissions, mobile layout, owner access and session purge passed';
}
