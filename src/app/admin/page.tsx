// src/app/admin/page.tsx
"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox"; // npx shadcn@latest add checkbox
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FEATURES } from "@/lib/features";
import { Home, LogOut, Plus, RotateCcw, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

// Tax, currency, phone, address and receipt footers are NOT managed here
// anymore — the shop edits them itself in the app under Settings → Shop
// Details. The logo is the bundled file public/icons/logo.png.
const blank = {
  cid: "",
  status: "active",
  plan: "monthly",
  expiry: "",
  ds: undefined as string | null | undefined,
  features: {} as Record<string, boolean>,
  branding: {
    shopName: "",
    shopNameUr: "",
  },
};

function daysLeft(exp: string) {
  return Math.ceil(
    (new Date(exp + "T23:59:59").getTime() - Date.now()) / 86_400_000,
  );
}

export default function Admin() {
  const router = useRouter();
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState<any>(null);
  const [code, setCode] = useState("");
  // shown after every save — remind the owner to log out of this device
  const [reminder, setReminder] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/customers");
    if (r.status === 401) return router.replace("/admin/login");
    setList((await r.json()).list);
  }, [router]);
  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    const r = await fetch("/api/admin/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!r.ok) return toast.error("Save failed");
    toast.success("Saved");
    setForm(null);
    setReminder(true);
    load();
  }
  async function genCode(cid: string) {
    const r = await fetch("/api/admin/code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cid }),
    });
    const j = await r.json();
    if (!r.ok) return toast.error(j.error ?? "Failed");
    setCode(j.code);
  }
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Shops</h1>
        <div className="flex gap-2">
          <Button
            onClick={() =>
              setForm({
                ...blank,
                features: Object.fromEntries(
                  FEATURES.map((f) => [f.key, true]),
                ),
              })
            }
          >
            <Plus className="mr-1.5 size-4" />
            New Shop
          </Button>
          <Button variant="outline" onClick={logout}>
            <LogOut className="mr-1.5 size-4" />
            Logout
          </Button>
        </div>
      </div>

      {reminder && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <ShieldAlert className="size-4 shrink-0" />
          <p className="min-w-48 flex-1">
            Changes saved. You are still logged in as <b>admin</b> on this
            device — log out to keep it secure.
          </p>
          <Button size="sm" onClick={logout}>
            <LogOut className="mr-1 size-3.5" />
            Log out now
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReminder(false)}
          >
            Stay logged in
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="divide-y p-0">
          {[...list]
            .sort((a, b) => a.expiry.localeCompare(b.expiry))
            .map((s) => {
              const dl = daysLeft(s.expiry);
              return (
                <div
                  key={s.cid}
                  className="flex flex-wrap items-center gap-2 p-4 text-sm"
                >
                  <div className="min-w-40 flex-1">
                    <p className="font-medium">
                      {s.branding?.shopName || s.cid}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.cid} · {s.plan}
                      {s.ds ? "" : " · not activated"}
                    </p>
                  </div>
                  <Badge
                    className={
                      dl < 0
                        ? "bg-red-600"
                        : dl <= 7
                          ? "bg-amber-500"
                          : "bg-emerald-600"
                    }
                  >
                    {dl < 0
                      ? `expired ${-dl}d ago`
                      : dl <= 7
                        ? `${dl}d left`
                        : s.expiry}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setForm({
                        ...blank,
                        ...s,
                        branding: { ...blank.branding, ...s.branding },
                        features: { ...s.features },
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => genCode(s.cid)}
                  >
                    Get Code
                  </Button>
                </div>
              );
            })}
          {list.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No shops yet
            </p>
          )}
        </CardContent>
      </Card>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Home className="mt-0.5 size-3.5 shrink-0" />
        Address, phone, currency, tax and receipt footers are now edited by the
        shop itself in the app under Settings → Shop Details. The receipt logo
        is the file bundled with the app at{" "}
        <span className="num font-medium text-foreground">
          public/icons/logo.png
        </span>{" "}
        — replace that file to change it.
      </p>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {form?.cid ? `Edit ${form.cid}` : "New Shop"}
            </DialogTitle>
          </DialogHeader>
          {form && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Shop ID</Label>
                  <Input
                    value={form.cid}
                    disabled={!!list.find((x) => x.cid === form.cid)}
                    onChange={(e) =>
                      setForm({ ...form, cid: e.target.value.toUpperCase() })
                    }
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Permanent once created — it is the license key in the
                    registry and the login ID the shop types in.
                  </p>
                </div>
                <div>
                  <Label>Expiry</Label>
                  <Input
                    type="date"
                    value={form.expiry}
                    onChange={(e) =>
                      setForm({ ...form, expiry: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Plan</Label>
                  <select
                    className="h-9 rounded-md border px-2"
                    value={form.plan}
                    onChange={(e) => setForm({ ...form, plan: e.target.value })}
                  >
                    <option>monthly</option>
                    <option>quarterly</option>
                    <option>yearly</option>
                  </select>
                </div>
                <div>
                  <Label>Status</Label>
                  <select
                    className="h-9 rounded-md border px-2"
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                  >
                    <option value="active">active</option>
                    <option value="revoked">
                      revoked (kill on next update)
                    </option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Shop Name (EN)</Label>
                  <Input
                    value={form.branding.shopName}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        branding: {
                          ...form.branding,
                          shopName: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Shop Name (Urdu)</Label>
                  <Input
                    className="urdu"
                    value={form.branding.shopNameUr}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        branding: {
                          ...form.branding,
                          shopNameUr: e.target.value,
                        },
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Features</Label>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {FEATURES.map((f) => (
                    <label
                      key={f.key}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={form.features[f.key] === true}
                        onCheckedChange={(v) =>
                          setForm({
                            ...form,
                            features: { ...form.features, [f.key]: v === true },
                          })
                        }
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-red-600">
                <Checkbox
                  checked={form.ds === null}
                  onCheckedChange={(v) =>
                    setForm({ ...form, ds: v ? null : undefined })
                  }
                />
                <RotateCcw className="size-3.5" />
                Reset device binding (customer changed laptop)
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!code} onOpenChange={(o) => !o && setCode("")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activation Code (send via WhatsApp)</DialogTitle>
          </DialogHeader>
          <textarea
            readOnly
            value={code}
            rows={5}
            className="w-full rounded-md border p-2 text-xs"
          />
          <Button
            onClick={() => {
              navigator.clipboard.writeText(code);
              toast.success("Copied");
            }}
          >
            Copy
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
