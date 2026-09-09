import { describe, expect, it } from 'vitest';
import { normalizeLoginEmail, validateNewPassword } from './auth-validation';
import { postLoginPath } from './auth-navigation';

const profile = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test',
  enabled: true,
  systemOwner: false,
  mustChangePassword: false,
};

describe('auth helpers', () => {
  it('normaliza el email de login', () => {
    expect(normalizeLoginEmail('  Lucas@Example.COM ')).toBe('lucas@example.com');
  });

  it('valida contraseñas fuertes y confirmación', () => {
    expect(validateNewPassword('Password1!', 'Password1!')).toBeNull();
    expect(validateNewPassword('Password1!', 'otra')).toMatch(/no coinciden/i);
    expect(validateNewPassword('password', 'password')).toMatch(/mayúscula/i);
  });

  it('redirige a cambio obligatorio antes de entrar a viajes', () => {
    expect(postLoginPath(profile)).toBe('/trips');
    expect(postLoginPath({ ...profile, mustChangePassword: true })).toBe('/change-password');
  });
});
