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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message } = await req.json();
    
    const productQuery = message?.parameters?.product || message?.parameters?.query;
    const category = message?.parameters?.category;
    const brand = message?.parameters?.brand;
    
    console.log('VAPI Product Lookup:', { productQuery, category, brand });

    let products = [];

    if (productQuery) {
      products = await searchProducts(productQuery, category, brand);
    } else if (category) {
      products = await getProductsByCategory(category);
    } else {
      // Get popular/featured products
      products = await getFeaturedProducts();
    }

    const response = {
      result: products.map(formatProductData),
      count: products.length,
      message: products.length > 0 
        ? `Found ${products.length} product${products.length > 1 ? 's' : ''} ${productQuery ? `matching "${productQuery}"` : category ? `in ${category}` : 'for you'}`
        : `Sorry, I couldn't find any products ${productQuery ? `matching "${productQuery}"` : category ? `in ${category}` : ''}. Would you like me to search for something else?`
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in vapi-product-lookup:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to lookup product information',
      message: "I'm having trouble accessing product information right now. Please try again or ask me about something else."
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

function formatProductData(product: any) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    category: product.category,
    brand: product.brand,
    stock: product.stock_quantity,
    inStock: product.stock_quantity > 0,
    sizes: product.sizes || [],
    colors: product.colors || [],
    images: product.images || [],
    availability: product.stock_quantity > 0 
      ? `In stock (${product.stock_quantity} available)` 
      : 'Out of stock',
    priceFormatted: `$${parseFloat(product.price).toFixed(2)}`
  };
}