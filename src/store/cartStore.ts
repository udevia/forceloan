import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      selectedCustomerId: null,

      addItem: (newItem) => set((state) => {
        const existing = state.items.find(i => i.product_id === newItem.product_id);
        if (existing) {
          const newQty = Math.min(existing.quantity + newItem.quantity, existing.stock);
          return {
            items: state.items.map(i => 
              i.product_id === newItem.product_id 
                ? { ...i, quantity: newQty }
                : i
            )
          };
        }
        const initialQty = Math.min(newItem.quantity, newItem.stock);
        return { items: [...state.items, { ...newItem, quantity: initialQty }] };
      }),

      removeItem: (productId) => set((state) => ({
        items: state.items.filter(i => i.product_id !== productId)
      })),

      updateQuantity: (productId, quantity) => set((state) => ({
        items: state.items.map(i => {
          if (i.product_id === productId) {
            const safeQty = Math.min(Math.max(1, quantity), i.stock);
            return { ...i, quantity: safeQty };
          }
          return i;
        })
      })),

      setCustomer: (customerId) => set({ selectedCustomerId: customerId }),

      clearCart: () => set({ items: [], selectedCustomerId: null }),

      getTotal: () => {
        return get().items.reduce((total, item) => total + (item.price * item.quantity), 0);
      }
    }),
    {
      name: 'cart-storage', // Se guarda por defecto en localStorage
    }
  )
);
