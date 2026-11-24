"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import { download, money, ymd } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useLiveQuery } from "dexie-react-hooks";
import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Reports() {
  const { t } = useT();
  const [from, setFrom] = useState(ymd(new Date()));
  const [to, setTo] = useState(ymd(new Date()));
  const [range, setRange] = useState({ from: from, to: to });

  const data = useLiveQuery(async () => {
    const start = new Date(range.from + "T00:00:00").getTime();
    const end = new Date(range.to + "T23:59:59").getTime();
    const sales = (
      await db.sales.where("ts").between(start, end).toArray()
    ).filter((s) => s.status === "paid");
    const revenue = sales.reduce((a, s) => a + s.total, 0);
    let profit = 0;
    const bySku = new Map<
      string,
      { name: string; qty: number; revenue: number; profit: number }
    >();
    const mix = new Map<string, number>();
    for (const s of sales) {
      for (const i of s.items) {
        profit += i.qty * i.unitPrice - i.discount - i.qty * i.cost;
        const r = bySku.get(i.sku) ?? {
          name: i.name,
          qty: 0,
          revenue: 0,
          profit: 0,
        };
        r.qty += i.qty;
        r.revenue += i.qty * i.unitPrice - i.discount;
        r.profit += i.qty * i.unitPrice - i.discount - i.qty * i.cost;
        bySku.set(i.sku, r);
      }
      for (const p of s.payments)
        mix.set(p.method, (mix.get(p.method) ?? 0) + p.amount);
    }
    const low = (await db.variants.toArray()).filter(
      (v) => v.stock <= v.reorderLevel,
    );
    return {
      revenue,
      profit,
      count: sales.length,
      rows: [...bySku.values()].sort((a, b) => b.revenue - a.revenue),
      mix: [...mix.entries()],
      low,
    };
  }, [range]);

  const cur = "Rs";
  function csv() {
    const esc = (v: any) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [
      ["SKU", "Name", "Qty", "Revenue", "Profit"],
      ...(data?.rows ?? []).map((r) => [
        esc(r.name),
        esc(r.name),
        r.qty,
        r.revenue,
        Math.round(r.profit),
      ]),
    ];
    download(
      `sales-${range.from}-${range.to}.csv`,
      "\uFEFF" + lines.map((l) => l.join(",")).join("\n"),
      "text/csv",
    );
    toast.success(t("export"));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">{t("from")}</p>
          <Input
            type="date"
            className="num w-40"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">{t("to")}</p>
          <Input
            type="date"
            className="num w-40"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={() => setRange({ from, to })}>
          {t("apply")}
        </Button>
        <Button variant="outline" onClick={csv}>
          <Download className="mr-1.5 size-4" />
          {t("export")}
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["revenue", money(data?.revenue ?? 0, cur), "text-emerald-600"],
          ["profit", money(data?.profit ?? 0, cur), "text-emerald-600"],
          ["transactions", String(data?.count ?? 0), ""],
        ].map(([k, v, cls]) => (
          <Card key={k}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{t(k)}</p>
              <p className={`num mt-1 text-xl font-semibold ${cls}`}>{v}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-4">
          <h2 className="mb-2 text-sm font-semibold">{t("salesByProduct")}</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1.5">{t("name")}</th>
                <th>{t("qty")}</th>
                <th>{t("revenue")}</th>
                <th>{t("profit")}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.rows ?? []).slice(0, 25).map((r) => (
                <tr key={r.name + r.qty} className="border-b last:border-0">
                  <td className="py-1.5">{r.name}</td>
                  <td className="num">{r.qty}</td>
                  <td className="num">{money(r.revenue, cur)}</td>
                  <td className="num text-emerald-600">
                    {money(r.profit, cur)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data?.rows ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("noData")}
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <h2 className="mb-2 text-sm font-semibold">{t("lowStockReport")}</h2>
          {(data?.low ?? []).map((v) => (
            <div
              key={v.id}
              className="flex justify-between border-b py-1.5 text-sm last:border-0"
            >
              <span className="num text-muted-foreground">{v.sku}</span>
              <span className="num font-medium text-red-600">
                {v.stock} / {v.reorderLevel}
              </span>
            </div>
          ))}
          {(data?.low ?? []).length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("noData")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
