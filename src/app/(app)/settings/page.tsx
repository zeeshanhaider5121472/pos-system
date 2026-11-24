"use client";
import { AdminLoginForm, LockBar } from "@/components/AdminGate";
import { Receipt } from "@/components/Receipt";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db, getSetting, LOCAL_TABLES, setSetting, type Sale } from "@/lib/db";
import { download, ymd } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { getLicense } from "@/lib/license";
import { useShopLockConfigured, useShopUnlocked } from "@/lib/shop-auth";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Download,
  LockKeyhole,
  Minus,
  Plus,
  Printer,
  RefreshCw,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

export default function Settings() {
  const { t, lang, setLang } = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const lic = useLiveQuery(() => getLicense(), undefined);
  const branding = lic?.branding ?? {};
  const [rLang, setRLang] = useState<string>("en");
  useLiveQuery(
    async () => setRLang(((await getSetting("receiptLang")) ?? "en") as string),
    [],
  );

  const lastBackup = useLiveQuery(
    async () => (await getSetting("lastBackupAt")) as number | undefined,
    [],
  );

  // shop-owner admin lock
  const lockConfigured = useShopLockConfigured();
  const unlocked = useShopUnlocked();

  // font size (applies to the whole app, persisted locally)
  const [scale, setScale] = useState(100);
  useLiveQuery(async () => {
    const s = await getSetting("fontScale");
    if (typeof s === "number") setScale(s);
  }, []);
  function applyScale(v: number) {
    const c = Math.min(140, Math.max(80, Math.round(v)));
    setScale(c);
    setSetting("fontScale", c);
    document.documentElement.style.fontSize = `${c}%`;
    window.dispatchEvent(new CustomEvent("fontscale", { detail: c }));
  }

  async function exportBackup() {
    const data: any = {};
    for (const tb of LOCAL_TABLES) data[tb] = await (db as any)[tb].toArray();
    download(
      `pos-backup-${ymd(new Date())}.json`,
      JSON.stringify({
        app: "clothing-pos",
        v: 1,
        exportedAt: Date.now(),
        data,
      }),
      "application/json",
    );
    await setSetting("lastBackupAt", Date.now());
    toast.success(t("saved"));
  }
  async function importBackup(file: File) {
    const j = JSON.parse(await file.text());
    if (j.app !== "clothing-pos" || !j.data)
      return toast.error("Invalid backup file");
    await db.transaction("rw", db.tables, async () => {
      for (const tb of LOCAL_TABLES) {
        await (db as any)[tb].clear();
        await (db as any)[tb].bulkAdd(j.data[tb] ?? []);
      }
    });
    toast.success(t("saved"));
    location.reload();
  }
  const testSale: Sale = {
    ts: Date.now(),
    receiptNo: "R-TEST",
    customerName: "Test Customer",
    customerPhone: "0300 1234567",
    customerAddress: "Main Bazar, Lahore",
    items: [
      {
        variantId: 0,
        sku: "TEST-001",
        name: "Test Item",
        size: "M",
        color: "Black",
        qty: 1,
        unitPrice: 500,
        cost: 350,
        discount: 0,
      },
    ],
    subtotal: 500,
    discount: 0,
    tax: 0,
    total: 500,
    payments: [{ method: "cash", amount: 1000 }],
    status: "paid",
    receiptLang: (rLang as any) ?? "en",
  };
  const print = () => window.print(); // test receipt uses the same @media print rules

  if (lockConfigured === null)
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <RefreshCw className="size-6 animate-spin text-muted-foreground" />
      </div>
    );

  if (lockConfigured && !unlocked)
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="w-full max-w-sm space-y-4 rounded-xl border bg-background p-6 shadow-sm">
          <LockKeyhole className="mx-auto size-8 text-muted-foreground" />
          <p className="text-center text-sm font-medium">
            {t("settingsNeeded")}
          </p>
          <AdminLoginForm onSuccess={() => undefined} />
        </div>
      </div>
    );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {lockConfigured === false && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 md:col-span-2">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
          {t("lockNotConfigured")}
        </div>
      )}

      <Card>
        <CardContent className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">{t("language")}</h2>
          <div className="flex gap-2">
            <Button
              variant={lang === "en" ? "default" : "outline"}
              onClick={() => setLang("en")}
            >
              English
            </Button>
            <Button
              variant={lang === "ur" ? "default" : "outline"}
              className="urdu"
              onClick={() => setLang("ur")}
            >
              اردو
            </Button>
          </div>
          <h2 className="pt-2 text-sm font-semibold">{t("receiptLanguage")}</h2>
          <Select
            value={rLang}
            onValueChange={(v) => {
              if (!v) return;
              setRLang(v);
              setSetting("receiptLang", v);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{t("en")}</SelectItem>
              <SelectItem value="ur">{t("ur")}</SelectItem>
              <SelectItem value="both">{t("both")}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">{t("fontSize")}</h2>
          <p className="text-xs text-muted-foreground">{t("fontSizeHint")}</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={scale <= 80}
              onClick={() => applyScale(scale - 10)}
            >
              <Minus className="size-4" />
            </Button>
            <span className="num w-14 text-center text-sm font-semibold">
              {scale}%
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={scale >= 140}
              onClick={() => applyScale(scale + 10)}
            >
              <Plus className="size-4" />
            </Button>
            <Button
              variant={scale === 100 ? "default" : "outline"}
              onClick={() => applyScale(100)}
            >
              {t("normal")}
            </Button>
          </div>
          <p
            className="text-sm text-muted-foreground"
            style={{ fontSize: `${scale}%` }}
          >
            {t("appName")} — 1234567890
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-4">
          <h2 className="text-sm font-semibold">{t("branding")}</h2>
          <p className="text-sm">{String(branding.shopName ?? "—")}</p>
          <p className="urdu text-sm">{String(branding.shopNameUr ?? "")}</p>
          <p className="text-xs text-muted-foreground">
            {String(branding.address ?? "")} · {String(branding.phone ?? "")}
          </p>
          <p className="num text-xs text-muted-foreground">
            {String(branding.currency ?? "Rs")} · {t("tax")}{" "}
            {String(branding.taxRate ?? 0)}%
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">{t("licenseInfo")}</h2>
          <p className="num text-sm">
            {t("shopId")}: {lic?.cid || "—"}
          </p>
          <p className="num text-sm">
            {t("expiry")}: {lic?.exp || "—"} · {t("plan")}: {lic?.plan || "—"}
          </p>
          <p className="text-sm">
            {t("status")}: {lic?.status || "—"}
          </p>
          <a
            href="/activation"
            className="text-sm font-medium text-emerald-600 hover:underline"
          >
            {t("updateSubscription")} →
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">{t("backup")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("lastBackup")}:{" "}
            {lastBackup ? new Date(lastBackup).toLocaleString("en-GB") : "—"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportBackup}>
              <Download className="mr-1.5 size-4" />
              {t("backupNow")}
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1.5 size-4" />
              {t("restore")}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) =>
                e.target.files?.[0] && importBackup(e.target.files[0])
              }
            />
            <Button variant="outline" onClick={print}>
              <Printer className="mr-1.5 size-4" />
              {t("testReceipt")}
            </Button>
          </div>
          <div className="receipt-holder">
            <div ref={printRef} id="receipt-print">
              <Receipt sale={testSale} branding={branding} />
            </div>
          </div>
        </CardContent>
      </Card>

      <LockBar />
    </div>
  );
}
