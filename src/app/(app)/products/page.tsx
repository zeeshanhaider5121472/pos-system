"use client";
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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db, type Product } from "@/lib/db";
import { useT } from "@/lib/i18n";
import { useLiveQuery } from "dexie-react-hooks";
import { PackagePlus, Pencil, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const blank = {
  name: "",
  nameUr: "",
  category: "",
  brand: "",
  season: "",
  gender: "",
  sizes: "S,M,L,XL",
  colors: "Black,White",
  costPrice: "",
  price: "",
  reorderLevel: "3",
};

export default function Products() {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [form, setForm] = useState<any>(null); // null = closed; {...blank} = new; {id, ...} = edit
  const [openVar, setOpenVar] = useState<number | null>(null);
  const products = useLiveQuery(
    () => db.products.orderBy("name").toArray(),
    [],
  );
  const variants = useLiveQuery(() => db.variants.toArray(), []);

  async function saveProduct() {
    const f = form;
    if (!f.name.trim()) return toast.error(t("name"));
    const rec: Product = {
      name: f.name.trim(),
      nameUr: f.nameUr?.trim(),
      category: f.category.trim(),
      brand: f.brand.trim(),
      season: f.season?.trim(),
      gender: f.gender?.trim(),
    };
    if (f.id) {
      await db.products.update(f.id, rec);
      toast.success(t("saved"));
      setForm(null);
      return;
    }
    const pid = await db.products.add(rec);
    const sizes = f.sizes
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
    const colors = f.colors
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
    const cost = Number(f.costPrice) || 0,
      price = Number(f.price) || 0,
      rl = Number(f.reorderLevel) || 0;
    const skus = sizes.flatMap((sz: string) =>
      colors.map((cl: string) => ({
        productId: pid,
        sku: `${(f.category || "ITM").slice(0, 3).toUpperCase()}-${pid}-${sz}-${cl.replace(/\s+/g, "")}`,
        size: sz,
        color: cl,
        costPrice: cost,
        price,
        stock: 0,
        reorderLevel: rl,
      })),
    );
    await db.variants.bulkAdd(skus);
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
    (p.name + p.category + p.brand).toLowerCase().includes(q.toLowerCase()),
  );
  const prods = useLiveQuery(() => db.products.toArray(), []) ?? [];
  const pidName = (id: number) => prods.find((p) => p.id === id)?.name ?? "";

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
        <Button onClick={() => setForm({ ...blank })}>
          <PackagePlus className="mr-1.5 size-4" />
          {t("addProduct")}
        </Button>
      </div>

      {shown.map((p) => {
        const vs = (variants ?? []).filter((v) => v.productId === p.id);
        const stock = vs.reduce((a, v) => a + v.stock, 0);
        return (
          <Card key={p.id}>
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
                    <span className="num">{stock}</span>
                  </p>
                </div>
                <Badge variant="secondary" className="num">
                  {vs.length} {t("variants")}
                </Badge>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setForm({ ...blank, ...p, id: p.id })}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-red-600"
                  onClick={() => delProduct(p)}
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
                      <span className="num">
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? t("edit") : t("addProduct")}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("name")}</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t("nameUr")}</Label>
                  <Input
                    className="urdu"
                    value={form.nameUr}
                    onChange={(e) =>
                      setForm({ ...form, nameUr: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>{t("category")}</Label>
                  <Input
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>{t("brand")}</Label>
                  <Input
                    value={form.brand}
                    onChange={(e) =>
                      setForm({ ...form, brand: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>{t("season")}</Label>
                  <Input
                    value={form.season}
                    onChange={(e) =>
                      setForm({ ...form, season: e.target.value })
                    }
                    placeholder="SS26"
                  />
                </div>
                <div>
                  <Label>{t("gender")}</Label>
                  <Select
                    value={form.gender}
                    onValueChange={(v) => setForm({ ...form, gender: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
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
              {!form.id && (
                <div className="grid grid-cols-2 gap-3 rounded-md border p-3">
                  <div>
                    <Label>{t("sizes")}</Label>
                    <Input
                      value={form.sizes}
                      onChange={(e) =>
                        setForm({ ...form, sizes: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>{t("colors")}</Label>
                    <Input
                      value={form.colors}
                      onChange={(e) =>
                        setForm({ ...form, colors: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>{t("costPrice")}</Label>
                    <Input
                      className="num"
                      inputMode="numeric"
                      value={form.costPrice}
                      onChange={(e) =>
                        setForm({ ...form, costPrice: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>{t("price")}</Label>
                    <Input
                      className="num"
                      inputMode="numeric"
                      value={form.price}
                      onChange={(e) =>
                        setForm({ ...form, price: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>{t("reorderLevel")}</Label>
                    <Input
                      className="num"
                      inputMode="numeric"
                      value={form.reorderLevel}
                      onChange={(e) =>
                        setForm({ ...form, reorderLevel: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}
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
      {pidName("" as any) === null && null}
    </div>
  );
}
