-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create knowledge base table for RAG
CREATE TABLE public.knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  embedding vector(1536), -- OpenAI ada-002 embedding dimension
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Create policies for knowledge base
CREATE POLICY "Knowledge base is readable by everyone" 
ON public.knowledge_base 
FOR SELECT 
USING (is_active = true);

-- Create function to search knowledge base using vector similarity
CREATE OR REPLACE FUNCTION search_knowledge_base(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  category TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.title,
    kb.content,
    kb.category,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_base kb
  WHERE kb.is_active = true
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Insert sample knowledge base content
INSERT INTO public.knowledge_base (title, content, category) VALUES
('Return Policy', 'JD Sports offers a 365-day return policy. You can return any unworn item with original tags and receipt within 365 days of purchase. Returns can be made in-store or by post. For online returns, you can use our free returns service.', 'policy'),
('Size Guide', 'For footwear: UK sizes run true to size. For clothing: Check our size guide on each product page. XS (6-8), S (8-10), M (10-12), L (12-14), XL (14-16), XXL (16-18). If between sizes, we recommend sizing up.', 'sizing'),
('Shipping Information', 'Standard delivery: 3-5 working days (Free on orders over £50). Next day delivery: Order before 10pm for next working day delivery (£4.99). Click & Collect: Available at over 400 stores, usually ready within 2 hours.', 'shipping'),
('Student Discount', 'Students get 10% off with valid student ID through UNiDAYS or Student Beans. Discount applies to full-price items only and cannot be combined with other offers.', 'discount'),
('Loyalty Program', 'Join JD VIP for exclusive benefits: Early access to sales, members-only prices, birthday rewards, and points on every purchase. Earn 1 point per £1 spent, 100 points = £5 reward.', 'loyalty');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_knowledge_base_updated_at
BEFORE UPDATE ON public.knowledge_base
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();