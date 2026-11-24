"use client";
import { useReceiptPrinter } from "@/components/PrintReceipt";
import { Receipt } from "@/components/Receipt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import {
  shareReceiptOnWhatsApp,
  useBranding,
  useFeature,
} from "@/lib/branding";
import {
  db,
  getSetting,
  type Customer,
  type Payment,
  type Sale,
} from "@/lib/db";
import { money } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { canSell, evaluateLicense } from "@/lib/license";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Lock,
  MessageCircle,
  Minus,
  Pause,
  Plus,
  Printer,
  ReceiptText,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  const [cust, setCust] = useState({ name: "", phone: "", address: "" });
  const [billDisc, setBillDisc] = useState("");
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [sellable, setSellable] = useState(true);

  const branding = useBranding();
  const whatsappOn = useFeature("whatsappReceipt");
  const { print, holder } = useReceiptPrinter(branding);
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
  const customers = useLiveQuery(() => db.customers.toArray(), []);

  // existing-customer suggestions while typing a phone or name
  const suggests = useMemo(() => {
    const ph = cust.phone.trim();
    const nm = cust.name.trim().toLowerCase();
    if (!ph && !nm) return [];
    return (customers ?? [])
      .filter(
        (c) =>
          (ph && c.phone.startsWith(ph)) ||
          (nm && c.name.toLowerCase().includes(nm)),
      )
      .slice(0, 5);
  }, [customers, cust.phone, cust.name]);

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
    const discount = Math.max(
      0,
      Math.min(Math.round(Number(billDisc) || 0), subtotal),
    );
    // spread the bill discount over the lines (proportional to line value,
    // largest line absorbs the rounding remainder) so per-product reports
    // and the receipt stay consistent with the bill total
    const lineVals = cart.map((l) => l.unitPrice * l.qty);
    const lineSum = lineVals.reduce((a, b) => a + b, 0);
    const dist = lineVals.map((v) =>
      lineSum > 0 ? Math.floor((v / lineSum) * discount) : 0,
    );
    if (cart.length > 0) {
      let big = 0;
      for (let i = 1; i < cart.length; i++)
        if (lineVals[i] > lineVals[big]) big = i;
      dist[big] += discount - dist.reduce((a, b) => a + b, 0);
    }
    const tax = Math.round((subtotal - discount) * taxRate) / 100;
    return {
      subtotal,
      discount,
      tax,
      total: Math.round(subtotal - discount + tax),
      dist,
    };
  }, [cart, billDisc, taxRate]);

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

  /** find-or-create the customer from the name/phone/address fields */
  async function upsertCustomer(): Promise<{
    customerId?: number;
    name?: string;
    phone?: string;
    address?: string;
  }> {
    const name = cust.name.trim();
    const phone = cust.phone.trim();
    const address = cust.address.trim();
    if (!name && !phone) return {};
    try {
      let ex: Customer | undefined;
      if (phone) ex = await db.customers.where("phone").equals(phone).first();
      else
        ex = await db.customers
          .filter((c) => c.name.toLowerCase() === name.toLowerCase())
          .first();
      if (ex) {
        await db.customers.update(ex.id!, {
          name: name || ex.name,
          address: address || ex.address,
        });
        return {
          customerId: ex.id,
          name: name || ex.name,
          phone: phone || ex.phone,
          address: address || ex.address,
        };
      }
      const id = await db.customers.add({
        phone,
        name: name || phone,
        address: address || undefined,
        points: 0,
        balance: 0,
      });
      return { customerId: id, name: name || phone, phone, address };
    } catch {
      // e.g. duplicate phone — save the sale anyway with the typed info
      return { name, phone, address };
    }
  }

  async function makeSale(status: "paid" | "held"): Promise<Sale | null> {
    const r = await evaluateLicense();
    if (!canSell(r.state)) {
      toast.error(t("subExpired"));
      return null;
    }
    if (cart.length === 0) return null;
    const payAmount =
      method === "cash" ? Number(amountPaid || totals.total) : totals.total;
    if (status === "paid" && method === "cash" && payAmount < totals.total) {
      toast.error(t("insufficient"));
      return null;
    }
    const c = await upsertCustomer();
    const receiptLang = ((await getSetting("receiptLang")) ?? "en") as
      | "en"
      | "ur"
      | "both";
    const sale: Sale = {
      ts: Date.now(),
      customerId: c.customerId,
      customerName: c.name,
      customerPhone: c.phone,
      customerAddress: c.address,
      items: cart.map(({ ...i }, idx) => ({
        ...i,
        discount: totals.dist[idx],
      })),
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      total: totals.total,
      payments: status === "held" ? [] : [{ method, amount: payAmount }],
      status,
      receiptLang,
    };
    const { sid, receiptNo } = await db.transaction(
      "rw",
      db.sales,
      db.variants,
      db.moves,
      db.customers,
      async () => {
        const sid = await db.sales.add(sale);
        const receiptNo = `R-${String(sid).padStart(4, "0")}`;
        await db.sales.update(sid, { receiptNo });
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
          if (method === "credit" && c.customerId) {
            const cu = (await db.customers.get(c.customerId))!;
            await db.customers.update(c.customerId, {
              balance: cu.balance + totals.total,
            });
          }
        }
        return { sid, receiptNo };
      },
    );
    const done = { ...sale, id: sid, receiptNo };
    setCart([]);
    setAmountPaid("");
    setBillDisc("");
    setCust({ name: "", phone: "", address: "" });
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
    setBillDisc(s.discount ? String(s.discount) : "");
    setCust({
      name: s.customerName ?? "",
      phone: s.customerPhone ?? "",
      address: s.customerAddress ?? "",
    });
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
          {/* customer (optional — saved on the sale and printed on receipts) */}
          <div className="space-y-1.5 rounded-md border p-2">
            <div className="flex items-center gap-1.5">
              <UserRound className="size-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold">{t("customer")}</p>
              <span className="text-[10px] text-muted-foreground">
                ({t("optional")})
              </span>
            </div>
            <Input
              className="num h-8 text-xs"
              placeholder={t("phone")}
              value={cust.phone}
              inputMode="tel"
              onChange={(e) => setCust({ ...cust, phone: e.target.value })}
            />
            <Input
              className="h-8 text-xs"
              placeholder={t("name")}
              value={cust.name}
              onChange={(e) => setCust({ ...cust, name: e.target.value })}
            />
            <Input
              className="h-8 text-xs"
              placeholder={t("address")}
              value={cust.address}
              onChange={(e) => setCust({ ...cust, address: e.target.value })}
            />
            {suggests.length > 0 && (
              <div className="space-y-1">
                {suggests.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded border px-2 py-1 text-left text-xs hover:bg-accent"
                    onClick={() =>
                      setCust({
                        name: c.name,
                        phone: c.phone,
                        address: c.address ?? "",
                      })
                    }
                  >
                    <span className="min-w-0 truncate font-medium">
                      {c.name}
                    </span>
                    <span className="num shrink-0 text-muted-foreground">
                      {c.phone}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between text-muted-foreground">
            <span>{t("subtotal")}</span>
            <span className="num">{money(totals.subtotal, cur)}</span>
          </div>
          {totals.discount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>{t("discount")}</span>
              <span className="num">-{money(totals.discount, cur)}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>
              {String(branding.taxName ?? t("tax"))} ({taxRate}%)
            </span>
            <span className="num">{money(totals.tax, cur)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span>{t("total")}</span>
            <span className="num text-emerald-600">
              {money(totals.total, cur)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              inputMode="numeric"
              className="num h-8 flex-1"
              placeholder={`${t("discount")} (${cur})`}
              value={billDisc}
              onChange={(e) => setBillDisc(e.target.value)}
            />
            {totals.discount > 0 && (
              <span className="num shrink-0 text-xs font-medium text-emerald-600">
                -{money(totals.discount, cur)}
              </span>
            )}
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
                      <span className="min-w-0">
                        <span className="block truncate">
                          #{h.receiptNo ?? h.id}
                          {h.customerName ? ` · ${h.customerName}` : ""}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(h.ts).toLocaleString("en-GB")} ·{" "}
                          <span className="num">{money(h.total, cur)}</span>
                        </span>
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
        </div>
      </div>

      {/* receipt popup right after payment — print or start the next sale */}
      <Dialog open={!!lastSale} onOpenChange={(o) => !o && setLastSale(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="size-4 text-emerald-600" />
              {t("receiptReady")}
            </DialogTitle>
          </DialogHeader>
          {lastSale && (
            <div className="max-h-[52vh] overflow-y-auto rounded-lg border bg-white shadow-inner">
              <Receipt sale={lastSale} branding={branding} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLastSale(null)}>
              {t("newSale")}
            </Button>
            {whatsappOn && (
              <Button
                variant="outline"
                disabled={!lastSale}
                onClick={() =>
                  lastSale && shareReceiptOnWhatsApp(lastSale, branding)
                }
              >
                <MessageCircle className="mr-1.5 size-4" />
                {t("whatsapp")}
              </Button>
            )}
            <Button
              disabled={!lastSale}
              onClick={() => lastSale && print(lastSale)}
            >
              <Printer className="mr-1.5 size-4" />
              {t("print")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {holder}
    </div>
  );
}
