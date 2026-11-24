"use client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { getSetting } from "@/lib/db";
import { useT } from "@/lib/i18n";
import { canBrowse, evaluateLicense, type LicensePayload } from "@/lib/license";
import {
  BarChart3,
  Languages,
  Menu,
  Package,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/", icon: BarChart3, flag: "dashboard", key: "dashboard" },
  { href: "/pos", icon: ShoppingCart, flag: "pos", key: "newSale" },
  { href: "/products", icon: Package, flag: "products", key: "products" },
  { href: "/customers", icon: Users, flag: "customers", key: "customers" },
  { href: "/reports", icon: BarChart3, flag: "reportsBasic", key: "reports" },
  { href: "/settings", icon: Settings, flag: "settings", key: "settings" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { t, lang, setLang } = useT();
  const path = usePathname();
  const router = useRouter();
  const [lic, setLic] = useState<LicensePayload | null>(null);
  const [open, setOpen] = useState(false);

  // apply the saved UI size (Settings → UI Size) across the whole app
  useEffect(() => {
    const apply = (v: unknown) => {
      if (typeof v === "number")
        document.documentElement.style.fontSize = `${v}%`;
    };
    getSetting("fontScale").then(apply);
    const h = (e: Event) => apply((e as CustomEvent).detail);
    window.addEventListener("fontscale", h);
    return () => window.removeEventListener("fontscale", h);
  }, []);

  useEffect(() => {
    let live = true;
    evaluateLicense().then((r) => {
      if (!live) return;
      if (!canBrowse(r.state)) {
        router.replace("/activation");
        return;
      }
      setLic(r.lic);
    });
    return () => {
      live = false;
    };
  }, [path, router]);

  // IMPORTANT: {children} must ALWAYS be rendered. Conditionally hiding it
  // (e.g. behind a loading spinner) drops the page segment from Next.js'
  // instant-navigation validation — the "Could not validate that a segment in
  // your UI has instant navigation" build error.
  const f = lic?.features ?? {};
  const links = NAV.filter((n) => f[n.flag] !== false);
  const nav = (cls: string) =>
    links.map((n) => (
      <Link
        key={n.href}
        href={n.href}
        onClick={() => setOpen(false)}
        className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium ${cls}`}
      >
        <n.icon className="size-4" />
        {t(n.key)}
      </Link>
    ));

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 flex-col border-r px-3 py-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <Store className="size-5" />
          <span className="truncate text-sm font-semibold">
            {lic
              ? String(lic.branding?.shopName ?? t("appName"))
              : t("appName")}
          </span>
        </div>
        {nav("text-muted-foreground hover:bg-accent/60")}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background px-4 py-2.5">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="size-5" />
                </Button>
              }
            />
            <SheetContent side="left" className="w-56 pt-10">
              {nav("")}
            </SheetContent>
          </Sheet>
          <div className="flex-1" />
          {!lic && (
            <RefreshCw className="size-3.5 animate-spin text-muted-foreground" />
          )}
          <button
            onClick={() => setLang(lang === "en" ? "ur" : "en")}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
          >
            <Languages className="size-3.5" />
            {lang === "en" ? "اردو" : "English"}
          </button>
          {lic && (
            <Link
              href="/settings"
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
            >
              <ShieldCheck className="size-3.5" />
              {t("validUntil")} {lic.exp}
            </Link>
          )}
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
