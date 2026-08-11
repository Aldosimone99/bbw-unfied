import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmailService } from '../../services/email-service';

describe('email-service', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  it('logs invite links and skips Mailjet when the API key is missing', async () => {
    delete process.env.MAILJET_API_KEY;
    process.env.NODE_ENV = 'development';
    const service = createEmailService();

    await service.sendInviteEmail({
      to: 'mario@example.com',
      nome: 'Mario',
      role: 'cliente',
      acceptLink: 'http://localhost:3000/invite/accept/token-1',
    });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:3000/invite/accept/token-1'),
    );
  });

  it('logs invite links and skips Mailjet in test mode', async () => {
    process.env.MAILJET_API_KEY = 'key';
    process.env.MAILJET_API_SECRET = 'secret';
    process.env.NODE_ENV = 'test';
    const service = createEmailService();

    await service.sendInviteEmail({
      to: 'mario@example.com',
      role: 'medico',
      acceptLink: 'http://localhost:3000/invite/accept/token-2',
    });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('token-2'),
    );
  });

  it('logs company invite links and skips Mailjet in test mode', async () => {
    process.env.MAILJET_API_KEY = 'key';
    process.env.MAILJET_API_SECRET = 'secret';
    process.env.NODE_ENV = 'test';
    const service = createEmailService();

    await service.sendCompanyInviteEmail({
      to: 'medico@example.com',
      nome: 'Mario',
      clinicName: 'Clinica Roma',
      role: 'medico',
      acceptLink: 'http://localhost:3000/company/invite/accept/token-1',
    });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:3000/company/invite/accept/token-1'),
    );
  });

  it('supports consent OTP and share emails in test mode', async () => {
    const service = createEmailService();
    await expect(service.sendConsentOTPEmail({
      to: 'cliente@example.com',
      code: '123456',
      patientName: 'Ada',
    })).resolves.toBeUndefined();
    await expect(service.sendConsentShareEmail({
      to: 'cliente@example.com',
      patientName: 'Ada',
      professionalName: 'Dott.ssa Bianchi',
      shareLink: 'http://localhost:3000/consents/sign/token',
    })).resolves.toBeUndefined();
  });
});
