import React, { createContext, useContext, useReducer, ReactNode, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartItem, CartState } from '@/types/cart';

interface CartContextType extends CartState {
  addToCart: (item: any) => { added: boolean; reason?: 'already_in_cart'; removedPhotoCount?: number };
  removeFromCart: (photoId: string) => void;
  updateQuantity: (photoId: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);
const CART_STORAGE_KEY = 'liftpictures_cart_v1';

type CartAction =
  | { type: 'ADD_TO_CART'; payload: any }
  | { type: 'REMOVE_FROM_CART'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { photoId: string; quantity: number } }
  | { type: 'HYDRATE_CART'; payload: CartState }
  | { type: 'CLEAR_CART' };

function computeTotals(items: CartItem[]): CartState {
  const total = items.reduce((sum, cartItem) => sum + (cartItem.price * cartItem.quantity), 0);
  const itemCount = items.reduce((sum, cartItem) => sum + cartItem.quantity, 0);
  return { items, total, itemCount };
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_TO_CART': {
      const item = action.payload;
      const itemId = item.id || item.photoId;
      const itemType = item.type || 'photo';
      const baseItems = itemType === 'pass'
        ? state.items.filter((cartItem) => cartItem.type !== 'photo')
        : state.items;
      const existingItem = baseItems.find(cartItem => cartItem.photoId === itemId);
      
      if (existingItem) {
        if (existingItem.type === 'photo' || itemType === 'photo') {
          return computeTotals(baseItems);
        }

        const updatedItems = baseItems.map(cartItem =>
          cartItem.photoId === itemId
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
        return computeTotals(updatedItems);
      }
      
      const newItem: CartItem = {
        id: `cart_${itemId}_${Date.now()}`,
        photoId: itemId,
        url: item.url || '',
        timestamp: item.timestamp || new Date().toLocaleTimeString(),
        speed: item.speed || 0,
        price: item.price,
        quantity: 1,
        type: itemType,
        title: item.title || item.name || 'Foto',
        selectedDate: item.selectedDate,
        ticketType: item.ticketType,
      };
      
      const updatedItems = [...baseItems, newItem];
      return computeTotals(updatedItems);
    }
    
    case 'REMOVE_FROM_CART': {
      const updatedItems = state.items.filter(item => item.photoId !== action.payload);
      return computeTotals(updatedItems);
    }
    
    case 'UPDATE_QUANTITY': {
      const { photoId, quantity } = action.payload;
      const existingItem = state.items.find(item => item.photoId === photoId);
      const isPhoto = existingItem?.type === 'photo';
      const nextQuantity = isPhoto ? 1 : quantity;
      
      if (nextQuantity <= 0) {
        const updatedItems = state.items.filter(item => item.photoId !== photoId);
        return computeTotals(updatedItems);
      }
      
      const updatedItems = state.items.map(item =>
        item.photoId === photoId ? { ...item, quantity: nextQuantity } : item
      );
      return computeTotals(updatedItems);
    }

    case 'HYDRATE_CART':
      return computeTotals(action.payload.items || []);
    
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
  const hydratedRef = useRef(false);
  const clearRequestedRef = useRef(false);

  useEffect(() => {
    const loadCart = async () => {
      try {
        const storedCart = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (!storedCart) return;
        if (clearRequestedRef.current) return;

        const parsed = JSON.parse(storedCart) as Partial<CartState>;
        const items = Array.isArray(parsed.items) ? parsed.items : [];
        if (clearRequestedRef.current) return;
        dispatch({
          type: 'HYDRATE_CART',
          payload: { items, total: 0, itemCount: 0 },
        });
      } catch (error) {
        console.error('Failed to load cart from storage:', error);
      } finally {
        hydratedRef.current = true;
      }
    };

    loadCart();
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;

    AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state)).catch((error) => {
      console.error('Failed to persist cart:', error);
    });
  }, [state]);

  const addToCart = (item: any) => {
    const itemId = item.id || item.photoId;
    const itemType = item.type || 'photo';
    const removedPhotoCount = itemType === 'pass'
      ? state.items.filter((cartItem) => cartItem.type === 'photo').length
      : 0;
    const existingItem = state.items.find(cartItem => cartItem.photoId === itemId);

    if (existingItem && (existingItem.type === 'photo' || itemType === 'photo')) {
      return { added: false, reason: 'already_in_cart' as const };
    }

    dispatch({ type: 'ADD_TO_CART', payload: item });
    return { added: true, removedPhotoCount };
  };

  const removeFromCart = (photoId: string) => {
    dispatch({ type: 'REMOVE_FROM_CART', payload: photoId });
  };

  const updateQuantity = (photoId: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { photoId, quantity } });
  };

  const clearCart = () => {
    clearRequestedRef.current = true;
    dispatch({ type: 'CLEAR_CART' });
    AsyncStorage.removeItem(CART_STORAGE_KEY).catch((error) => {
      console.error('Failed to clear cart from storage:', error);
    });
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
