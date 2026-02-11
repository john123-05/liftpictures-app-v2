import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { CartItem, CartState, Product } from '@/types/cart';

interface CartContextType extends CartState {
  addToCart: (item: any) => void;
  removeFromCart: (photoId: string) => void;
  updateQuantity: (photoId: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

type CartAction =
  | { type: 'ADD_TO_CART'; payload: any }
  | { type: 'REMOVE_FROM_CART'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { photoId: string; quantity: number } }
  | { type: 'CLEAR_CART' };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_TO_CART': {
      const item = action.payload;
      const itemId = item.id || item.photoId;
      const existingItem = state.items.find(cartItem => cartItem.photoId === itemId);
      
      if (existingItem) {
        const updatedItems = state.items.map(cartItem =>
          cartItem.photoId === itemId
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
        const total = updatedItems.reduce((sum, cartItem) => sum + (cartItem.price * cartItem.quantity), 0);
        const itemCount = updatedItems.reduce((sum, cartItem) => sum + cartItem.quantity, 0);
        
        return { items: updatedItems, total, itemCount };
      }
      
      const newItem: CartItem = {
        id: `cart_${itemId}_${Date.now()}`,
        photoId: itemId,
        url: item.url || '',
        timestamp: item.timestamp || new Date().toLocaleTimeString(),
        speed: item.speed || 0,
        price: item.price,
        quantity: 1,
        type: item.type || 'photo',
        title: item.title || item.name || 'Foto',
      };
      
      const updatedItems = [...state.items, newItem];
      const total = updatedItems.reduce((sum, cartItem) => sum + (cartItem.price * cartItem.quantity), 0);
      const itemCount = updatedItems.reduce((sum, cartItem) => sum + cartItem.quantity, 0);
      
      return { items: updatedItems, total, itemCount };
    }
    
    case 'REMOVE_FROM_CART': {
      const updatedItems = state.items.filter(item => item.photoId !== action.payload);
      const total = updatedItems.reduce((sum, cartItem) => sum + (cartItem.price * cartItem.quantity), 0);
      const itemCount = updatedItems.reduce((sum, cartItem) => sum + cartItem.quantity, 0);
      
      return { items: updatedItems, total, itemCount };
    }
    
    case 'UPDATE_QUANTITY': {
      const { photoId, quantity } = action.payload;
      
      if (quantity <= 0) {
        const updatedItems = state.items.filter(item => item.photoId !== photoId);
        const total = updatedItems.reduce((sum, cartItem) => sum + (cartItem.price * cartItem.quantity), 0);
        const itemCount = updatedItems.reduce((sum, cartItem) => sum + cartItem.quantity, 0);
        
        return { items: updatedItems, total, itemCount };
      }
      
      const updatedItems = state.items.map(item =>
        item.photoId === photoId ? { ...item, quantity } : item
      );
      const total = updatedItems.reduce((sum, cartItem) => sum + (cartItem.price * cartItem.quantity), 0);
      const itemCountNew = updatedItems.reduce((sum, cartItem) => sum + cartItem.quantity, 0);
      
      return { items: updatedItems, total, itemCount: itemCountNew };
    }
    
    case 'CLEAR_CART':
      return { items: [], total: 0, itemCount: 0 };
    
    default:
      return state;
  }
}

const initialState: CartState = {
  items: [],
  total: 0,
  itemCount: 0,
};

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  const addToCart = (item: any) => {
    dispatch({ type: 'ADD_TO_CART', payload: item });
  };

  const removeFromCart = (photoId: string) => {
    dispatch({ type: 'REMOVE_FROM_CART', payload: photoId });
  };

  const updateQuantity = (photoId: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { photoId, quantity } });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  return (
    <CartContext.Provider
      value={{
        ...state,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}