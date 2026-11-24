"use client";
// A4 full-page sales receipt. Labels come from the sale's own receiptLang
// (set at checkout from Settings → Receipt Language), NOT from the UI
// language — so an English UI can still print an Urdu receipt.
import type { Sale } from "@/lib/db";
import { useState } from "react";

const T = {
  en: {
    title: "SALES RECEIPT",
    receiptNo: "Receipt No",
    date: "Date",
    customer: "Customer",
    walkIn: "Walk-in customer",
    phone: "Phone",
    address: "Address",
    no: "#",
    item: "Item",
    size: "Size",
    color: "Color",
    qty: "Qty",
    rate: "Rate",
    disc: "Disc.",
    amount: "Amount",
    subtotal: "Subtotal",
    discount: "Discount",
    tax: "Tax",
    total: "TOTAL",
    paid: "Paid",
    change: "Change",
    paymentMethod: "Payment Method",
    items: "items",
    thanks: "Thank you for shopping with us!",
    watermark: "UNPAID — NOT A VALID INVOICE",
    paymentPending: "PAYMENT PENDING",
  },
  ur: {
    title: "فروخت کی رسید",
    receiptNo: "رسید نمبر",
    date: "تاریخ",
    customer: "گاہک",
    walkIn: "عام گاہک",
    phone: "فون",
    address: "پتہ",
    no: "#",
    item: "شے",
    size: "سائز",
    color: "رنگ",
    qty: "تعداد",
    rate: "ریٹ",
    disc: "رعایت",
    amount: "قیمت",
    subtotal: "ذیلی کل",
    discount: "رعایت",
    tax: "ٹیکس",
    total: "کل",
    paid: "ادائیگی",
    change: "واپسی",
    paymentMethod: "ادائیگی کا طریقہ",
    items: "اشیاء",
    thanks: "خریداری کا شکریہ!",
    watermark: "ادا نہیں شدہ — درست رسید نہیں",
    paymentPending: "ادائیگی باقی ہے",
  },
} as const;

const PAY_UR: Record<string, string> = {
  cash: "نقد",
  card: "کارڈ",
  transfer: "بینک ٹرانسفر",
  wallet: "موبائل والٹ",
  credit: "کھاتہ (ادھار)",
};

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

function Row({ l, v, bold }: { l: string; v: string; bold?: boolean }) {
  return (
    <div
      className={`flex justify-between ${bold ? "font-semibold" : "text-black/80"}`}
    >
      <span>{l}</span>
      <span className="num">{v}</span>
    </div>
  );
}

