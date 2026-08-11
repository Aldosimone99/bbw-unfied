import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../index';

describe('consent template routes', () => {
  it('mounts templates route behind auth', async () => {
    const response = await request(createApp({ from: vi.fn() } as any)).get('/consent-templates');
    expect([401, 500]).toContain(response.status);
  });
});
