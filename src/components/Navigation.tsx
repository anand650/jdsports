import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingCart, User, Search, Menu } from 'lucide-react';

interface NavigationProps {
  currentView: 'home' | 'product' | 'cart';
  onViewChange: (view: 'home' | 'product' | 'cart') => void;
  cartItemCount: number;
}

export const Navigation = ({ currentView, onViewChange, cartItemCount }: NavigationProps) => {
  return (
    <header className="sticky top-0 z-50 bg-background border-b shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button
            onClick={() => onViewChange('home')}
            className="flex items-center space-x-2"
          >
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">JD</span>
            </div>
            <span className="text-xl font-bold text-primary">JD Sports</span>
          </button>

          {/* Navigation Menu */}
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#" className="text-foreground hover:text-primary transition-colors">Men</a>
            <a href="#" className="text-foreground hover:text-primary transition-colors">Women</a>
            <a href="#" className="text-foreground hover:text-primary transition-colors">Kids</a>
            <a href="#" className="text-foreground hover:text-primary transition-colors">Footwear</a>
            <a href="#" className="text-foreground hover:text-primary transition-colors">Brands</a>
            <a href="#" className="text-foreground hover:text-primary transition-colors">Sale</a>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" className="hidden md:flex">
              <Search className="h-5 w-5" />
            </Button>

            <Button variant="ghost" size="icon">
              <User className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onViewChange('cart')}
              className="relative"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartItemCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {cartItemCount}
                </Badge>
              )}
            </Button>

            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};