-- Create agents table
CREATE TABLE public.agents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create calls table
CREATE TABLE public.calls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_number text NOT NULL,
  agent_id uuid REFERENCES public.agents(id),
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create transcripts table
CREATE TABLE public.transcripts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('customer', 'agent')),
  text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create suggestions table
CREATE TABLE public.suggestions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

-- Create policies for agents (public read for now)
CREATE POLICY "Anyone can view agents" ON public.agents FOR SELECT USING (true);
CREATE POLICY "Anyone can create agents" ON public.agents FOR INSERT WITH CHECK (true);

-- Create policies for calls 
CREATE POLICY "Anyone can view calls" ON public.calls FOR SELECT USING (true);
CREATE POLICY "Anyone can create calls" ON public.calls FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update calls" ON public.calls FOR UPDATE USING (true);

-- Create policies for transcripts
CREATE POLICY "Anyone can view transcripts" ON public.transcripts FOR SELECT USING (true);
CREATE POLICY "Anyone can create transcripts" ON public.transcripts FOR INSERT WITH CHECK (true);

-- Create policies for suggestions
CREATE POLICY "Anyone can view suggestions" ON public.suggestions FOR SELECT USING (true);
CREATE POLICY "Anyone can create suggestions" ON public.suggestions FOR INSERT WITH CHECK (true);

-- Enable realtime for tables
ALTER TABLE public.calls REPLICA IDENTITY FULL;
ALTER TABLE public.transcripts REPLICA IDENTITY FULL;
ALTER TABLE public.suggestions REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transcripts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.suggestions;