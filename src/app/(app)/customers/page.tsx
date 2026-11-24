"use client";
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
import { db, type Customer } from "@/lib/db";
import { money } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useLiveQuery } from "dexie-react-hooks";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Customers() {
  const { t } = useT();
  const [form, setForm] = useState<any>(null);
  const [hist, setHist] = useState<Customer | null>(null);
  const list = useLiveQuery(() => db.customers.orderBy("name").toArray(), []);
  const histSales = useLiveQuery(
    () =>
      hist
        ? db.sales.where("customerId").equals(hist.id!).reverse().sortBy("ts")
        : [],
    [hist],
  );

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
      {(list ?? []).map((c) => (
        <Card key={c.id}>
          <CardContent className="flex items-center gap-2 p-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{c.name}</p>
              <p className="num text-xs text-muted-foreground">{c.phone}</p>
            </div>
            <span
              className={`num font-semibold ${c.balance > 0 ? "text-red-600" : "text-muted-foreground"}`}
            >
              {money(c.balance)}
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
      ))}
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
              <div key={s.id} className="flex justify-between py-2 text-sm">
                <span className="text-muted-foreground">
                  {new Date(s.ts).toLocaleString("en-GB")}
                </span>
                <span className="num font-medium">{money(s.total)}</span>
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
    </div>
  );
}
