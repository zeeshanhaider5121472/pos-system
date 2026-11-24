export const FEATURES = [
  { key: "pos", label: "POS / Billing" },
  { key: "products", label: "Products & Stock" },
  { key: "customers", label: "Customers" },
  { key: "reportsBasic", label: "Basic Reports" },
  { key: "reportsAdvanced", label: "Advanced Reports" },
  { key: "exports", label: "CSV/Excel Export" },
  { key: "whatsappReceipt", label: "WhatsApp Receipt Button" },
] as const;
export const DEFAULT_FEATURES: Record<string, boolean> = {
  dashboard: true,
  settings: true,
  pos: true,
  products: true,
  customers: true,
  reportsBasic: true,
  reportsAdvanced: false,
  exports: true,
  whatsappReceipt: true,
};
