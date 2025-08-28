export interface VAPICustomerData {
  name?: string;
  email?: string;
  phone?: string;
  totalOrders: number;
  recentOrders: VAPIOrderSummary[];
  callHistory: number;
  lastInteraction?: string;
  preferredLanguage: string;
  customerNotes?: string;
  tags: string[];
}

export interface VAPIOrderSummary {
  id: string;
  status: string;
  total: number;
  items: VAPIOrderItem[];
}

export interface VAPIOrderItem {
  product: string;
  quantity: number;
  price: number;
}

export interface VAPIProductData {
  id: string;
  name: string;
  description?: string;
  price: number;
  priceFormatted: string;
  category: string;
  brand?: string;
  stock: number;
  inStock: boolean;
  sizes: string[];
  colors: string[];
  images: string[];
  availability: string;
}

export interface VAPIOrderData {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  totalFormatted: string;
  created: string;
  updated: string;
  shippingAddress: any;
  customer: {
    name?: string;
    email: string;
  };
  items: VAPIOrderItemDetailed[];
  itemCount: number;
  statusMessage: string;
}

export interface VAPIOrderItemDetailed {
  id: string;
  productName: string;
  quantity: number;
  price: number;
  priceFormatted: string;
  size?: string;
  color?: string;
  product: {
    category: string;
    brand?: string;
    description?: string;
  };
}

export interface VAPIFunctionResponse {
  result: any;
  message: string;
  error?: string;
  count?: number;
}