-- Add chat escalation and agent management tables
CREATE TABLE public.chat_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id),
  session_token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'escalated', 'closed')),
  assigned_agent_id UUID REFERENCES public.users(id),
  escalated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'ai', 'agent')),
  sender_id UUID REFERENCES public.users(id),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add agent role to users table
ALTER TABLE public.users ADD COLUMN role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'agent', 'admin'));

-- Enable RLS
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Chat sessions policies
CREATE POLICY "Users can view their own chat sessions"
ON public.chat_sessions FOR SELECT
USING (user_id = auth.uid() OR assigned_agent_id = auth.uid());

CREATE POLICY "Users can create their own chat sessions"
ON public.chat_sessions FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Agents can update assigned chat sessions"
ON public.chat_sessions FOR UPDATE
USING (assigned_agent_id = auth.uid() OR EXISTS (
  SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
));

-- Chat messages policies
CREATE POLICY "Users can view messages in their sessions"
ON public.chat_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.chat_sessions cs 
  WHERE cs.id = session_id 
  AND (cs.user_id = auth.uid() OR cs.assigned_agent_id = auth.uid())
));

CREATE POLICY "Users can send messages in their sessions"
ON public.chat_messages FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.chat_sessions cs 
  WHERE cs.id = session_id 
  AND (cs.user_id = auth.uid() OR cs.assigned_agent_id = auth.uid())
));

-- Add realtime
ALTER TABLE public.chat_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

ALTER publication supabase_realtime ADD TABLE public.chat_sessions;
ALTER publication supabase_realtime ADD TABLE public.chat_messages;

-- Create trigger for updated_at
CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();