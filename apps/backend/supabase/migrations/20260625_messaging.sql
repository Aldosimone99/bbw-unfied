CREATE TABLE IF NOT EXISTS public.message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_type TEXT NOT NULL DEFAULT 'notification' CHECK (thread_type IN ('notification', 'chat')),
  participant_ids UUID[] NOT NULL,
  last_message_id UUID,
  archived_by UUID[] NOT NULL DEFAULT '{}',
  deleted_by UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id),
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'file', 'system')),
  content TEXT,
  context JSONB,
  read_by UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.message_threads
  ADD CONSTRAINT message_threads_last_message_fkey
  FOREIGN KEY (last_message_id) REFERENCES public.message_messages(id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX IF NOT EXISTS idx_threads_participants
  ON public.message_threads USING GIN (participant_ids);

CREATE INDEX IF NOT EXISTS idx_threads_type_updated
  ON public.message_threads (thread_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_thread
  ON public.message_messages (thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_sender
  ON public.message_messages (sender_id);

CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON public.message_messages (thread_id)
  WHERE array_length(read_by, 1) IS NULL OR array_length(read_by, 1) = 0;

ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS threads_participant ON public.message_threads;
CREATE POLICY threads_participant ON public.message_threads
  FOR SELECT USING (auth.uid() = ANY(participant_ids));

ALTER TABLE public.message_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS messages_participant ON public.message_messages;
CREATE POLICY messages_participant ON public.message_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.message_threads t
      WHERE t.id = message_messages.thread_id
        AND auth.uid() = ANY(t.participant_ids)
    )
  );
