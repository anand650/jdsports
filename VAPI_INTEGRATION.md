# VAPI AI Voice Assistant Integration

This system provides a complete AI voice assistant integration with VAPI that can:
- Automatically look up customer information by phone number
- Fetch customer details by email or order ID
- Search and provide product information including stock levels
- Handle order inquiries and status updates

## Edge Functions Created

### 1. vapi-customer-lookup
**URL:** `https://wtradfuzjapqkowjpmew.supabase.co/functions/v1/vapi-customer-lookup`

**Purpose:** Initial customer lookup and information retrieval

**Parameters:**
- `phoneNumber`: Customer's phone number (automatic from call)
- `email`: Customer's email address
- `orderId`: Specific order ID to lookup

**Returns:** Customer profile, order history, and call history

### 2. vapi-product-lookup
**URL:** `https://wtradfuzjapqkowjpmew.supabase.co/functions/v1/vapi-product-lookup`

**Purpose:** Product search and information retrieval

**Parameters:**
- `product`: Product name or search query
- `category`: Product category filter
- `brand`: Brand filter

**Returns:** Product details, pricing, stock levels, variants

### 3. vapi-order-lookup
**URL:** `https://wtradfuzjapqkowjpmew.supabase.co/functions/v1/vapi-order-lookup`

**Purpose:** Detailed order information and status

**Parameters:**
- `orderId`: Specific order ID
- `email`: Customer email to find all orders

**Returns:** Order details, status, items, shipping information

## VAPI Configuration

### Custom Tools Setup

In your VAPI assistant configuration, add these custom tools:

```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "lookup_customer",
        "description": "Look up customer information by phone, email, or order ID",
        "url": "https://wtradfuzjapqkowjpmew.supabase.co/functions/v1/vapi-customer-lookup",
        "parameters": {
          "type": "object",
          "properties": {
            "email": {
              "type": "string",
              "description": "Customer email address"
            },
            "orderId": {
              "type": "string", 
              "description": "Order ID to lookup"
            }
          }
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "search_products",
        "description": "Search for products by name, category, or check stock levels",
        "url": "https://wtradfuzjapqkowjpmew.supabase.co/functions/v1/vapi-product-lookup",
        "parameters": {
          "type": "object",
          "properties": {
            "product": {
              "type": "string",
              "description": "Product name or search query"
            },
            "category": {
              "type": "string",
              "description": "Product category"
            },
            "brand": {
              "type": "string",
              "description": "Product brand"
            }
          }
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "get_order_details",
        "description": "Get detailed order information and status",
        "url": "https://wtradfuzjapqkowjpmew.supabase.co/functions/v1/vapi-order-lookup",
        "parameters": {
          "type": "object",
          "properties": {
            "orderId": {
              "type": "string",
              "description": "Order ID"
            },
            "email": {
              "type": "string",
              "description": "Customer email to find orders"
            }
          }
        }
      }
    }
  ]
}
```

### System Prompt

Use this system prompt in your VAPI assistant:

```
You are a helpful customer service AI assistant for an e-commerce company. 

INITIAL CUSTOMER LOOKUP:
- At the start of each call, automatically lookup customer information using their phone number
- If found, greet them by name and mention their recent activity
- If not found, politely ask for their email or order ID

CONVERSATION FLOW:
1. If customer info found: "Hi [Name]! I can see you're a valued customer with [X] orders. How can I help you today?"
2. If not found: "Hello! I'd be happy to help you today. Could you please provide your email address or order ID so I can look up your information?"

CAPABILITIES:
- Look up customer profiles and order history
- Search products by name, category, or brand
- Check product stock levels and variants (sizes/colors)
- Get order status and tracking information
- Answer questions about shipping and returns

PRODUCT QUERIES:
When customers ask about products:
- Use the search_products function to find relevant items
- Always mention stock availability
- Include price and variant information
- Suggest alternatives if items are out of stock

ORDER QUERIES:
For order-related questions:
- Use get_order_details to fetch current status
- Provide tracking information if available
- Explain next steps in the fulfillment process

Be conversational, helpful, and proactive in suggesting solutions.
```

## Conversation Examples

### Scenario 1: Known Customer Calls
```
Customer calls → Phone lookup finds customer → 
"Hi Sarah! Great to hear from you again. I can see your last order was delivered successfully last week. How can I help you today?"
```

### Scenario 2: New/Unknown Customer
```
Customer calls → No phone match → 
"Hello! I'd be happy to help you today. Could you provide your email address or order ID so I can pull up your information?"
```

### Scenario 3: Product Inquiry
```
Customer: "Do you have the Nike Air Max in size 10?"
Assistant uses search_products function →
"I found the Nike Air Max shoes! We have them in stock in size 10. The current price is $129.99 and they're available in black, white, and red. Would you like me to help you place an order?"
```

## Testing

Test the integration by:
1. Making a call to your VAPI number
2. Providing test email/order ID
3. Asking about product availability
4. Requesting order status updates

The system will automatically log all function calls for debugging in the Supabase Edge Function logs.