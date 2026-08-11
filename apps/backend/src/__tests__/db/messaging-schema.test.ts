import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(__dirname, '../../../supabase/migrations/20260625_messaging.sql');

describe('messaging schema', () => {
  const migration = readFileSync(migrationPath, 'utf8');

  it('creates notification-capable thread and message tables', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.message_threads');
    expect(migration).toContain('thread_type TEXT NOT NULL DEFAULT');
    expect(migration).toContain("CHECK (thread_type IN ('notification', 'chat'))");
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.message_messages');
    expect(migration).toContain('context JSONB');
  });

  it('creates notification indexes and RLS policies', () => {
    expect(migration).toContain('idx_threads_participants');
    expect(migration).toContain('idx_messages_thread');
    expect(migration).toContain('idx_messages_unread');
    expect(migration).toContain('ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('threads_participant');
    expect(migration).toContain('messages_participant');
  });
});
