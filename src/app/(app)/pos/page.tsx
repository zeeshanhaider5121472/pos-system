"use client";
import { Receipt } from "@/components/Receipt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db, getSetting, type Payment, type Sale } from "@/lib/db";
import { money } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { canSell, evaluateLicense, getLicense } from "@/lib/license";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Lock,
  Minus,
  Pause,
  Plus,
  Printer,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";

type Line = {
  variantId: number;
  sku: string;
  name: string;
  nameUr?: string;
  size: string;
  color: string;
  qty: number;
  unitPrice: number;
  cost: number;
  discount: number;
};
const METHODS: Payment["method"][] = [
  "cash",
  "card",
  "transfer",
  "wallet",
  "credit",
];

export default function POS() {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [method, setMethod] = useState<Payment["method"]>("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [phone, setPhone] = useState("");
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [sellable, setSellable] = useState(true);
  const receiptRef = useRef<HTMLDivElement>(null);
  const print = useReactToPrint({ contentRef: receiptRef });

  const lic = useLiveQuery(() => getLicense(), undefined);
  const branding = (lic as any)?.d?.branding ?? {};
  const taxRate = Number(branding.taxRate) || 0;
  const cur = String(branding.currency ?? "Rs");

  useEffect(() => {
    evaluateLicense().then((r) => setSellable(canSell(r.state)));
  }, []);
  const rows = useLiveQuery(async () => {
    const vs = await db.variants.toArray();
    const ps = await db.products.toArray();
    const m = new Map(ps.map((p) => [p.id!, p]));
    return vs.map((v) => ({
      ...v,
      name: m.get(v.productId)?.name ?? "",
      nameUr: m.get(v.productId)?.nameUr,
      category: m.get(v.productId)?.category ?? "",
    }));
  }, []);

  const shown = useMemo(
    () =>
      (rows ?? []).filter((v) =>
        (v.name + v.sku + v.size + v.color + v.category)
          .toLowerCase()
          .includes(q.toLowerCase()),
      ),
    [rows, q],
  );
  const totals = useMemo(() => {
    const subtotal = cart.reduce((a, l) => a + l.unitPrice * l.qty, 0);
    const discount = cart.reduce((a, l) => a + l.discount, 0);
    const tax = Math.round((subtotal - discount) * taxRate) / 100;
    return {
      subtotal,
      discount,
      tax,
      total: Math.round(subtotal - discount + tax),
    };
  }, [cart, taxRate]);

  function add(v: any) {
    const inCart = cart.find((l) => l.variantId === v.id)?.qty ?? 0;
    if (v.stock - inCart < 1) return toast.error(t("outOfStock"));
    setCart((c) => {
      const i = c.findIndex((l) => l.variantId === v.id);
      if (i >= 0) {
        const n = [...c];
        n[i] = { ...n[i], qty: n[i].qty + 1 };
        return n;
      }
      return [
        ...c,
        {
          variantId: v.id!,
          sku: v.sku,
          name: v.name,
          nameUr: v.nameUr,
          size: v.size,
          color: v.color,
          qty: 1,
          unitPrice: v.price,
          cost: v.costPrice,
          discount: 0,
        },
      ];
    });
  }
  const bump = (id: number, d: number) =>
    setCart((c) =>
      c
        .map((l) => (l.variantId === id ? { ...l, qty: l.qty + d } : l))
        .filter((l) => l.qty > 0),
    );

  async function makeSale(status: "paid" | "held"): Promise<Sale | null> {
    const r = await evaluateLicense();
    if (!canSell(r.state)) {
      toast.error(t("subExpired"));
      return null;
    }
    if (cart.length === 0) return null;
    let customerId: number | undefined;
    if (phone.trim()) {
      const ex = await db.customers.where("phone").equals(phone.trim()).first();
      customerId =
        ex?.id ??
        (await db.customers.add({
          phone: phone.trim(),
          name: phone.trim(),
          points: 0,
          balance: 0,
        }));
    }
    const receiptLang = ((await getSetting("receiptLang")) ?? "en") as
      | "en"
      | "ur"
      | "both";
    const payAmount =
      method === "cash" ? Number(amountPaid || totals.total) : totals.total;
    if (status === "paid" && method === "cash" && payAmount < totals.total) {
      toast.error(t("insufficient"));
      return null;
    }
    const sale: Sale = {
      ts: Date.now(),
      customerId,
      items: cart.map(({ ...i }) => ({ ...i })),
      ...totals,
      payments: status === "held" ? [] : [{ method, amount: payAmount }],
      status,
      receiptLang,
    };
    const id = await db.transaction(
      "rw",
      db.sales,
      db.variants,
      db.moves,
      db.customers,
      async () => {
        const sid = await db.sales.add(sale);
        if (status === "paid") {
          for (const l of cart) {
            const v = (await db.variants.get(l.variantId))!;
            await db.variants.update(l.variantId, { stock: v.stock - l.qty });
            await db.moves.add({
              ts: Date.now(),
              variantId: l.variantId,
              qty: -l.qty,
              type: "sale",
              ref: `S${sid}`,
            });
          }
          if (method === "credit" && customerId) {
            const c = (await db.customers.get(customerId))!;
            await db.customers.update(customerId, {
              balance: c.balance + totals.total,
            });
          }
        }
        return sid;
      },
    );
    const done = { ...sale, id };
    setCart([]);
    setAmountPaid("");
    setPhone("");
    if (status === "paid") setLastSale(done);
    else toast.success(t("saved"));
    return done;
  }

  const held = useLiveQuery(
    () => db.sales.where("status").equals("held").reverse().sortBy("ts"),
    [],
  );
  async function recall(id: number) {
    const s = await db.sales.get(id);
    if (!s) return;
    setCart(s.items.map((i) => ({ ...i })));
    await db.sales.delete(id);
  }

  if (!sellable)
    return (
      <div className="grid place-items-center rounded-lg border border-dashed py-24 text-center">
        <Lock className="mx-auto mb-3 size-8 text-muted-foreground" />
        <p className="text-sm font-medium">{t("graceNote")}</p>
      </div>
    );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search")}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {shown.map((v) => (
            <Card
              key={v.id}
              className="cursor-pointer transition-colors hover:border-foreground/40"
              onClick={() => add(v)}
            >
              <CardContent className="p-3">
                <p className="truncate text-[13px] font-medium">{v.name}</p>
                <p className="text-xs text-muted-foreground">
                  {v.size} · {v.color}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="num text-sm font-semibold text-emerald-600">
                    {v.price.toLocaleString()}
                  </span>
                  <Badge
                    variant={
                      v.stock <= v.reorderLevel ? "destructive" : "secondary"
                    }
                    className="num"
                  >
                    {v.stock}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="flex flex-col rounded-lg border">
        <div className="min-h-45 flex-1 space-y-2 overflow-y-auto p-3">
          {cart.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("emptyCart")}
            </p>
          )}
          {cart.map((l) => (
            <div
              key={l.variantId}
              className="flex items-center gap-1.5 rounded-md border p-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{l.name}</p>
                <p className="num text-xs text-muted-foreground">
                  {l.size}/{l.color} · {l.unitPrice}
                </p>
              </div>
              <Button
                size="icon"
                variant="outline"
                className="size-7"
                onClick={() => bump(l.variantId, -1)}
              >
                <Minus className="size-3" />
              </Button>
              <span className="num w-6 text-center text-sm font-semibold">
                {l.qty}
              </span>
              <Button
                size="icon"
                variant="outline"
                className="size-7"
                onClick={() => bump(l.variantId, 1)}
              >
                <Plus className="size-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-7 text-red-600"
                onClick={() =>
                  setCart((c) => c.filter((x) => x.variantId !== l.variantId))
                }
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <div className="space-y-2 border-t p-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>{t("subtotal")}</span>
            <span className="num">{money(totals.subtotal, cur)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>
              {t("tax")} ({taxRate}%)
            </span>
            <span className="num">{money(totals.tax, cur)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span>{t("total")}</span>
            <span className="num text-emerald-600">
              {money(totals.total, cur)}
            </span>
          </div>
          <div className="flex gap-2">
            <Select
              value={method}
              onValueChange={(v) => setMethod(v as Payment["method"])}
            >
              <SelectTrigger className="w-32.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {t(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {method === "cash" && (
              <Input
                inputMode="numeric"
                className="num flex-1"
                placeholder={t("amountPaid")}
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
              />
            )}
          </div>
          <Input
            placeholder={t("phone")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="num"
          />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => makeSale("paid")}>
              {t("checkout")}
            </Button>
            <Button
              variant="outline"
              size="icon"
              title={t("hold")}
              onClick={() => makeSale("held")}
            >
              <Pause className="size-4" />
            </Button>
            <Dialog>
              <DialogTrigger
                render={
                  <Button variant="outline" size="icon" title={t("heldBills")}>
                    <span className="relative">
                      <Pause className="size-4" />
                      {(held?.length ?? 0) > 0 && (
                        <span className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                          {held!.length}
                        </span>
                      )}
                    </span>
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("heldBills")}</DialogTitle>
                </DialogHeader>
                <div className="divide-y">
                  {(held ?? []).map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <span>
                        #{h.id} · {new Date(h.ts).toLocaleString("en-GB")} ·{" "}
                        <span className="num">{money(h.total, cur)}</span>
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => recall(h.id!)}
                      >
                        {t("recall")}
                      </Button>
                    </div>
                  ))}
                  {(held ?? []).length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      {t("noData")}
                    </p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {lastSale && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => print()}
            >
              <Printer className="mr-1.5 size-4" />
              {t("print")}
            </Button>
          )}
        </div>
      </div>

      <div className="receipt-holder">
        <div ref={receiptRef}>
          {lastSale && <Receipt sale={lastSale} branding={branding} />}
        </div>
      </div>
    </div>
  );
}
