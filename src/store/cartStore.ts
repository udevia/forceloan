import { create } from 'zustand';

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
}

interface CartState {
  items: CartItem[];
  selectedCustomerId: string | null;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  setCustomer: (customerId: string) => void;
  clearCart: () => void;
  getTotal: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  selectedCustomerId: null,

  addItem: (newItem) => set((state) => {
    const existing = state.items.find(i => i.product_id === newItem.product_id);
    if (existing) {
      return {
        items: state.items.map(i => 
          i.product_id === newItem.product_id 
            ? { ...i, quantity: i.quantity + newItem.quantity }
            : i
        )
      };
    }
    return { items: [...state.items, newItem] };
  }),

  removeItem: (productId) => set((state) => ({
    items: state.items.filter(i => i.product_id !== productId)
  })),

  updateQuantity: (productId, quantity) => set((state) => ({
    items: state.items.map(i => 
      i.product_id === productId ? { ...i, quantity } : i
    )
  })),

  setCustomer: (customerId) => set({ selectedCustomerId: customerId }),

  clearCart: () => set({ items: [], selectedCustomerId: null }),

  getTotal: () => {
    return get().items.reduce((total, item) => total + (item.price * item.quantity), 0);
  }
}));
