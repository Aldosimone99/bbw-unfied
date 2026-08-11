import { describe, expect, it } from 'vitest';
import { loginPayloadSchema } from '../../schemas/login-schema';
import { sendOtpPayloadSchema } from '../../schemas/otp-schema';
import { forgotPasswordPayloadSchema, resetPasswordPayloadSchema } from '../../schemas/password-schema';

describe('loginPayloadSchema', () => {
  it('accepts email + password + valid userType', () => {
    const result = loginPayloadSchema.safeParse({
      email: 'mario@example.com',
      password: 'Password123!',
      userType: 'medico',
    });
    expect(result.success).toBe(true);
  });

  it('rejects privato userType', () => {
    const result = loginPayloadSchema.safeParse({
      email: 'mario@example.com',
      password: 'Password123!',
      userType: 'privato',
    });
    expect(result.success).toBe(false);
  });

  it('accepts codiceFiscale as alternative identifier', () => {
    const result = loginPayloadSchema.safeParse({
      codiceFiscale: 'RSSMRA80A01H501U',
      password: 'Password123!',
    });
    expect(result.success).toBe(true);
  });
});

describe('sendOtpPayloadSchema', () => {
  it('rejects invalid purpose', () => {
    const result = sendOtpPayloadSchema.safeParse({
      email: 'test@example.com',
      purpose: 'invalid_purpose',
    });
    expect(result.success).toBe(false);
  });

  it('accepts registration purpose', () => {
    const result = sendOtpPayloadSchema.safeParse({
      email: 'test@example.com',
      purpose: 'registration',
    });
    expect(result.success).toBe(true);
  });
});

describe('resetPasswordPayloadSchema', () => {
  it('rejects weak passwords', () => {
    const result = resetPasswordPayloadSchema.safeParse({
      newPassword: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('accepts strong passwords', () => {
    const result = resetPasswordPayloadSchema.safeParse({
      newPassword: 'StrongPass123!',
    });
    expect(result.success).toBe(true);
  });
});

describe('forgotPasswordPayloadSchema', () => {
  it('accepts valid email', () => {
    const result = forgotPasswordPayloadSchema.safeParse({
      email: 'user@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = forgotPasswordPayloadSchema.safeParse({
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });
});
