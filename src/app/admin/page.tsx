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
import { LogOut, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const blank = {
  cid: "",
  status: "active",
  plan: "monthly",
  expiry: "",
  ds: undefined as string | null | undefined,
  admin: { user: "", pass: "" },
  features: {} as Record<string, boolean>,
  branding: {
    shopName: "",
    shopNameUr: "",
    address: "",
    phone: "",
    footerEn: "Exchange within 7 days with receipt",
    footerUr: "7 دن کے اندر رسید کے ساتھ تبدیلی ممکن ہے",
    currency: "Rs",
    taxRate: 0,
    taxName: "Tax",
    logoUrl: "",
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
  const [info, setInfo] = useState<any>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/customers");
    if (r.status === 401) return router.replace("/admin/login");
    const j = await r.json().catch(() => ({}));
    if (!Array.isArray(j.list)) {
      setList([]);
      toast.error(
        j.error === "NOT_CONFIGURED"
          ? "GITHUB_TOKEN / GITHUB_REPO not set in .env.local — add them and restart npm run dev"
          : `Could not read db.json from GitHub${j.detail ? ` (${j.detail})` : ""}`,
      );
      return;
    }
    setList(j.list);
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
    const j = await r.json().catch(() => ({}));
    if (!r.ok)
      return toast.error(
        j.error === "NOT_CONFIGURED"
          ? "GITHUB_TOKEN not set on this server"
          : "Save failed — GitHub unreachable?",
      );
    toast.success(
      j.commit ? `Saved — commit ${j.commit.sha} pushed to main` : "Saved",
    );
    setForm(null);
    load();
  }
  async function del(cid: string) {
    if (
      !confirm(
        `Delete ${cid}? The shop locks out on its next sync. Git history keeps every old version.`,
      )
    )
      return;
    const r = await fetch(
      `/api/admin/customers?cid=${encodeURIComponent(cid)}`,
      {
        method: "DELETE",
      },
    );
    if (!r.ok) return toast.error("Delete failed");
    toast.success("Deleted — commit pushed to main");
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
      <Card>
        <CardContent className="divide-y p-0">
          {[...(Array.isArray(list) ? list : [])]
            .sort((a, b) => a.expiry.localeCompare(b.expiry))
            .map((s) => {
              const dl = daysLeft(s.expiry);
              return (
                <div
                  key={s.cid}
                  onClick={() => setInfo(s)}
                  title="Click to view login details"
                  className="flex flex-wrap cursor-pointer items-center gap-2 p-4 text-sm hover:bg-muted/40"
                >
                  <div className="min-w-40 flex-1">
                    <p className="font-medium">
                      {s.branding?.shopName || s.cid}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.cid} · {s.plan}
                      {s.dsHash ? "" : " · not activated"}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      setForm({
                        ...blank,
                        ...s,
                        branding: { ...blank.branding, ...s.branding },
                        features: { ...s.features },
                        admin: { user: s.adminUser ?? "", pass: "" },
                      });
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      genCode(s.cid);
                    }}
                  >
                    Get Code
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      del(s.cid);
                    }}
                    title="Delete shop"
                  >
                    <Trash2 className="size-4" />
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
                  <Label>Login ID (this shop&apos;s owner)</Label>
                  <Input
                    value={form.admin.user}
                    placeholder="e.g. shop01"
                    onChange={(e) =>
                      setForm({
                        ...form,
                        admin: { ...form.admin, user: e.target.value },
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Login Password</Label>
                  <Input
                    type="password"
                    value={form.admin.pass}
                    placeholder={
                      form.cid && list.find((x) => x.cid === form.cid)
                        ? "blank = keep current"
                        : "blank = no login lock"
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        admin: { ...form.admin, pass: e.target.value },
                      })
                    }
                  />
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
                <div>
                  <Label>Address</Label>
                  <Input
                    value={form.branding.address}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        branding: { ...form.branding, address: e.target.value },
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={form.branding.phone}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        branding: { ...form.branding, phone: e.target.value },
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Input
                    value={form.branding.currency}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        branding: {
                          ...form.branding,
                          currency: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Tax %</Label>
                  <Input
                    type="number"
                    value={form.branding.taxRate}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        branding: {
                          ...form.branding,
                          taxRate: Number(e.target.value),
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Footer (EN)</Label>
                  <Input
                    value={form.branding.footerEn}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        branding: {
                          ...form.branding,
                          footerEn: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Footer (Urdu)</Label>
                  <Input
                    className="urdu"
                    value={form.branding.footerUr}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        branding: {
                          ...form.branding,
                          footerUr: e.target.value,
                        },
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>
                  Logo URL (printed on receipts — https link or data:image/…)
                </Label>
                <Input
                  placeholder="https://example.com/logo.png"
                  value={form.branding.logoUrl ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      branding: {
                        ...form.branding,
                        logoUrl: e.target.value,
                      },
                    })
                  }
                />
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

      <Dialog open={!!info} onOpenChange={(o) => !o && setInfo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Login Details — {info?.branding?.shopName || info?.cid}
            </DialogTitle>
          </DialogHeader>
          {info && (
            <div className="grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Shop ID</span>
                <code className="rounded bg-muted px-2 py-0.5 font-mono font-semibold">
                  {info.cid}
                </code>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Login ID</span>
                {info.adminUser ? (
                  <code className="rounded bg-muted px-2 py-0.5 font-mono font-semibold">
                    {info.adminUser}
                  </code>
                ) : (
                  <span className="text-muted-foreground">
                    not set — no login lock
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Password</span>
                <span className="text-muted-foreground">
                  ••••• stored hashed — cannot be shown
                </span>
              </div>
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                db.json is public, so passwords are stored as one-way scrypt
                hashes — they can never be displayed or recovered, not even
                here. If a shop forgot its password, set a new one below; the
                old one stops working right after Save.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `Shop ID: ${info.cid}\nLogin ID: ${info.adminUser || "(not set)"}`,
                    );
                    toast.success("Copied");
                  }}
                >
                  Copy IDs
                </Button>
                <Button
                  onClick={() => {
                    const s = info;
                    setInfo(null);
                    setForm({
                      ...blank,
                      ...s,
                      branding: { ...blank.branding, ...s.branding },
                      features: { ...s.features },
                      admin: { user: s.adminUser ?? "", pass: "" },
                    });
                  }}
                >
                  Set New Password
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
