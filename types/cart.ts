export interface CartItem {
  id: string;
  photoId: string;
  url: string;
  timestamp: string;
  speed: number;
  price: number;
  quantity: number;
  type?: 'photo' | 'pass' | 'ticket';
  title?: string;
  selectedDate?: string;
  ticketType?: string;
}

export interface CartState {
  items: CartItem[];
  total: number;
  itemCount: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  type: 'photo' | 'pass' | 'ticket';
  description?: string;
  url?: string;
}
export interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal' | 'apple_pay' | 'google_pay';
  last4?: string;
  brand?: string;
  isDefault: boolean;
}

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  paymentMethod: PaymentMethod;
}