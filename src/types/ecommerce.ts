export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  brand?: string;
  sizes?: string[];
  colors?: string[];
  images?: string[];
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  size?: string;
  color?: string;
  created_at: string;
  product?: Product;
}

export interface Order {
  id: string;
  user_id: string;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  shipping_address: {
    name: string;
    street: string;
    city: string;
    postal_code: string;
    country: string;
  };
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  size?: string;
  color?: string;
  price: number;
  created_at: string;
  product?: Product;
}

export interface ChatSession {
  id: string;
  user_id?: string;
  session_token: string;
  status: 'active' | 'escalated' | 'closed';
  assigned_agent_id?: string;
  escalated_at?: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    full_name?: string;
    email: string;
  };
}

export interface ChatMessage {
  id: string;
  session_id: string;
  sender_type: 'user' | 'ai' | 'agent';
  sender_id?: string;
  content: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role: 'customer' | 'agent' | 'admin';
  created_at: string;
  updated_at: string;
}