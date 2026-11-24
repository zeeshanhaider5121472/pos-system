"use client";
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
import { useLiveQuery } from "dexie-react-hooks";
import { Download, Printer, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

export default function Settings() {
  const { t, lang, setLang } = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const lic = useLiveQuery(() => getLicense(), undefined);
  const branding = (lic as any)?.d?.branding ?? {};
  const [rLang, setRLang] = useState<string>("en");
  useLiveQuery(
    async () => setRLang(((await getSetting("receiptLang")) ?? "en") as string),
    [],
  );

  const lastBackup = useLiveQuery(
    async () => (await getSetting("lastBackupAt")) as number | undefined,
    [],
  );

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

  return (
    <div className="grid gap-4 md:grid-cols-2">
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
            {t("expiry")}: {String((lic as any)?.d?.exp ?? "—")} · {t("plan")}:{" "}
            {String((lic as any)?.d?.plan ?? "—")}
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
    </div>
  );
}
