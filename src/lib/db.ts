import Dexie, { type Table } from "dexie";

export interface Product {
  id?: number;
  name: string;
  nameUr?: string;
  category: string;
  brand: string;
  season?: string;
  gender?: string;
}
export interface Variant {
  id?: number;
  productId: number;
  sku: string;
  size: string;
  color: string;
  costPrice: number;
  price: number;
  stock: number;
  reorderLevel: number;
}
export interface Customer {
  id?: number;
  phone: string;
  name: string;
  address?: string;
  points: number;
  balance: number;
}
export interface SaleItem {
  variantId: number;
  sku: string;
  name: string;
  nameUr?: string;
  size: string;
  color: string;
  qty: number;
  unitPrice: number;
  cost: number;
  discount: number;
}
export interface Payment {
  method: "cash" | "card" | "transfer" | "wallet" | "credit";
  amount: number;
}
export interface Sale {
  id?: number;
  ts: number;
  customerId?: number;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payments: Payment[];
  status: "paid" | "held" | "refunded";
  receiptLang: "en" | "ur" | "both";
}
export interface StockMove {
  id?: number;
  ts: number;
  variantId: number;
  qty: number;
  type: "sale" | "purchase" | "adjust" | "damage" | "return";
  ref?: string;
}
export interface KV {
  key: string;
  value: any;
}

class POSDB extends Dexie {
  products!: Table<Product, number>;
  variants!: Table<Variant, number>;
  customers!: Table<Customer, number>;
  sales!: Table<Sale, number>;
  moves!: Table<StockMove, number>;
  kv!: Table<KV, string>;
  constructor() {
    super("clothing-pos");
    this.version(1).stores({
      products: "++id, name, category, brand",
      variants: "++id, productId, sku, [productId+size+color]",
      customers: "++id, &phone, name",
      sales: "++id, ts, customerId, status",
      moves: "++id, ts, variantId, type",
      kv: "key",
    });
  }
}
export const db = new POSDB();
export const getSetting = async (k: string) => (await db.kv.get(k))?.value;
export const setSetting = (k: string, v: any) =>
  db.kv.put({ key: k, value: v });
export const LOCAL_TABLES = [
  "products",
  "variants",
  "customers",
  "sales",
  "moves",
] as const;
