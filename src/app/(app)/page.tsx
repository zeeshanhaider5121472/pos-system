"use client";
import { Card, CardContent } from "@/components/ui/card";
import { db, getSetting } from "@/lib/db";
import { dayStart, money } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertTriangle,
  PackageX,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  const { t } = useT();
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
    const recent = await db.sales.orderBy("ts").reverse().limit(6).toArray();
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
      v: money(agg.revenue),
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
      v: money(agg.count ? agg.revenue / agg.count : 0),
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
              <div
                key={s.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="text-muted-foreground">
                  #{s.id} · {new Date(s.ts).toLocaleString("en-GB")}
                </span>
                <span
                  className={`num font-semibold ${s.status === "paid" ? "text-emerald-600" : "text-muted-foreground"}`}
                >
                  {money(s.total)} · {s.status}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
