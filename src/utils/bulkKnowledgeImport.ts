import { supabase } from '@/integrations/supabase/client';

// Example knowledge base entries - replace with your actual content
export const knowledgeBaseEntries = [
  {
    title: "How to check order status",
    content: "To check your order status: 1. Log into your account 2. Go to 'My Orders' 3. Click on the order you want to track 4. View detailed status including shipping updates. You can also use our order tracking with just your order number and email.",
    category: "orders"
  },
  {
    title: "Size Exchange Process",
    content: "If you need to exchange an item for a different size: 1. Items must be unworn with tags attached 2. Request exchange within 365 days 3. Use our free returns service or visit any store 4. We'll process your exchange within 5-7 working days. Free exchanges are available for all size swaps.",
    category: "returns"
  },
  {
    title: "Student Discount Terms",
    content: "Students get 10% off with valid ID through UNiDAYS or Student Beans. Discount applies to full-price items only and cannot be combined with other offers. Verification required annually. Available both online and in-store.",
    category: "discount"
  },
  {
    title: "JD VIP Loyalty Benefits",
    content: "JD VIP members enjoy: Early access to sales, exclusive member prices, birthday rewards, and points on every purchase. Earn 1 point per £1 spent, 100 points = £5 reward. Free to join, instant benefits. Special VIP-only events and product launches.",
    category: "loyalty"
  },
  {
    title: "Click & Collect Service",
    content: "Order online and collect from any of our 400+ stores. Usually ready within 2 hours during store opening times. Free service with no minimum spend. Collect within 14 days of notification. Perfect for trying on sizes before taking home.",
    category: "shipping"
  },
  {
    title: "Nike Air Max Sizing Guide",
    content: "Nike Air Max models typically run true to size. For wider feet, consider going up half a size. Air Max 90, 95, 97 all fit similarly. Air Max 270 and 720 may feel snugger due to construction. Check individual product pages for specific guidance.",
    category: "sizing"
  },
  {
    title: "Adidas Sizing Compared to Nike",
    content: "Adidas typically runs slightly larger than Nike. If you wear UK 9 in Nike, try UK 8.5 in Adidas first. This applies to most models including Stan Smith, Gazelle, and Ultra Boost. Always check our size guide on each product page.",
    category: "sizing"
  },
  {
    title: "Damaged Item Returns",
    content: "If you receive a damaged item: 1. Don't worry, we'll sort it out 2. Contact us within 48 hours with photos 3. We'll arrange immediate replacement or refund 4. No need to return the damaged item in most cases 5. Full refund including shipping costs",
    category: "returns"
  }
];

export const bulkImportKnowledge = async () => {
  try {
    const { data, error } = await supabase
      .from('knowledge_base')
      .insert(knowledgeBaseEntries);

    if (error) {
      console.error('Error importing knowledge base:', error);
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      message: `Successfully imported ${knowledgeBaseEntries.length} knowledge base entries` 
    };
  } catch (error) {
    console.error('Error importing knowledge base:', error);
    return { success: false, error: 'Failed to import knowledge base entries' };
  }
};

// Helper function to clear existing knowledge base (use with caution!)
export const clearKnowledgeBase = async () => {
  try {
    const { error } = await supabase
      .from('knowledge_base')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
      console.error('Error clearing knowledge base:', error);
      return { success: false, error: error.message };
    }

    return { success: true, message: 'Knowledge base cleared successfully' };
  } catch (error) {
    console.error('Error clearing knowledge base:', error);
    return { success: false, error: 'Failed to clear knowledge base' };
  }
};