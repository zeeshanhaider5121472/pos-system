"use client";
import {
  BarList,
  CHART_COLORS,
  ChartCard,
  SegmentedToggle,
  SharePie,
  TrendChart,
} from "@/components/Charts";
import { useReceiptPrinter } from "@/components/PrintReceipt";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  shareReceiptOnWhatsApp,
  useBranding,
  useFeature,
} from "@/lib/branding";
import { db } from "@/lib/db";
import { download, money, ymd } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BarChart3,
  Download,
  LineChart,
  MessageCircle,
  PieChart,
  Printer,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type RT = "All Product" | "All Sales" | "All Customers";
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

export default function Reports() {
  const { t } = useT();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [rt, setRt] = useState<RT>("All Sales");
  const [dailyType, setDailyType] = useState<"line" | "pie">("line");
  const [mixType, setMixType] = useState<"pie" | "bars">("pie");

  // default range = last 30 days, computed on the client only (new Date()
  // must not run during the prerender pass with Cache Components)
  useEffect(() => {
    const f = ymd(addDays(new Date(), -29));
    const t2 = ymd(new Date());
    setFrom(f);
    setTo(t2);
    setRange({ from: f, to: t2 });
  }, []);

  const branding = useBranding();
  const cur = String(branding.currency ?? "Rs");
  const whatsappOn = useFeature("whatsappReceipt");
  const { print, holder } = useReceiptPrinter(branding);

  const data = useLiveQuery(async () => {
    if (!range) return null;
    const start = new Date(range.from + "T00:00:00").getTime();
    const end = new Date(range.to + "T23:59:59").getTime();
    const sales = (
      await db.sales.where("ts").between(start, end).toArray()
    ).filter((s) => s.status === "paid");

    // one bucket per day in the range (zeros included) for the line chart
    const days: string[] = [];
    for (
      let d = new Date(range.from + "T00:00:00");
      ymd(d) <= range.to;
      d = addDays(d, 1)
    )
      days.push(ymd(d));
    const daily = new Map<string, { r: number; p: number }>(
      days.map((d) => [d, { r: 0, p: 0 }]),
    );

    let revenue = 0;
    let profit = 0;
    const bySku = new Map<
      string,
      {
        sku: string;
        name: string;
        qty: number;
        revenue: number;
        profit: number;
      }
    >();
    const byCust = new Map<
      string,
      {
        name: string;
        phone: string;
        bills: number;
        items: number;
        spent: number;
      }
    >();
    const mix = new Map<string, number>();

    const bumpCust = (
      key: string,
      name: string,
      phone: string,
      s: (typeof sales)[number],
    ) => {
      const c = byCust.get(key) ?? {
        name,
        phone,
        bills: 0,
        items: 0,
        spent: 0,
      };
      c.bills++;
      c.items += s.items.reduce((a, i) => a + i.qty, 0);
      c.spent += s.total;
      byCust.set(key, c);
    };

    for (const s of sales) {
      revenue += s.total;
      let sProfit = 0;
      for (const i of s.items) {
        const pr = i.qty * i.unitPrice - i.discount - i.qty * i.cost;
        sProfit += pr;
        const r = bySku.get(i.sku) ?? {
          sku: i.sku,
          name: i.name,
          qty: 0,
          revenue: 0,
          profit: 0,
        };
        r.qty += i.qty;
        r.revenue += i.qty * i.unitPrice - i.discount;
        r.profit += pr;
        bySku.set(i.sku, r);
      }
      profit += sProfit;
      const dd = daily.get(ymd(new Date(s.ts)));
      if (dd) {
        dd.r += s.total;
        dd.p += Math.round(sProfit);
      }
      if (s.customerPhone || s.customerName)
        bumpCust(
          s.customerPhone || s.customerName!,
          s.customerName || s.customerPhone!,
          s.customerPhone ?? "",
          s,
        );
      // attribute the SALE total to each payment method (cash tendered
      // includes change, so raw p.amount would overstate revenue)
      const paySum = s.payments.reduce((a, x) => a + x.amount, 0);
      for (const p of s.payments)
        mix.set(
          p.method,
          (mix.get(p.method) ?? 0) +
            (paySum > 0 ? (p.amount / paySum) * s.total : 0),
        );
    }

    // older sales (before customer snapshots) — resolve via customerId
    const legacy = sales.filter(
      (s) => !s.customerPhone && !s.customerName && s.customerId,
    );
    if (legacy.length) {
      const cs = (
        await db.customers.bulkGet([
          ...new Set(legacy.map((s) => s.customerId!)),
        ])
      ).filter(Boolean) as { id: number; name: string; phone: string }[];
      const cmap = new Map(cs.map((c) => [c.id, c]));
      for (const s of legacy) {
        const c = cmap.get(s.customerId!);
        if (c) bumpCust(c.phone || c.name, c.name, c.phone, s);
      }
    }

    const low = (await db.variants.toArray()).filter(
      (v) => v.stock <= v.reorderLevel,
    );
    return {
      revenue,
      profit,
      count: sales.length,
      avg: sales.length ? revenue / sales.length : 0,
      daily: days.map((d) => ({ d, ...(daily.get(d) ?? { r: 0, p: 0 }) })),
      rows: [...bySku.values()].sort((a, b) => b.revenue - a.revenue),
      byCust: [...byCust.values()].sort((a, b) => b.spent - a.spent),
      sales: [...sales].sort((a, b) => b.ts - a.ts),
      mix: [...mix.entries()].sort((a, b) => b[1] - a[1]),
      low,
    };
  }, [range]);

  function csv(name: string, headers: string[], rows: (string | number)[][]) {
    if (!range) return;
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const body = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    download(
      `${name}-${range.from}-${range.to}.csv`,
      "\uFEFF" + body,
      "text/csv",
    );
    toast.success(t("export"));
  }
  function exportCurrent() {
    if (!range) return;
    if (rt === "All Product")
      csv(
        "sales-by-product",
        ["SKU", "Name", "Qty", "Revenue", "Profit"],
        (data?.rows ?? []).map((r) => [
          r.sku,
          r.name,
          r.qty,
          Math.round(r.revenue),
          Math.round(r.profit),
        ]),
      );
    else if (rt === "All Sales")
      csv(
        "all-sales",
        ["Receipt", "Date", "Customer", "Phone", "Items", "Payment", "Total"],
        (data?.sales ?? []).map((s) => [
          s.receiptNo ?? `#${s.id}`,
          new Date(s.ts).toLocaleString("en-GB"),
          s.customerName ?? t("walkIn"),
          s.customerPhone ?? "",
          s.items.reduce((a, i) => a + i.qty, 0),
          s.payments.map((p) => p.method).join("+") || "held",
          s.total,
        ]),
      );
    else
      csv(
        "sales-by-customer",
        ["Name", "Phone", "Bills", "Items", "TotalSpent"],
        (data?.byCust ?? []).map((c) => [
          c.name,
          c.phone,
          c.bills,
          c.items,
          Math.round(c.spent),
        ]),
      );
  }

  const tableHead = "border-b text-left text-xs text-muted-foreground";
  const fmt = (n: number) => money(n, cur);

  if (!range)
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <RefreshCw className="size-6 animate-spin text-muted-foreground" />
      </div>
    );

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
        <div className="min-w-44">
          <p className="mb-1 text-xs text-muted-foreground">
            {t("reportType")}
          </p>
          <Select value={rt} onValueChange={(v) => v && setRt(v as RT)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All Sales">{t("allSales")}</SelectItem>
              <SelectItem value="All Product">{t("salesByProduct")}</SelectItem>
              <SelectItem value="All Customers">
                {t("salesByCustomer")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={exportCurrent}>
          <Download className="mr-1.5 size-4" />
          {t("export")}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["revenue", money(data?.revenue ?? 0, cur), "text-emerald-600"],
            ["profit", money(data?.profit ?? 0, cur), "text-emerald-600"],
            ["transactions", String(data?.count ?? 0), ""],
            ["avgBasket", money(data?.avg ?? 0, cur), ""],
          ] as const
        ).map(([k, v, cls]) => (
          <Card key={k}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{t(k)}</p>
              <p className={`num mt-1 text-xl font-semibold ${cls}`}>{v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* the big daily chart is collapsible and starts collapsed */}
      <ChartCard
        title={t("dailySales")}
        defaultOpen={false}
        actions={
          <SegmentedToggle
            value={dailyType}
            onChange={setDailyType}
            options={[
              { value: "line", label: t("chartLine"), icon: LineChart },
              { value: "pie", label: t("chartPie"), icon: PieChart },
            ]}
          />
        }
      >
        {dailyType === "line" ? (
          <TrendChart
            rows={(data?.daily ?? []).map((d) => ({
              d: d.d.slice(5),
              r: d.r,
              p: d.p,
            }))}
            xKey="d"
            series={[
              { key: "r", name: t("revenue"), color: CHART_COLORS.emerald },
              { key: "p", name: t("profit"), color: CHART_COLORS.sky },
            ]}
            format={fmt}
          />
        ) : (
          <SharePie
            items={(data?.daily ?? [])
              .filter((d) => d.r > 0)
              .map((d) => ({ name: d.d.slice(5), value: d.r }))}
            format={fmt}
          />
        )}
      </ChartCard>

      {rt === "All Product" && (
        <>
          <ChartCard title={t("topProducts")}>
            <BarList
              items={(data?.rows ?? []).slice(0, 8).map((r) => ({
                label: r.name,
                value: r.revenue,
                sub: `· ${r.qty}`,
              }))}
              format={fmt}
            />
          </ChartCard>
          <Card>
            <CardContent className="p-4">
              <h2 className="mb-2 text-sm font-semibold">
                {t("salesByProduct")}
              </h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className={tableHead}>
                    <th className="py-1.5">{t("sku")}</th>
                    <th>{t("name")}</th>
                    <th>{t("qty")}</th>
                    <th>{t("revenue")}</th>
                    <th>{t("profit")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.rows ?? []).map((r) => (
                    <tr key={r.sku} className="border-b last:border-0">
                      <td className="num py-1.5 text-xs text-muted-foreground">
                        {r.sku}
                      </td>
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
        </>
      )}

      {rt === "All Sales" && (
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-2 text-sm font-semibold">{t("allSales")}</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className="py-1.5">{t("receiptNo")}</th>
                  <th>{t("date")}</th>
                  <th>{t("customer")}</th>
                  <th>{t("items")}</th>
                  <th>{t("method")}</th>
                  <th className="text-right">{t("total")}</th>
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {(data?.sales ?? []).map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="num py-1.5 text-xs">
                      {s.receiptNo ?? `#${s.id}`}
                    </td>
                    <td className="num py-1.5 text-xs text-muted-foreground">
                      {new Date(s.ts).toLocaleString("en-GB")}
                    </td>
                    <td className="max-w-40 truncate py-1.5">
                      {s.customerName ?? t("walkIn")}
                      {s.customerPhone && (
                        <span className="num block text-xs text-muted-foreground">
                          {s.customerPhone}
                        </span>
                      )}
                    </td>
                    <td className="num py-1.5">
                      {s.items.reduce((a, i) => a + i.qty, 0)}
                    </td>
                    <td className="py-1.5 text-xs">
                      {s.payments.map((p) => t(p.method)).join("+")}
                    </td>
                    <td className="num py-1.5 text-right font-medium">
                      {money(s.total, cur)}
                    </td>
                    <td className="py-1.5 text-right">
                      {whatsappOn && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          title={t("whatsapp")}
                          onClick={() => shareReceiptOnWhatsApp(s, branding)}
                        >
                          <MessageCircle className="size-3.5" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        title={t("print")}
                        onClick={() => print(s)}
                      >
                        <Printer className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(data?.sales ?? []).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("noData")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {rt === "All Customers" && (
        <>
          <ChartCard title={t("topCustomers")}>
            <BarList
              color={CHART_COLORS.indigo}
              items={(data?.byCust ?? []).slice(0, 8).map((c) => ({
                label: c.name,
                value: c.spent,
                sub: `· ${c.bills} ${t("bills")}`,
              }))}
              format={fmt}
            />
          </ChartCard>
          <Card>
            <CardContent className="p-4">
              <h2 className="mb-2 text-sm font-semibold">
                {t("salesByCustomer")}
              </h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className={tableHead}>
                    <th className="py-1.5">{t("name")}</th>
                    <th>{t("phone")}</th>
                    <th>{t("bills")}</th>
                    <th>{t("items")}</th>
                    <th className="text-right">{t("totalSpent")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.byCust ?? []).map((c) => (
                    <tr
                      key={c.phone || c.name}
                      className="border-b last:border-0"
                    >
                      <td className="py-1.5">{c.name}</td>
                      <td className="num py-1.5 text-xs text-muted-foreground">
                        {c.phone}
                      </td>
                      <td className="num py-1.5">{c.bills}</td>
                      <td className="num py-1.5">{c.items}</td>
                      <td className="num py-1.5 text-right font-medium">
                        {money(c.spent, cur)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(data?.byCust ?? []).length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t("noData")}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("paymentMix")}
          actions={
            <SegmentedToggle
              value={mixType}
              onChange={setMixType}
              options={[
                { value: "pie", label: t("chartPie"), icon: PieChart },
                { value: "bars", label: t("chartBars"), icon: BarChart3 },
              ]}
            />
          }
        >
          <div className="space-y-3">
            {mixType === "pie" ? (
              <SharePie
                items={(data?.mix ?? []).map(([m, v]) => ({
                  name: t(m),
                  value: v,
                }))}
                format={fmt}
              />
            ) : (
              <BarList
                color={CHART_COLORS.amber}
                items={(data?.mix ?? []).map(([m, v]) => ({
                  label: t(m),
                  value: v,
                }))}
                format={fmt}
              />
            )}
            <div className="flex justify-end border-t pt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  csv(
                    "payment-mix",
                    ["Method", "Amount"],
                    (data?.mix ?? []).map(([m, v]) => [m, Math.round(v)]),
                  )
                }
              >
                <Download className="mr-1 size-3.5" />
                {t("export")}
              </Button>
            </div>
          </div>
        </ChartCard>
        <ChartCard
          title={t("lowStockReport")}
          actions={
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                csv(
                  "low-stock",
                  ["SKU", "Stock", "ReorderAt"],
                  (data?.low ?? []).map((v) => [
                    v.sku,
                    v.stock,
                    v.reorderLevel,
                  ]),
                )
              }
            >
              <Download className="mr-1 size-3.5" />
              {t("export")}
            </Button>
          }
        >
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
        </ChartCard>
      </div>

      {holder}
    </div>
  );
}
