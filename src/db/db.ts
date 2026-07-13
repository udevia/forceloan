import Dexie, { type Table } from 'dexie';

export interface PaymentMethod {
  id: string;
  name: string;
  requiresBankInfo: boolean;
  requiresBills: boolean;
}

export interface Exchange {
  id: string;
  price: number;
  specialPrice?: number;
}

export interface Customer {
  id?: string; // UUID generado localmente o ID del backend
  name: string;
  dni: string;
  dniType: string;
  email: string;
  phone: string;
  address: string;
  gps_location?: {
    lat: number;
    lng: number;
  };
  document_images?: string[]; // Array de Base64 para offline
  isTaxWithholdingAgent?: boolean;
  createdBy?: string; // ID del vendedor o usuario que lo creó
  sync_status: 'synced' | 'pending' | 'error';
  created_at: number;
}

export interface Product {
  id: string; // ID del backend
  name: string;
  sku: string;
  price: number;
  taxRate?: number;
  stock: number;
  category?: string;
  image_url?: string;
  last_updated: number;
}

export interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id?: string | number; // UUID/number generado localmente
  backend_id?: string; // ID en Payload CMS
  status_name?: string; // Nombre del estado del pedido
  status_color?: string; // Color del estado
  customer_id: string;
  items: OrderItem[];
  subtotal?: number;
  taxTotal?: number;
  total: number;
  totalBs?: number;
  exchangeRate?: number;
  is_credit?: boolean;
  payment_cash?: Array<{
    amount: number;
    currency: 'USD' | 'VES';
    paymentGateway: string; // ID
  }>;
  bank_info?: Array<{
    transaction: string;
    transmitter: string;
    amount: number;
    paymentGateway: string; // ID
    receiptBase64?: string; // Para subir offline
  }>;
  sync_status: 'synced' | 'pending' | 'error';
  created_at: number;
}

export class ForceLoanDB extends Dexie {
  customers!: Table<Customer, string>;
  products!: Table<Product, string>;
  orders!: Table<Order, number>;
  paymentMethods!: Table<PaymentMethod, string>;
  exchange!: Table<Exchange, string>;

  constructor() {
    super('ForceLoanDB');
    
    this.version(1).stores({
      customers: '++id, name, sync_status',
      products: 'id, name, sku',
      orders: '++id, customer_id, sync_status'
    });

    this.version(2).stores({
      customers: '++id, name, sync_status',
      products: 'id, name, sku',
      orders: '++id, customer_id, sync_status',
      paymentMethods: 'id',
      exchange: 'id'
    });

    this.version(3).stores({
      customers: '++id, name, sync_status',
      products: 'id, name, sku',
      orders: '++id, customer_id, sync_status, backend_id',
      paymentMethods: 'id',
      exchange: 'id'
    });
  }
}

export const db = new ForceLoanDB();
