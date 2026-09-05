import { supabase, systemUserApi } from '../api.js';
import { STRONG_PASSWORD_RE } from '../shared/constants.js';
import { $, setStatus } from '../shared/dom.js';
import { purgePrivateSessionData } from '../shared/session-security.js';

export function bindAuth({ authorize, showLogin }) {
  $('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus($('authStatus'), 'Ingresando…');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: $('email').value.trim().toLowerCase(),
      password: $('password').value,
    });
    if (error) return setStatus($('authStatus'), 'Email o contraseña incorrectos.', 'error');
    await authorize(data.user);
  });

  $('changePasswordForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = $('newPassword').value;
    if (password !== $('confirmPassword').value) return setStatus($('authStatus'), 'Las contraseñas no coinciden.', 'error');
    if (!STRONG_PASSWORD_RE.test(password)) return setStatus($('authStatus'), 'Usá al menos 8 caracteres con mayúscula, minúscula, número y símbolo.', 'error');

    setStatus($('authStatus'), 'Actualizando contraseña…');
    try {
      await systemUserApi('complete-password', { password });
      await supabase.auth.signOut();
      purgePrivateSessionData();
      showLogin('Contraseña actualizada. Iniciá sesión nuevamente.', 'ok');
    } catch (error) {
      setStatus($('authStatus'), error.message, 'error');
    }
  });
}
