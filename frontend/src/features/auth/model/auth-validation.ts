export const STRONG_PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export function normalizeLoginEmail(value: string) {
  return value.trim().toLowerCase();
}

export function validateNewPassword(password: string, confirmation: string) {
  if (password !== confirmation) return 'Las contraseñas no coinciden.';
  if (!STRONG_PASSWORD_RE.test(password)) {
    return 'Usá al menos 8 caracteres con mayúscula, minúscula, número y símbolo.';
  }
  return null;
}
