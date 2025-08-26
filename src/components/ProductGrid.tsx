import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Product } from '@/types/ecommerce';

interface ProductGridProps {
  products: Product[];
  loading: boolean;
  onProductSelect: (product: Product) => void;
}

export const ProductGrid = ({ products, loading, onProductSelect }: ProductGridProps) => {
  if (loading) {
    return (
      <section id="products" className="py-12">
        <h2 className="text-3xl font-bold mb-8 text-center">Latest Products</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <Card key={index} className="overflow-hidden">
              <Skeleton className="h-64 w-full" />
              <CardContent className="p-4">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-6 w-1/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section id="products" className="py-12">
      <h2 className="text-3xl font-bold mb-8 text-center">Latest Products</h2>
      
      {products.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">No products available at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <Card
              key={product.id}
              className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => onProductSelect(product)}
            >
              <div className="relative">
                {product.images && product.images.length > 0 ? (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="h-64 w-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="h-64 w-full bg-muted flex items-center justify-center">
                    <span className="text-muted-foreground">No Image</span>
                  </div>
                )}
                
                {product.stock_quantity < 10 && (
                  <Badge variant="destructive" className="absolute top-2 left-2">
                    Low Stock
                  </Badge>
                )}
              </div>
              
              <CardContent className="p-4">
                <h3 className="font-semibold text-lg mb-1 line-clamp-2">{product.name}</h3>
                {product.brand && (
                  <p className="text-muted-foreground text-sm mb-2">{product.brand}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-primary">
                    £{product.price.toFixed(2)}
                  </span>
                  <Badge variant="secondary">{product.category}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
};