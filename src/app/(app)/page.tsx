"use client";
import { useReceiptPrinter } from "@/components/PrintReceipt";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db, getSetting, type Sale } from "@/lib/db";
import { dayStart, money } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { getLicense } from "@/lib/license";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertTriangle,
  PackageX,
  Printer,
  ShoppingBag,
  TrendingUp,
  UserRound,
  Wallet,
} from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  const { t } = useT();
  const lic = useLiveQuery(() => getLicense(), undefined);
  const branding = lic?.branding ?? {};
  const cur = String(branding.currency ?? "Rs");
  const { print, holder } = useReceiptPrinter(branding);

  const agg = useLiveQuery(async () => {
    const sales = await db.sales
      .where("ts")
      .between(dayStart(), Date.now())
      .toArray();
    const paid = sales.filter((s) => s.status === "paid");
    const revenue = paid.reduce((a, s) => a + s.total, 0);
    const low = (await db.variants.toArray()).filter(
      (v) => v.stock <= v.reorderLevel,
    );
    const recentRaw = await db.sales.orderBy("ts").reverse().limit(8).toArray();
    // resolve buyer info for sales that predate customer snapshots
    const needIds = [
      ...new Set(
        recentRaw
          .filter((s) => !s.customerName && !s.customerPhone && s.customerId)
          .map((s) => s.customerId!),
      ),
    ];
    const cmap = new Map(
      needIds.length
        ? (
            (await db.customers.bulkGet(needIds)).filter(Boolean) as {
              id: number;
              name: string;
              phone: string;
            }[]
          ).map((c) => [c.id, c])
        : [],
    );
    const recent: (Sale & {
      buyerName?: string;
      buyerPhone?: string;
    })[] = recentRaw.map((s) => {
      const c = s.customerId ? cmap.get(s.customerId) : undefined;
      return {
        ...s,
        buyerName: s.customerName ?? c?.name,
        buyerPhone: s.customerPhone ?? c?.phone,
      };
    });
    const lastBackup = (await getSetting("lastBackupAt")) as number | undefined;
    return {
      revenue,
      count: paid.length,
      low,
      recent,
      backupStale: !lastBackup || Date.now() - lastBackup > 7 * 86_400_000,
    };
  }, []);
  if (!agg) return null;
  const K = [
    {
      icon: TrendingUp,
      label: t("revenue"),
      v: money(agg.revenue, cur),
      cls: "text-emerald-600",
    },
    {
      icon: ShoppingBag,
      label: t("transactions"),
      v: String(agg.count),
      cls: "",
    },
    {
      icon: Wallet,
      label: t("avgBasket"),
      v: money(agg.count ? agg.revenue / agg.count : 0, cur),
      cls: "",
    },
    {
      icon: PackageX,
      label: t("lowStock"),
      v: String(agg.low.length),
      cls: "text-red-600",
    },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {K.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{k.label}</span>
                <k.icon className="size-4" />
              </div>
              <p className={`num mt-1 text-xl font-semibold ${k.cls}`}>{k.v}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {agg.backupStale && (
        <Link
          href="/settings"
          className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          <AlertTriangle className="size-4 shrink-0" />
          {t("backupReminder")}
        </Link>
      )}
      <Card>
        <CardContent className="p-4">
          <h2 className="mb-2 text-sm font-semibold">{t("recentSales")}</h2>
          {agg.recent.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("noData")}</p>
          )}
          <div className="divide-y">
            {agg.recent.map((s) => (
              <div key={s.id} className="flex items-center gap-2 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="num text-muted-foreground">
                      #{s.receiptNo ?? s.id}
                    </span>
                    <span className="num text-xs text-muted-foreground">
                      {new Date(s.ts).toLocaleString("en-GB")}
                    </span>
                    {s.buyerName || s.buyerPhone ? (
                      <span className="flex min-w-0 items-center gap-1 text-xs">
                        <UserRound className="size-3 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">
                          {s.buyerName ?? t("customer")}
                        </span>
                        {s.buyerPhone && (
                          <span className="num truncate text-muted-foreground">
                            · {s.buyerPhone}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {t("walkIn")}
                      </span>
                    )}
                  </p>
                  <p className="num mt-0.5 text-xs text-muted-foreground">
                    {s.items.reduce((a, i) => a + i.qty, 0)} {t("items")}
                  </p>
                </div>
                <span
                  className={`num shrink-0 font-semibold ${s.status === "paid" ? "text-emerald-600" : "text-muted-foreground"}`}
                >
                  {money(s.total, cur)} · {s.status}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 shrink-0"
                  title={t("print")}
                  onClick={() => print(s)}
                >
                  <Printer className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {holder}
    </div>
  );
}
