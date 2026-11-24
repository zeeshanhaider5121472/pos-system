"use client";
import { AdminGateDialog, LockBar } from "@/components/AdminGate";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db, type Product, type Variant } from "@/lib/db";
import { useT } from "@/lib/i18n";
import { useShopLockConfigured, useShopUnlocked } from "@/lib/shop-auth";
import { useLiveQuery } from "dexie-react-hooks";
import {
  PackagePlus,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const SIZE_PRESETS = ["S", "M", "L", "XL", "XXL", "Unstitched"];
const COLOR_PRESETS = [
  "Black",
  "White",
  "Red",
  "Blue",
  "Green",
  "Grey",
  "Maroon",
  "Brown",
  "Pink",
];
const NO_SIZE = "No Size";

type VarRow = {
  id: number;
  size: string;
  color: string;
  costPrice: string;
  price: string;
  stock: string;
  reorderLevel: string;
  origStock: number;
  _del?: boolean;
};

type FormState = {
  id?: number;
  name: string;
  nameUr: string;
  category: string;
  brand: string;
  season: string;
  gender: string;
  sizes: string[];
  colors: string[];
  costPrice: string;
  price: string;
  stock: string;
  reorderLevel: string;
  rows?: VarRow[];
};

const blank: FormState = {
  name: "",
  nameUr: "",
  category: "",
  brand: "",
  season: "",
  gender: "Men",
  sizes: [],
  colors: [],
  costPrice: "",
  price: "",
  stock: "0",
  reorderLevel: "3",
};

const skuOf = (category: string, pid: number, size: string, color: string) =>
  `${(category || "ITM").slice(0, 3).toUpperCase()}-${pid}-${size.replace(/\s+/g, "")}-${color.replace(/\s+/g, "")}`;

function ChipPicker({
  presets,
  selected,
  onChange,
  addPh,
}: {
  presets: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  addPh: string;
}) {
  const { t } = useT();
  const [custom, setCustom] = useState("");
  function toggle(v: string) {
    onChange(
      selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v],
    );
  }
  function addCustom() {
    const v = custom.trim();
    if (!v) return;
    if (!selected.some((s) => s.toLowerCase() === v.toLowerCase()))
      onChange([...selected, v]);
    setCustom("");
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {presets.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => toggle(p)}
          className={`h-7 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
            selected.includes(p)
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-background hover:bg-muted"
          }`}
        >
          {p}
        </button>
      ))}
      <span className="flex items-center gap-1">
        <Input
          className="h-7 w-24 text-xs"
          placeholder={addPh}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={addCustom}
        >
          <Plus className="size-3.5" />
        </Button>
      </span>
      {selected.length > 0 && (
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => onChange([])}
        >
          {t("clear")}
        </button>
      )}
    </div>
  );
}

