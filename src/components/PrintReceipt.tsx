"use client";
// Shared receipt printer: renders an off-screen A4 print target and exposes
// print(sale). window.print() + the @media print rules in globals.css make
// only the receipt visible on paper. Works from any page (POS, dashboard,
// reports, customer history).
import { Receipt } from "@/components/Receipt";
import type { Sale } from "@/lib/db";
import { useEffect, useRef, useState } from "react";

export function useReceiptPrinter(branding: Record<string, any>) {
  const [target, setTarget] = useState<{ sale: Sale; n: number } | null>(null);
  const printed = useRef(0);

  useEffect(() => {
    // the ref guard makes this run once per click even in React strict mode
    if (target && target.n !== printed.current) {
      printed.current = target.n;
      window.print();
    }
  }, [target]);

  const print = (sale: Sale) =>
    setTarget((t) => ({ sale, n: (t?.n ?? 0) + 1 }));

  const holder = (
    <div className="receipt-holder">
      <div id="receipt-print">
        {target && <Receipt sale={target.sale} branding={branding} />}
      </div>
    </div>
  );

  return { print, holder };
}
