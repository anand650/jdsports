import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { message = {} } = body;
    
    // Enhanced parameter extraction with multiple fallback paths
    const productQuery = message?.parameters?.product || 
                        message?.parameters?.query ||
                        message?.product ||
                        message?.query ||
                        body.product ||
                        body.query;
                        
    const category = message?.parameters?.category || 
                    message?.category ||
                    body.category;
                    
    const brand = message?.parameters?.brand || 
                 message?.brand ||
                 body.brand;
    
    console.log('VAPI Product Lookup:', { productQuery, category, brand, rawMessage: message });

    // Use AI to normalize and complete inputs
    const normalizedInputs = await normalizeInputsWithAI({ productQuery, category, brand });

    let products = [];
    let searchAttempted = false;
    let searchType = null;

    // Use normalized inputs for better matching
    const finalProductQuery = normalizedInputs.productQuery || productQuery;
    const finalCategory = normalizedInputs.category || category;
    const finalBrand = normalizedInputs.brand || brand;

    // Enhanced search with validation and error handling
    if (finalProductQuery && typeof finalProductQuery === 'string' && finalProductQuery.trim()) {
      searchType = 'query';
      searchAttempted = true;
      console.log('Searching products by query:', finalProductQuery, normalizedInputs.productQuery ? '(AI normalized)' : '');
      try {
        products = await searchProducts(finalProductQuery.trim(), finalCategory, finalBrand);
      } catch (error) {
        console.error('Error searching products by query:', error);
      }
    } else if (finalCategory && typeof finalCategory === 'string' && finalCategory.trim()) {
      searchType = 'category';
      searchAttempted = true;
      console.log('Searching products by category:', finalCategory, normalizedInputs.category ? '(AI normalized)' : '');
      try {
        products = await getProductsByCategory(finalCategory.trim());
      } catch (error) {
        console.error('Error searching products by category:', error);
      }
    } else {
      // Get popular/featured products as fallback
      searchType = 'featured';
      searchAttempted = true;
      try {
        products = await getFeaturedProducts();
      } catch (error) {
        console.error('Error getting featured products:', error);
      }
    }

    const response = {
      result: products.map(formatProductData),
      count: products.length,
      searchType,
      searchAttempted,
      parameters: { productQuery: finalProductQuery, category: finalCategory, brand: finalBrand },
      originalParameters: { productQuery, category, brand },
      normalizedInputs: normalizedInputs,
      message: generateProductResponseMessage(products, { productQuery: finalProductQuery, category: finalCategory, brand: finalBrand }, searchAttempted)
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in vapi-product-lookup:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to lookup product information',
      message: "I'm having trouble searching for products right now. Could you please tell me what product you're looking for? You can mention a product name, category, or brand.",
      suggestion: "Try saying 'Show me shirts' or 'I'm looking for Nike products'"
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function searchProducts(query: string, category?: string, brand?: string) {
  console.log('Searching products:', { query, category, brand });
  
  let queryBuilder = supabase
    .from('products')
    .select('*')
    .eq('is_active', true);

  // Search in name and description
  queryBuilder = queryBuilder.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
  
  if (category) {
    queryBuilder = queryBuilder.eq('category', category);
  }
  
  if (brand) {
    queryBuilder = queryBuilder.eq('brand', brand);
  }
  
  const { data, error } = await queryBuilder
    .order('stock_quantity', { ascending: false })
    .limit(10);
    
  if (error) throw error;
  return data || [];
}

async function getProductsByCategory(category: string) {
  console.log('Getting products by category:', category);
  
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .eq('category', category)
    .order('stock_quantity', { ascending: false })
    .limit(10);
    
  if (error) throw error;
  return data || [];
}

async function getFeaturedProducts() {
  console.log('Getting featured products');
  
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('stock_quantity', { ascending: false })
    .limit(5);
    
  if (error) throw error;
  return data || [];
}

function generateProductResponseMessage(products: any[], params: any, searchAttempted: boolean) {
  const { productQuery, category, brand } = params;
  
  if (products.length > 0) {
    if (productQuery) {
      return `Found ${products.length} product${products.length > 1 ? 's' : ''} matching "${productQuery}". ${products.length > 1 ? 'Here are your options:' : 'Here are the details:'}`;
    } else if (category) {
      return `Found ${products.length} product${products.length > 1 ? 's' : ''} in ${category}. ${products.length > 1 ? 'Here are your options:' : 'Here are the details:'}`;
    } else {
      return `Here are ${products.length} popular product${products.length > 1 ? 's' : ''} for you to browse:`;
    }
  } else if (searchAttempted) {
    if (productQuery || category) {
      const searchTerm = productQuery || category;
      return `I couldn't find any products ${searchTerm ? `matching "${searchTerm}"` : 'with those criteria'}. Would you like to try a different search term or browse a specific category?`;
    }
  }
  
  return "I can help you find products by name, category, or brand. What are you looking for today?";
}

function formatProductData(product: any) {
  const price = product?.price ? parseFloat(product.price) : 0;
  const stock = product?.stock_quantity || 0;
  
  return {
    id: product?.id || 'unknown',
    name: product?.name || 'Unknown Product',
    description: product?.description || 'No description available',
    price: price,
    category: product?.category || 'Uncategorized',
    brand: product?.brand || 'Unknown Brand',
    stock: stock,
    inStock: stock > 0,
    sizes: product?.sizes || [],
    colors: product?.colors || [],
    images: product?.images || [],
    availability: stock > 0 
      ? `In stock (${stock} available)` 
      : 'Out of stock',
    priceFormatted: price > 0 ? `$${price.toFixed(2)}` : 'Price not available'
  };
}

async function normalizeInputsWithAI(inputs: { productQuery?: string; category?: string; brand?: string }) {
  if (!openAIApiKey) {
    console.log('No OpenAI API key found, skipping AI normalization');
    return { productQuery: null, category: null, brand: null };
  }

  try {
    const prompt = `You are a product search normalization assistant. Given user inputs that might be incomplete or malformed, normalize them to proper formats for product search.

Input data:
- Product Query: "${inputs.productQuery || 'none'}"
- Category: "${inputs.category || 'none'}"
- Brand: "${inputs.brand || 'none'}"

Rules:
1. Product queries: Fix typos, expand abbreviations (e.g., "nike air" → "Nike Air Max", "adidas shoe" → "Adidas sneakers")
2. Categories: Normalize to standard categories (e.g., "shoe" → "footwear", "shirt" → "clothing")
3. Brands: Fix brand name spellings (e.g., "adidas" → "Adidas", "nike" → "Nike")

Return ONLY a JSON object with normalized values or null if unable to normalize:
{
  "productQuery": "normalized product query or null",
  "category": "normalized category or null",
  "brand": "normalized brand name or null"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 150,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, response.statusText);
      return { productQuery: null, category: null, brand: null };
    }

    const data = await response.json();
    const normalizedText = data.choices[0].message.content.trim();
    
    try {
      const normalized = JSON.parse(normalizedText);
      console.log('AI normalized product inputs:', normalized);
      return normalized;
    } catch (parseError) {
      console.error('Failed to parse AI response:', normalizedText);
      return { productQuery: null, category: null, brand: null };
    }
  } catch (error) {
    console.error('Error in AI normalization:', error);
    return { productQuery: null, category: null, brand: null };
  }
}