export function Receipt({
  sale,
  branding,
  watermark,
}: {
  sale: Sale;
  branding: Record<string, any>;
  watermark?: boolean;
}) {
  const lang = sale.receiptLang ?? "en";
  const L = T[lang === "ur" ? "ur" : "en"];
  const both = lang === "both"; // bilingual: English labels + Urdu accents
  const ur = lang === "ur" || both;
  const cur = String(branding.currency ?? "Rs");
  const taxName = String(branding.taxName ?? "Tax");
  // logo: license branding logoUrl wins; otherwise the shop's own
  // public/icons/logo.png (bundled with the app) is used automatically
  const logo = String(branding.logoUrl ?? "") || "/icons/logo.png";
  const [logoOk, setLogoOk] = useState(true);
  const cash = sale.payments.find((p) => p.method === "cash");
  const change = cash ? cash.amount - sale.total : 0;
  const custName = sale.customerName?.trim();
  const custPhone = sale.customerPhone?.trim();
  const custAddr = sale.customerAddress?.trim();
  const no = sale.receiptNo ?? `#${sale.id}`;
  const itemCount = sale.items.reduce((a, i) => a + i.qty, 0);
  const shopName = String(branding.shopName ?? "");
  const shopNameUr = String(branding.shopNameUr ?? "");
  const footerEn = String(branding.footerEn ?? "");
  const footerUr = String(branding.footerUr ?? "");

  return (
    <div className="w-full bg-white px-1 py-2 text-[13px] leading-relaxed text-black sm:px-2">
      {/* shop header */}
      <div className="text-center">
        {logo && logoOk && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={logo}
            alt="logo"
            className="mx-auto mb-2 h-20 max-w-[240px] object-contain"
            onError={() => setLogoOk(false)}
          />
        )}
        {shopName && (
          <p className="text-[26px] font-extrabold leading-tight tracking-wide">
            {shopName}
          </p>
        )}
        {ur && shopNameUr && (
          <p className="urdu text-xl font-bold leading-loose">{shopNameUr}</p>
        )}
        {String(branding.address ?? "") && (
          <p className="text-[12px] text-black/80">
            {String(branding.address ?? "")}
          </p>
        )}
        {String(branding.phone ?? "") && (
          <p className="num text-[12px] text-black/80">
            {String(branding.phone ?? "")}
          </p>
        )}
      </div>

      <div className="my-3 border-t-2 border-black" />

      {/* title + receipt no */}
      <div className="flex flex-wrap items-baseline justify-between gap-1">
        <h2 className="text-lg font-extrabold tracking-widest">
          {L.title}
          {both && <span className="urdu ml-2 font-bold">فروخت کی رسید</span>}
        </h2>
        <span className="num text-sm font-bold">{no}</span>
      </div>
      <div className="mt-0.5 flex flex-wrap justify-between gap-x-4 text-[11.5px] text-black/70">
        <span>
          {L.date}:{" "}
          <span className="num">
            {new Date(sale.ts).toLocaleString("en-GB")}
          </span>
        </span>
        <span className="num">
          {itemCount} {L.items}
        </span>
      </div>

      {/* customer */}
      <div className="mt-3 rounded border border-black/50 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-black/50">
          {L.customer}
        </p>
        <p className="font-semibold">
          {custName ?? L.walkIn}
          {custPhone ? (
            <span className="num ml-3 font-normal text-black/70">
              {custPhone}
            </span>
          ) : null}
        </p>
        {custAddr && <p className="text-[12px] text-black/70">{custAddr}</p>}
      </div>

      {/* items */}
      <table className="mt-4 w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="border-y-2 border-black bg-black/[0.04] text-left">
            <th className="w-8 px-1.5 py-1.5 font-semibold">{L.no}</th>
            <th className="px-1.5 py-1.5 font-semibold">{L.item}</th>
            <th className="px-1.5 py-1.5 font-semibold">{L.size}</th>
            <th className="px-1.5 py-1.5 font-semibold">{L.color}</th>
            <th className="px-1.5 py-1.5 text-right font-semibold">{L.qty}</th>
            <th className="px-1.5 py-1.5 text-right font-semibold">{L.rate}</th>
            <th className="px-1.5 py-1.5 text-right font-semibold">{L.disc}</th>
            <th className="px-1.5 py-1.5 text-right font-semibold">
              {L.amount}
            </th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((i, idx) => (
            <tr
              key={`${i.variantId}-${i.sku}-${idx}`}
              className="border-b border-black/15 align-top"
            >
              <td className="num px-1.5 py-1.5 text-black/60">{idx + 1}</td>
              <td className="px-1.5 py-1.5 font-medium">
                {i.name}
                {ur && i.nameUr ? (
                  <span className="urdu block text-[12px] text-black/70">
                    {i.nameUr}
                  </span>
                ) : null}
              </td>
              <td className="px-1.5 py-1.5">{i.size}</td>
              <td className="px-1.5 py-1.5">{i.color}</td>
              <td className="num px-1.5 py-1.5 text-right">{i.qty}</td>
              <td className="num px-1.5 py-1.5 text-right">
                {fmt(i.unitPrice)}
              </td>
              <td className="num px-1.5 py-1.5 text-right">
                {i.discount > 0 ? fmt(i.discount) : "—"}
              </td>
              <td className="num px-1.5 py-1.5 text-right font-semibold">
                {fmt(i.qty * i.unitPrice - i.discount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* payment + totals */}
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:justify-between">
        <div className="space-y-0.5 text-[12.5px] sm:max-w-[45%]">
          <p className="font-semibold">{L.paymentMethod}</p>
          {sale.payments.length === 0 ? (
            <p className="font-bold text-red-700">
              {L.paymentPending}
              {both && <span className="urdu ml-2">ادائیگی باقی ہے</span>}
            </p>
          ) : (
            sale.payments.map((p) => (
              <p key={p.method}>
                {cur} {fmt(p.amount)}{" "}
                <span className="text-black/60">
                  — {p.method}
                  {ur && PAY_UR[p.method] ? (
                    <span className="urdu"> · {PAY_UR[p.method]}</span>
                  ) : null}
                </span>
              </p>
            ))
          )}
          {change > 0 && (
            <p>
              {L.change}:{" "}
              <span className="num font-semibold">
                {cur} {fmt(change)}
              </span>
            </p>
          )}
        </div>
        <div className="w-full space-y-1 text-[13px] sm:max-w-[46%]">
          <Row l={L.subtotal} v={`${cur} ${fmt(sale.subtotal)}`} />
          <Row l={L.discount} v={`${cur} ${fmt(sale.discount)}`} />
          <Row
            l={sale.tax > 0 ? `${taxName}` : L.tax}
            v={`${cur} ${fmt(sale.tax)}`}
          />
          <div className="mt-1 flex justify-between border-t-2 border-black pt-1.5 text-[15px] font-extrabold">
            <span>{L.total}</span>
            <span className="num">
              {cur} {fmt(sale.total)}
            </span>
          </div>
        </div>
      </div>

      {/* footer */}
      <div className="mt-8 border-t border-dashed border-black/50 pt-3 text-center text-[12px]">
        <p className="font-semibold">
          {L.thanks}
          {both && <span className="urdu ml-2">خریداری کا شکریہ!</span>}
        </p>
        {footerEn && <p className="text-black/70">{footerEn}</p>}
        {ur && footerUr && <p className="urdu text-black/70">{footerUr}</p>}
      </div>

      {watermark && (
        <p className="mt-4 text-center text-base font-extrabold tracking-wide text-red-700">
          {L.watermark}
        </p>
      )}
    </div>
  );
}
