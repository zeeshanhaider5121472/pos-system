"use client";
// Shop branding, resolved from two layers:
//   1. the license payload (signed, set by the app owner in /admin)
//   2. the shop's own local overrides (Settings → Shop Details, stored in
//      IndexedDB so they work fully offline)
// Any non-empty local value wins, so the shop can fix its phone number,
// currency, tax or receipt footers itself without asking the owner.
import { useLiveQuery } from "dexie-react-hooks";
import { getSetting, setSetting, type Sale } from "./db";
import { DEFAULT_FEATURES } from "./features";
import { getLicense } from "./license";

/**
 * The receipt logo is a file bundled with the app at public/icons/logo.png.
 * It is deliberately a fixed app path (NOT a URL): it works offline, needs
 * no configuration, and survives packaging the app into a desktop .exe
 * (Electron) later — just replace the file to change the logo.
 */
export const SHOP_LOGO = "/icons/logo.png";

export interface ShopOverrides {
  shopName?: string;
  shopNameUr?: string;
  address?: string;
  phone?: string;
  currency?: string;
  taxName?: string;
  taxRate?: number;
  footerEn?: string;
  footerUr?: string;
}

export async function getOverrides(): Promise<ShopOverrides> {
  return ((await getSetting("shopOverrides")) ?? {}) as ShopOverrides;
}
export const saveOverrides = (o: ShopOverrides) =>
  setSetting("shopOverrides", o);

/** license branding + local overrides → one branding object for the UI */
export function mergeBranding(
  lic: Record<string, any> | undefined,
  o: ShopOverrides | undefined,
): Record<string, any> {
  const b: Record<string, any> = { ...(lic ?? {}) };
  const src = o ?? {};
  for (const k of Object.keys(src) as (keyof ShopOverrides)[]) {
    const v = src[k];
    if (v === undefined || v === null || v === "") continue; // fall back to license
    b[k] = v;
  }
  return b;
}

/** live merged branding — updates instantly when Settings → Shop Details saves */
export function useBranding(): Record<string, any> {
  const lic = useLiveQuery(() => getLicense(), undefined);
  const o = useLiveQuery(() => getOverrides(), undefined);
  return mergeBranding(lic?.branding, o);
}

/** feature flag from the license (admin panel) — on unless explicitly disabled */
export function useFeature(key: string): boolean {
  const lic = useLiveQuery(() => getLicense(), undefined);
  if (!lic) return true;
  return (lic.features ?? DEFAULT_FEATURES)[key] !== false;
}

/** current receipt language from Settings (falls back while loading) */
export function useReceiptLang(): "en" | "ur" | "both" | undefined {
  const v = useLiveQuery(() => getSetting("receiptLang"), undefined);
  return v === "ur" || v === "both" ? v : v === "en" ? "en" : undefined;
}

/* ------------------------------------------------------------------ */
/* WhatsApp receipt sharing (feature flag: whatsappReceipt)            */
/* ------------------------------------------------------------------ */

const TXT = {
  en: {
    title: "SALES RECEIPT",
    date: "Date",
    customer: "Customer",
    item: "Item",
    qty: "Qty",
    disc: "Disc",
    subtotal: "Subtotal",
    discount: "Discount",
    tax: "Tax",
    total: "TOTAL",
    paid: "Paid",
    thanks: "Thank you for shopping with us!",
  },
  ur: {
    title: "فروخت کی رسید",
    date: "تاریخ",
    customer: "گاہک",
    item: "شے",
    qty: "تعداد",
    disc: "رعایت",
    subtotal: "ذیلی کل",
    discount: "رعایت",
    tax: "ٹیکس",
    total: "کل",
    paid: "ادائیگی",
    thanks: "خریداری کا شکریہ!",
  },
} as const;

/** plain-text version of a receipt, formatted for WhatsApp messages */
export function receiptText(
  sale: Sale,
  branding: Record<string, any>,
  lang: "en" | "ur" | "both" = "en",
): string {
  const L = TXT[lang === "ur" ? "ur" : "en"];
  const cur = String(branding.currency ?? "Rs");
  const f = (n: number) => Math.round(n).toLocaleString("en-US");
  const lines: string[] = [];

  const shop = String(branding.shopName ?? "").trim();
  if (shop) lines.push(`*${shop}*`);
  const shopUr = String(branding.shopNameUr ?? "").trim();
  if ((lang === "ur" || lang === "both") && shopUr) lines.push(`*${shopUr}*`);
  const addr = String(branding.address ?? "").trim();
  if (addr) lines.push(addr);
  const ph = String(branding.phone ?? "").trim();
  if (ph) lines.push(ph);
  if (lines.length) lines.push("");

  lines.push(`*${L.title}* — ${sale.receiptNo ?? `#${sale.id}`}`);
  lines.push(`${L.date}: ${new Date(sale.ts).toLocaleString("en-GB")}`);
  if (sale.customerName || sale.customerPhone) {
    lines.push(
      `${L.customer}: ${`${sale.customerName ?? ""} ${sale.customerPhone ?? ""}`.trim()}`,
    );
  }
  lines.push("");

  sale.items.forEach((i, idx) => {
    const size =
      i.size && i.size !== "No Size"
        ? ` (${i.size}${i.color ? `/${i.color}` : ""})`
        : i.color
          ? ` (${i.color})`
          : "";
    lines.push(`${idx + 1}. ${i.name}${size}`);
    lines.push(
      `   ${L.qty} ${i.qty} × ${f(i.unitPrice)}${i.discount ? ` − ${L.disc} ${f(i.discount)}` : ""} = ${f(i.qty * i.unitPrice - i.discount)}`,
    );
  });
  lines.push("");

  lines.push(`${L.subtotal}: ${cur} ${f(sale.subtotal)}`);
  if (sale.discount) lines.push(`${L.discount}: −${cur} ${f(sale.discount)}`);
  if (sale.tax)
    lines.push(`${String(branding.taxName ?? L.tax)}: ${cur} ${f(sale.tax)}`);
  lines.push(`*${L.total}: ${cur} ${f(sale.total)}*`);
  if (sale.payments.length) {
    lines.push(
      `${L.paid} (${sale.payments.map((p) => p.method).join("+")}): ${cur} ${f(sale.payments.reduce((a, p) => a + p.amount, 0))}`,
    );
  }
  const footerEn = String(branding.footerEn ?? "").trim();
  const footerUr = String(branding.footerUr ?? "").trim();
  if (footerEn && lang !== "ur") lines.push("", footerEn);
  if (footerUr && (lang === "ur" || lang === "both")) lines.push("", footerUr);
  lines.push("", L.thanks);
  return lines.join("\n");
}

/**
 * Open WhatsApp with the receipt text. Uses the customer's number when known
 * (else WhatsApp's own contact picker). Language follows Settings →
 * Receipt Language at the moment of sending.
 */
export async function shareReceiptOnWhatsApp(
  sale: Sale,
  branding: Record<string, any>,
  phone?: string,
) {
  const lang = ((await getSetting("receiptLang")) ?? "en") as
    | "en"
    | "ur"
    | "both";
  const digits = String(phone ?? sale.customerPhone ?? "").replace(/\D/g, "");
  const text = encodeURIComponent(receiptText(sale, branding, lang));
  window.open(
    digits
      ? `https://wa.me/${digits}?text=${text}`
      : `https://wa.me/?text=${text}`,
    "_blank",
    "noopener,noreferrer",
  );
}
