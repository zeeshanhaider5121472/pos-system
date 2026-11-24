"use client";
import { useReceiptPrinter } from "@/components/PrintReceipt";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db, type Customer, type Sale } from "@/lib/db";
import { money } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { getLicense } from "@/lib/license";
import { useLiveQuery } from "dexie-react-hooks";
import { Printer, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Customers() {
  const { t } = useT();
  const [form, setForm] = useState<any>(null);
  const [hist, setHist] = useState<Customer | null>(null);

  const lic = useLiveQuery(() => getLicense(), undefined);
  const branding = lic?.branding ?? {};
  const cur = String(branding.currency ?? "Rs");
  const { print, holder } = useReceiptPrinter(branding);

  const list = useLiveQuery(() => db.customers.orderBy("name").toArray(), []);

  // per-customer bills + spend (matches by customerId OR phone snapshot)
  const stats = useLiveQuery(async () => {
    const sales = await db.sales.toArray();
    const m = new Map<number, { bills: number; spent: number }>();
    for (const s of sales) {
      if (s.status !== "paid") continue;
      const ids = new Set<number>();
      if (s.customerId) ids.add(s.customerId);
      if (s.customerPhone) {
        for (const c of (list ?? []).filter((c) => c.phone === s.customerPhone))
          ids.add(c.id!);
      }
      for (const id of ids) {
        const r = m.get(id) ?? { bills: 0, spent: 0 };
        r.bills++;
        r.spent += s.total;
        m.set(id, r);
      }
    }
    return m;
  }, [list]);

  const histSales = useLiveQuery(async () => {
    if (!hist) return [];
    const all = await db.sales.toArray();
    return all
      .filter(
        (s) =>
          s.customerId === hist.id ||
          (s.customerPhone && s.customerPhone === hist.phone),
      )
      .sort((a, b) => b.ts - a.ts) as Sale[];
  }, [hist]);

  async function save() {
    const f = form;
    try {
      if (f.id)
        await db.customers.update(f.id, {
          name: f.name.trim(),
          phone: f.phone.trim(),
          address: f.address?.trim(),
        });
      else
        await db.customers.add({
          phone: f.phone.trim(),
          name: f.name.trim() || f.phone.trim(),
          address: f.address?.trim(),
          points: 0,
          balance: 0,
        });
      toast.success(t("saved"));
      setForm(null);
    } catch {
      toast.error(t("phone") + " — duplicate");
    }
  }
  async function adjust(c: Customer, d: number) {
    await db.customers.update(c.id!, { balance: Math.max(0, c.balance + d) });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setForm({ phone: "", name: "", address: "" })}>
          <UserPlus className="mr-1.5 size-4" />
          {t("add")}
        </Button>
      </div>
      {(list ?? []).map((c) => {
        const st = stats?.get(c.id!);
        return (
          <Card key={c.id}>
            <CardContent className="flex items-center gap-2 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.name}</p>
                <p className="num text-xs text-muted-foreground">{c.phone}</p>
                <p className="num mt-0.5 text-xs text-muted-foreground">
                  {st?.bills ?? 0} {t("salesLabel")} · {t("totalSpent")}{" "}
                  {money(st?.spent ?? 0, cur)}
                </p>
              </div>
              <span
                className={`num font-semibold ${c.balance > 0 ? "text-red-600" : "text-muted-foreground"}`}
              >
                {money(c.balance, cur)}
              </span>
              {c.balance > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => adjust(c, -c.balance)}
                >
                  Clear
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setHist(c)}>
                {t("history")}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setForm({ ...c })}
              >
                …
              </Button>
            </CardContent>
          </Card>
        );
      })}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? t("edit") : t("add")}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="grid gap-3">
              <div>
                <Label>{t("phone")}</Label>
                <Input
                  className="num"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("name")}</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("address")}</Label>
                <Input
                  value={form.address ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              {t("cancel")}
            </Button>
            <Button onClick={save}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!hist} onOpenChange={(o) => !o && setHist(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {hist?.name} — {t("history")}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[50vh] divide-y overflow-y-auto">
            {(histSales ?? []).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 py-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="num block text-muted-foreground">
                    #{s.receiptNo ?? s.id} ·{" "}
                    {new Date(s.ts).toLocaleString("en-GB")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.status}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="num font-medium">{money(s.total, cur)}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    title={t("print")}
                    onClick={() => print(s)}
                  >
                    <Printer className="size-3.5" />
                  </Button>
                </span>
              </div>
            ))}
            {(histSales ?? []).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("noData")}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {holder}
    </div>
  );
}
