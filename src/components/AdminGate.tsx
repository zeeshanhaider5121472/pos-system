"use client";
// Shared shop-owner admin gate: login form (inline), dialog wrapper and the
// sticky "Log out Admin" bar shown while the owner is unlocked.
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";
import {
  shopLogin,
  shopLogout,
  useShopLockConfigured,
  useShopUnlocked,
} from "@/lib/shop-auth";
import { LockKeyhole, LogOut, RefreshCw } from "lucide-react";
import { useState } from "react";

export function AdminLoginForm({
  onSuccess,
  onUsed,
}: {
  onSuccess: () => void;
  onUsed?: () => void;
}) {
  const { t } = useT();
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    if (!id.trim() || !pw || busy) return;
    setBusy(true);
    setErr("");
    const r = await shopLogin(id.trim(), pw);
    setBusy(false);
    if (r === "ok") {
      setId("");
      setPw("");
      onSuccess();
      onUsed?.();
    } else if (r === "wrong") setErr(t("wrongCredentials"));
    else if (r === "not_configured") setErr(t("lockNotConfigured"));
    else setErr(t("offlineUnlock"));
  }

  return (
    <div className="grid gap-3">
      <div>
        <Label>{t("shopId")}</Label>
        <Input
          value={id}
          autoFocus
          onChange={(e) => setId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
        />
      </div>
      <div>
        <Label>{t("password")}</Label>
        <Input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
        />
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <Button onClick={go} disabled={busy || !id.trim() || !pw}>
        {busy ? <RefreshCw className="mr-1.5 size-4 animate-spin" /> : null}
        {t("adminLogin")}
      </Button>
    </div>
  );
}

export function AdminGateDialog({
  open,
  onOpenChange,
  onSuccess,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}) {
  const { t } = useT();
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onOpenChange(false);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LockKeyhole className="size-4" />
            {title ?? t("adminLogin")}
          </DialogTitle>
          <DialogDescription>
            {description ?? t("adminNeeded")}
          </DialogDescription>
        </DialogHeader>
        <AdminLoginForm
          onSuccess={onSuccess}
          onUsed={() => onOpenChange(false)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Floating, always-visible logout button for the shop owner (hidden for employees). */
export function LockBar() {
  const { t } = useT();
  const unlocked = useShopUnlocked();
  const configured = useShopLockConfigured();
  if (!unlocked || !configured) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
      <Button
        variant="default"
        className="shadow-lg shadow-red/20 bg-red-500 hover:bg-red-600 hover:cursor-pointer"
        onClick={() => shopLogout()}
      >
        <LogOut className="mr-1.5 size-4" />
        {t("lockAdmin")}
      </Button>
    </div>
  );
}
