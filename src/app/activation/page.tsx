"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fingerprint } from "@/lib/fingerprint";
import { useT } from "@/lib/i18n";
import {
  activateWithCode,
  clockIsSane,
  deviceSecret,
  evaluateLicense,
  type LicensePayload,
} from "@/lib/license";
import { RefreshCw, Store } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const ERR: Record<string, string> = {
  INVALID_CODE: "invalidCode",
  DEVICE_MISMATCH: "deviceMismatch",
  REVOKED: "revoked",
  TOO_MANY: "tooMany",
  UNKNOWN_SHOP: "unknownShop",
};

export default function Activation() {
  const { t } = useT();
  const [snap, setSnap] = useState<{
    state: string;
    daysLeft: number;
    lic: LicensePayload | null;
  } | null>(null);
  const [cid, setCid] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    evaluateLicense().then(setSnap);
  }, []);
  const state = snap?.state ?? "none";
  const lic = snap?.lic ?? null;

  async function updateOnline() {
    setBusy(true);
    setMsg("");
    try {
      const ds = await deviceSecret();
      const fp = await fingerprint();
      const id = (lic?.cid ?? cid).trim().toUpperCase();
      if (!id) {
        setMsg(t("enterShopId"));
        return;
      }
      const r = await fetch(
        `/api/license?cid=${encodeURIComponent(id)}&fp=${fp}&ds=${encodeURIComponent(ds)}`,
      );
      const j = await r.json();
      if (!r.ok) {
        setMsg(t(ERR[j.error] ?? "needInternet"));
        return;
      }
      if (!clockIsSane(j.serverTime)) {
        setMsg(t("clockIssue"));
        return;
      }
      const saved = await activateWithCode(j.code, ds);
      setMsg(`${t("validUntil")} ${saved.exp}`);
      evaluateLicense().then(setSnap);
    } catch {
      setMsg(t("needInternet"));
    } finally {
      setBusy(false);
    }
  }
  async function paste() {
    setMsg("");
    try {
      const ds = await deviceSecret();
      await activateWithCode(code, ds);
      location.href = "/";
    } catch (e: any) {
      setMsg(t(ERR[e?.message] ?? "invalidCode"));
    }
  }

  const tone =
    state === "locked" || state === "tampered"
      ? "text-red-600"
      : state === "grace"
        ? "text-red-500"
        : state === "warning"
          ? "text-amber-600"
          : "text-emerald-600";
  const statusText =
    state === "none"
      ? t("enterShopId")
      : state === "locked" || state === "tampered"
        ? t("subExpired")
        : state === "grace"
          ? t("graceNote")
          : state === "warning"
            ? `${snap!.daysLeft} ${t("daysLeft")} — ${t("payReminder")}`
            : `${t("validUntil")} ${lic?.exp}`;

  return (
    <main className="grid min-h-screen place-items-center bg-muted/40 p-4">
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-background p-8 shadow-sm">
        <div className="flex items-center justify-center gap-2">
          <Store className="size-6" />
          <h1 className="text-lg font-semibold">{t("appName")}</h1>
        </div>
        {lic?.branding?.shopName ? (
          <p className="text-center text-sm text-muted-foreground">
            {String(lic.branding.shopName)}
          </p>
        ) : null}
        <p className={`text-center text-sm font-medium ${tone}`}>
          {statusText}
        </p>
        {!lic?.cid && (
          <Input
            value={cid}
            onChange={(e) => setCid(e.target.value)}
            placeholder={t("shopId")}
            className="text-center uppercase"
          />
        )}
        <Button className="w-full" onClick={updateOnline} disabled={busy}>
          {busy ? <RefreshCw className="mr-2 size-4 animate-spin" /> : null}
          {t("updateSubscription")}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {t("needsInternetOnce")}
        </p>
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">{t("orPasteCode")}</p>
          <Textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={3}
            className="text-xs"
          />
          <Button
            variant="outline"
            className="w-full"
            onClick={paste}
            disabled={!code.trim()}
          >
            Activate
          </Button>
        </div>
        {msg && (
          <p className="text-center text-sm font-medium text-blue-600">{msg}</p>
        )}
        {snap && ["active", "warning", "grace"].includes(state) && (
          <Link
            href="/"
            className="block text-center text-sm font-semibold text-emerald-600 hover:underline"
          >
            {t("openApp")} →
          </Link>
        )}
      </div>
    </main>
  );
}
