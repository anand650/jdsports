import React, { useState, useEffect } from 'react';
import { Navigation } from './Navigation';
import { ProductGrid } from './ProductGrid';
import { ProductDetail } from './ProductDetail';
import { Cart } from './Cart';
import { Chatbot } from './Chatbot';
import { Product } from '@/types/ecommerce';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export const EcommerceLayout = () => {
  const [currentView, setCurrentView] = useState<'home' | 'product' | 'cart'>('home');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchProducts();
    fetchCartItems();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCartItems = async () => {
    try {
      // For now, we'll use localStorage for cart since user auth is not implemented
      const savedCart = localStorage.getItem('jd_sports_cart');
      if (savedCart) {
        setCartItems(JSON.parse(savedCart));
      }
    } catch (error) {
      console.error('Error fetching cart:', error);
    }
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setCurrentView('product');
  };

  const handleAddToCart = (product: Product, size?: string, color?: string, quantity: number = 1) => {
    const newItem = {
      id: `${product.id}-${size || 'default'}-${color || 'default'}`,
      product,
      quantity,
      size,
      color,
    };

    const existingCartItems = [...cartItems];
    const existingItemIndex = existingCartItems.findIndex(item => item.id === newItem.id);

    if (existingItemIndex >= 0) {
      existingCartItems[existingItemIndex].quantity += quantity;
    } else {
      existingCartItems.push(newItem);
    }

    setCartItems(existingCartItems);
    localStorage.setItem('jd_sports_cart', JSON.stringify(existingCartItems));

    toast({
      title: "Added to cart",
      description: `${product.name} has been added to your cart`,
    });
  };

  const handleRemoveFromCart = (itemId: string) => {
    const updatedCart = cartItems.filter(item => item.id !== itemId);
    setCartItems(updatedCart);
    localStorage.setItem('jd_sports_cart', JSON.stringify(updatedCart));
  };

  const handleUpdateCartQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveFromCart(itemId);
      return;
    }

    const updatedCart = cartItems.map(item =>
      item.id === itemId ? { ...item, quantity: newQuantity } : item
    );
    setCartItems(updatedCart);
    localStorage.setItem('jd_sports_cart', JSON.stringify(updatedCart));
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        currentView={currentView}
        onViewChange={setCurrentView}
        cartItemCount={cartItems.reduce((sum, item) => sum + item.quantity, 0)}
      />

      <main className="container mx-auto px-4 py-6">
        {currentView === 'home' && (
          <div>
            {/* Hero Section */}
            <section className="relative h-96 mb-12 rounded-2xl overflow-hidden gradient-hero">
              <div className="absolute inset-0 flex items-center justify-center text-center">
                <div className="text-white">
                  <h1 className="text-5xl font-bold mb-4">JD Sports</h1>
                  <p className="text-xl mb-6">King of Trainers, Princess of Sportswear</p>
                  <button
                    onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
                    className="bg-white text-primary px-8 py-3 rounded-full font-semibold hover:bg-gray-100 transition-colors"
                  >
                    Shop Now
                  </button>
                </div>
              </div>
            </section>

            <ProductGrid
              products={products}
              loading={loading}
              onProductSelect={handleProductSelect}
            />
          </div>
        )}

        {currentView === 'product' && selectedProduct && (
          <ProductDetail
            product={selectedProduct}
            onAddToCart={handleAddToCart}
            onBack={() => setCurrentView('home')}
          />
        )}

        {currentView === 'cart' && (
          <Cart
            items={cartItems}
            onRemoveItem={handleRemoveFromCart}
            onUpdateQuantity={handleUpdateCartQuantity}
          />
        )}
      </main>

      <Chatbot />
    </div>
  );
};