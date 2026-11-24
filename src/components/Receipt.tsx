"use client";
import type { Sale } from "@/lib/db";
import { useT } from "@/lib/i18n";

const Row = ({ l, v }: { l: string; v: number }) => (
  <div className="flex justify-between">
    <span>{l}</span>
    <span className="num">{v.toLocaleString()}</span>
  </div>
);

export function Receipt({
  sale,
  branding,
  watermark,
}: {
  sale: Sale;
  branding: Record<string, any>;
  watermark?: boolean;
}) {
  const { t } = useT();
  const lang = sale.receiptLang;
  const ur = lang !== "en";
  const cur = String(branding.currency ?? "Rs");
  const cash = sale.payments.find((p) => p.method === "cash");
  return (
    <div
      id="receipt-print"
      className="w-[72mm] bg-white p-1 text-[11px] leading-snug text-black"
    >
      <div className="text-center">
        <p className="text-base font-bold">{String(branding.shopName ?? "")}</p>
        {ur && (
          <p className="urdu text-base font-bold">
            {String(branding.shopNameUr ?? "")}
          </p>
        )}
        <p>{String(branding.address ?? "")}</p>
        <p>{String(branding.phone ?? "")}</p>
      </div>
      <div className="my-1 flex justify-between border-y border-dashed border-black py-1">
        <span>#{sale.id}</span>
        <span>{new Date(sale.ts).toLocaleString("en-GB")}</span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-black text-left">
            <th>Item</th>
            <th>{t("qty")}</th>
            <th>{t("price")}</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((i) => (
            <tr key={`${i.variantId}-${i.sku}`} className="align-top">
              <td>
                {i.name}
                {ur && i.nameUr ? (
                  <span className="urdu block">{i.nameUr}</span>
                ) : null}
                <span className="block text-[9px]">
                  {i.size}/{i.color}
                </span>
              </td>
              <td className="num">{i.qty}</td>
              <td className="num">{i.unitPrice}</td>
              <td className="num text-right">
                {i.qty * i.unitPrice - i.discount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 space-y-0.5 border-t border-dashed border-black pt-1">
        <Row l={t("subtotal")} v={sale.subtotal} />
        <Row l={t("discount")} v={-sale.discount} />
        <Row l={t("tax")} v={sale.tax} />
        <div className="flex justify-between text-sm font-bold">
          <span>{t("total")}</span>
          <span className="num">
            {cur} {sale.total.toLocaleString()}
          </span>
        </div>
        {sale.payments.map((p) => (
          <Row key={p.method} l={t(p.method)} v={p.amount} />
        ))}
        {cash && cash.amount > sale.total && (
          <Row l={t("change")} v={cash.amount - sale.total} />
        )}
      </div>
      {watermark && (
        <p className="mt-2 text-center font-bold text-red-700">
          {t("watermark")}
        </p>
      )}
      <p className="mt-2 text-center">{t("thanks")}</p>
      <p className={ur ? "urdu text-center" : "text-center"}>
        {ur ? String(branding.footerUr ?? "") : String(branding.footerEn ?? "")}
      </p>
    </div>
  );
}