function CategoryPicker({
  value,
  onChange,
  categories,
}: {
  value: string;
  onChange: (v: string) => void;
  categories: string[];
}) {
  const { t } = useT();
  const [adding, setAdding] = useState(false);
  if (adding) {
    return (
      <div className="flex gap-1.5">
        <Input
          autoFocus
          value={value}
          placeholder={t("newCategoryPh")}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            setAdding(false);
            onChange("");
          }}
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }
  return (
    <Select
      value={value || null}
      onValueChange={(v) => {
        if (v === "__add__") {
          setAdding(true);
          onChange("");
        } else {
          onChange(v ?? "");
        }
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue>{value || t("selectCategory")}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {categories.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value="__add__">
          <span className="flex items-center gap-1.5">
            <Plus className="size-3.5" />
            {t("addNewCategory")}
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

function MiniNum({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <label className="grid gap-0.5">
      <span className="text-[10px] leading-none text-muted-foreground">
        {label}
      </span>
      <Input
        className={`num h-7 ${className ?? "w-20"}`}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export default function Products() {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [form, setForm] = useState<FormState | null>(null); // null = closed
  const [openVar, setOpenVar] = useState<number | null>(null);
  const [pending, setPending] = useState<{ fn: () => void } | null>(null);
  const products = useLiveQuery(
    () => db.products.orderBy("name").toArray(),
    [],
  );
  const variants = useLiveQuery(() => db.variants.toArray(), []);

  // shop-owner admin lock
  const lockConfigured = useShopLockConfigured();
  const unlocked = useShopUnlocked();
  const guarded = (fn: () => void) => () => {
    if (lockConfigured === false || unlocked) fn();
    else setPending({ fn });
  };

  const categories = Array.from(
    new Set((products ?? []).map((p) => p.category?.trim()).filter(Boolean)),
  ).sort() as string[];

  function openEdit(p: Product) {
    const vs = (variants ?? [])
      .filter((v) => v.productId === p.id)
      .map((v) => ({ ...v }));
    setForm({
      ...blank,
      id: p.id,
      name: p.name,
      nameUr: p.nameUr ?? "",
      category: p.category ?? "",
      brand: p.brand ?? "",
      season: p.season ?? "",
      gender: p.gender || "Men",
      // prefill the "add more variants" helper with the product's usual values
      costPrice: vs.length ? String(vs[0].costPrice ?? 0) : "",
      price: vs.length ? String(vs[0].price ?? 0) : "",
      stock: "0",
      reorderLevel: vs.length ? String(vs[0].reorderLevel ?? 3) : "3",
      rows: vs.map((v) => ({
        id: v.id!,
        size: v.size,
        color: v.color,
        costPrice: String(v.costPrice ?? 0),
        price: String(v.price ?? 0),
        stock: String(v.stock ?? 0),
        reorderLevel: String(v.reorderLevel ?? 3),
        origStock: v.stock ?? 0,
      })),
    });
  }

  const updRow = (i: number, patch: Partial<VarRow>) => {
    if (!form?.rows) return;
    const rows = form.rows.map((r, idx) =>
      idx === i ? { ...r, ...patch } : r,
    );
    setForm({ ...form, rows });
  };

  async function saveProduct() {
    const f = form;
    if (!f) return;
    const missing: string[] = [];
    if (!f.name.trim()) missing.push(t("name"));
    if (!f.category.trim()) missing.push(t("category"));
    if (!f.brand.trim()) missing.push(t("brand"));
    if (!f.gender) missing.push(t("gender"));
    if (!f.id && f.colors.length === 0) missing.push(t("color"));
    const badCost =
      f.costPrice.trim() === "" ||
      isNaN(Number(f.costPrice)) ||
      Number(f.costPrice) < 0;
    const badPrice =
      f.price.trim() === "" || isNaN(Number(f.price)) || Number(f.price) < 0;
    if (!f.id || f.colors.length > 0) {
      // cost/price are required when creating a product or adding variants
      if (badCost) missing.push(t("costPrice"));
      if (badPrice) missing.push(t("price"));
    }
    if (missing.length)
      return toast.error(`${t("pleaseFill")} ${missing.join(", ")}`);

    const cost = Math.max(0, Number(f.costPrice) || 0);
    const price = Math.max(0, Number(f.price) || 0);
    if (price && price < cost) toast.warning(t("priceBelowCost")); // non-blocking

    const rec: Product = {
      name: f.name.trim(),
      nameUr: f.nameUr?.trim() || undefined,
      category: f.category.trim(),
      brand: f.brand.trim(),
      season: f.season?.trim() || undefined,
      gender: f.gender || "Men",
    };

    await db.transaction("rw", db.products, db.variants, db.moves, async () => {
      let pid = f.id;
      if (pid) {
        await db.products.update(pid, rec);
        for (const r of f.rows ?? []) {
          if (r._del) {
            await db.variants.delete(r.id);
            continue;
          }
          const st = Math.max(0, Math.floor(Number(r.stock) || 0));
          const cp = Math.max(0, Number(r.costPrice) || 0);
          const pr = Math.max(0, Number(r.price) || 0);
          const lv = Math.max(0, Math.floor(Number(r.reorderLevel) || 0));
          await db.variants.update(r.id, {
            costPrice: cp,
            price: pr,
            stock: st,
            reorderLevel: lv,
          });
          if (st !== r.origStock)
            await db.moves.add({
              ts: Date.now(),
              variantId: r.id,
              qty: st - r.origStock,
              type: "adjust",
              ref: "Edit",
            });
        }
      } else {
        pid = await db.products.add(rec);
      }

      // generate variants (whole form in add mode; "add more" section in edit mode)
      if (f.colors.length > 0 && !badCost && !badPrice) {
        const stockQty = Math.max(0, Math.floor(Number(f.stock) || 0));
        const rl =
          f.reorderLevel.trim() === ""
            ? 3
            : Math.max(0, Math.floor(Number(f.reorderLevel) || 0));
        const sizes = f.sizes.length ? f.sizes : [NO_SIZE];
        const existing = new Set(
          (f.rows ?? [])
            .filter((r) => !r._del)
            .map((r) => `${r.size.toLowerCase()}|${r.color.toLowerCase()}`),
        );
        const news: Variant[] = [];
        let skipped = 0;
        for (const sz of sizes)
          for (const cl of f.colors) {
            const k = `${sz.toLowerCase()}|${cl.toLowerCase()}`;
            if (existing.has(k)) {
              skipped++;
              continue;
            }
            existing.add(k);
            news.push({
              productId: pid,
              sku: skuOf(f.category, pid, sz, cl),
              size: sz,
              color: cl,
              costPrice: cost,
              price,
              stock: stockQty,
              reorderLevel: rl,
            });
          }
        if (news.length) {
          const keys = await db.variants.bulkAdd(news, { allKeys: true });
          if (stockQty > 0)
            await db.moves.bulkAdd(
              keys.map((kid) => ({
                ts: Date.now(),
                variantId: Number(kid),
                qty: stockQty,
                type: "purchase" as const,
                ref: "Opening",
              })),
            );
        }
        if (skipped) toast.info(t("skippedDuplicates"));
      }
    });

    toast.success(t("saved"));
    setForm(null);
  }

  async function delProduct(p: Product) {
    if (!confirm(t("confirmDelete"))) return;
    await db.transaction("rw", db.products, db.variants, async () => {
      await db.variants.where("productId").equals(p.id!).delete();
      await db.products.delete(p.id!);
    });
  }

  const shown = (products ?? []).filter((p) =>
    `${p.name}${p.nameUr ?? ""}${p.category}${p.brand}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );

  const requiredMark = <span className="text-destructive">*</span>;
  const optionalMark = (
    <span className="font-normal text-muted-foreground">({t("optional")})</span>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search")}
            className="pl-9"
          />
        </div>
        <Button onClick={guarded(() => setForm({ ...blank }))}>
          <PackagePlus className="mr-1.5 size-4" />
          {t("addProduct")}
        </Button>
      </div>

      {lockConfigured === false && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
          {t("lockNotConfigured")}
        </div>
      )}

      {shown.map((p) => {
        const vs = (variants ?? []).filter((v) => v.productId === p.id);
        const stock = vs.reduce((a, v) => a + v.stock, 0);
        // any variant at/below its reorder level marks the whole product red
        const lowCount = vs.filter((v) => v.stock <= v.reorderLevel).length;
        const low = lowCount > 0;
        return (
          <Card
            key={p.id}
            className={
              low
                ? "bg-red-50/60 ring-red-300 dark:bg-red-950/20 dark:ring-red-900/70"
                : ""
            }
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {p.name}{" "}
                    {p.nameUr && (
                      <span className="urdu text-muted-foreground">
                        · {p.nameUr}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.category} · {p.brand} · {t("stock")}:{" "}
                    <span
                      className={`num ${low ? "font-semibold text-red-600" : ""}`}
                    >
                      {stock}
                    </span>
                  </p>
                </div>
                {low && (
                  <Badge variant="destructive" className="shrink-0">
                    {t("lowStock")}
                  </Badge>
                )}
                <Badge variant="secondary" className="num">
                  {vs.length} {t("variants")}
                </Badge>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={guarded(() => openEdit(p))}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-red-600"
                  onClick={guarded(() => delProduct(p))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {openVar === p.id && (
                <div className="mt-3 space-y-1 border-t pt-3">
                  {vs.map((v) => (
                    <div key={v.id} className="flex items-center gap-2 text-xs">
                      <span className="num w-40 shrink-0 text-muted-foreground">
                        {v.sku}
                      </span>
                      <Badge variant="outline">{v.size}</Badge>
                      <Badge variant="outline">{v.color}</Badge>
                      <span
                        className={`num ${v.stock <= v.reorderLevel ? "font-semibold text-red-600" : ""}`}
                      >
                        {t("stock")}: {v.stock}
                      </span>
                      <span className="num flex-1">
                        {t("price")}: {v.price}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setOpenVar(openVar === p.id ? null : p.id!)}
                >
                  {t("variants")}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? t("edit") : t("addProduct")}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <Label>
                    {t("name")} {requiredMark}
                  </Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label>
                    {t("nameUr")} {optionalMark}
                  </Label>
                  <Input
                    className="urdu"
                    value={form.nameUr}
                    onChange={(e) =>
                      setForm({ ...form, nameUr: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>
                    {t("category")} {requiredMark}
                  </Label>
                  <CategoryPicker
                    value={form.category}
                    onChange={(v) => setForm({ ...form, category: v })}
                    categories={categories}
                  />
                </div>
                <div>
                  <Label>
                    {t("brand")} {requiredMark}
                  </Label>
                  <Input
                    value={form.brand}
                    onChange={(e) =>
                      setForm({ ...form, brand: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>
                    {t("season")} {optionalMark}
                  </Label>
                  <Input
                    value={form.season}
                    onChange={(e) =>
                      setForm({ ...form, season: e.target.value })
                    }
                    placeholder="SS26"
                  />
                </div>
                <div>
                  <Label>
                    {t("gender")} {requiredMark}
                  </Label>
                  <Select
                    value={form.gender || null}
                    onValueChange={(v) =>
                      setForm({ ...form, gender: v ?? "Men" })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>{form.gender || "Men"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Men">Men</SelectItem>
                      <SelectItem value="Women">Women</SelectItem>
                      <SelectItem value="Kids">Kids</SelectItem>
                      <SelectItem value="Unisex">Unisex</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.id ? (
                <>
                  {/* existing variants — stock, prices and reorder editable */}
                  <div className="rounded-md border p-3">
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">
                      {t("variants")}
                    </p>
                    <div className="space-y-2">
                      {(form.rows ?? []).map((r, i) => (
                        <div
                          key={r.id}
                          className={`flex flex-wrap items-end gap-2 rounded-md border p-2 ${
                            r._del ? "opacity-50" : ""
                          }`}
                        >
                          <div className="flex gap-1 pb-1.5">
                            <Badge variant="outline">{r.size}</Badge>
                            <Badge variant="outline">{r.color}</Badge>
                          </div>
                          <MiniNum
                            label={t("costPrice")}
                            value={r.costPrice}
                            onChange={(v) => updRow(i, { costPrice: v })}
                          />
                          <MiniNum
                            label={t("price")}
                            value={r.price}
                            onChange={(v) => updRow(i, { price: v })}
                          />
                          <MiniNum
                            label={t("stock")}
                            className="w-16"
                            value={r.stock}
                            onChange={(v) => updRow(i, { stock: v })}
                          />
                          <MiniNum
                            label={t("reorderLevel")}
                            className="w-16"
                            value={r.reorderLevel}
                            onChange={(v) => updRow(i, { reorderLevel: v })}
                          />
                          <Button
                            size="icon-sm"
                            variant={r._del ? "outline" : "ghost"}
                            className={r._del ? "" : "text-red-600"}
                            title={r._del ? t("edit") : t("delete")}
                            onClick={() => updRow(i, { _del: !r._del })}
                          >
                            {r._del ? (
                              <Undo2 className="size-3.5" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                          </Button>
                        </div>
                      ))}
                      {(form.rows ?? []).length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          {t("noVariants")}
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="text-xs font-semibold text-muted-foreground">
                    {t("addVariants")}
                  </p>
                </>
              ) : null}

              <div className="grid grid-cols-2 gap-3 rounded-md border p-3">
                <div className="col-span-2">
                  <Label>
                    {t("sizes")} {optionalMark}
                  </Label>
                  <ChipPicker
                    presets={SIZE_PRESETS}
                    selected={form.sizes}
                    onChange={(sizes) => setForm({ ...form, sizes })}
                    addPh={t("sizePh")}
                  />
                  {form.sizes.length === 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {t("noSizeHint")}
                    </p>
                  )}
                </div>
                <div className="col-span-2">
                  <Label>
                    {t("colors")} {form.id ? optionalMark : requiredMark}
                  </Label>
                  <ChipPicker
                    presets={COLOR_PRESETS}
                    selected={form.colors}
                    onChange={(colors) => setForm({ ...form, colors })}
                    addPh={t("colorPh")}
                  />
                </div>
                <div>
                  <Label>
                    {t("costPrice")}{" "}
                    {form.id && form.colors.length === 0
                      ? optionalMark
                      : requiredMark}
                  </Label>
                  <Input
                    className="num"
                    inputMode="decimal"
                    value={form.costPrice}
                    onChange={(e) =>
                      setForm({ ...form, costPrice: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>
                    {t("price")}{" "}
                    {form.id && form.colors.length === 0
                      ? optionalMark
                      : requiredMark}
                  </Label>
                  <Input
                    className="num"
                    inputMode="decimal"
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>
                    {t("openingStock")} {optionalMark}
                  </Label>
                  <Input
                    className="num"
                    inputMode="numeric"
                    value={form.stock}
                    onChange={(e) =>
                      setForm({ ...form, stock: e.target.value })
                    }
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t("openingStockHint")}
                  </p>
                </div>
                <div>
                  <Label>
                    {t("reorderLevel")} {optionalMark}
                  </Label>
                  <Input
                    className="num"
                    inputMode="numeric"
                    value={form.reorderLevel}
                    onChange={(e) =>
                      setForm({ ...form, reorderLevel: e.target.value })
                    }
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t("reorderLevelHint")}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              {t("cancel")}
            </Button>
            <Button onClick={saveProduct}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LockBar />

      <AdminGateDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        onSuccess={() => {
          const fn = pending?.fn;
          setPending(null);
          fn?.();
        }}
      />
    </div>
  );
}
