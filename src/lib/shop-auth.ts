"use client";
// Client-side helper for the shop-owner admin lock.
// Credentials live in the server environment (SHOP_ID / SHOP_PASSWORD) and are
// verified by /api/shop/login, so the password is never shipped in the JS bundle.
// The unlocked flag lives in sessionStorage: it survives reloads but is cleared
// when the tab/browser is closed, or when the owner presses "Log out Admin".
import { useEffect, useState } from "react";

const KEY = "shop_admin_unlocked";
export const SHOP_LOCK_EVENT = "shoplockchange";

export type ShopLoginResult = "ok" | "wrong" | "not_configured" | "offline";

export function isShopUnlocked(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function broadcast() {
  window.dispatchEvent(new Event(SHOP_LOCK_EVENT));
}

export function markShopUnlocked() {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
  broadcast();
}

export function lockShop() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  broadcast();
}

export async function shopLogin(
  shopId: string,
  password: string,
): Promise<ShopLoginResult> {
  try {
    const r = await fetch("/api/shop/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopId, password }),
    });
    if (r.ok) {
      markShopUnlocked();
      return "ok";
    }
    if (r.status === 401) return "wrong";
    if (r.status === 503) return "not_configured";
    return "offline";
  } catch {
    return "offline";
  }
}

export async function shopLogout() {
  lockShop();
  try {
    await fetch("/api/shop/logout", { method: "POST" });
  } catch {
    /* offline is fine — sessionStorage flag is already cleared */
  }
}

/** true when the shop admin lock is active on the server (SHOP_ID + SHOP_PASSWORD set) */
export function useShopLockConfigured() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/shop/status")
      .then((r) => r.json())
      .then((j) => live && setConfigured(Boolean(j?.configured)))
      .catch(() => live && setConfigured(false));
    return () => {
      live = false;
    };
  }, []);
  return configured; // null = still checking, false = lock off, true = lock on
}

/** reactive unlocked state, synced across components via the lock event */
export function useShopUnlocked() {
  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => {
    const sync = () => setUnlocked(isShopUnlocked());
    sync();
    window.addEventListener(SHOP_LOCK_EVENT, sync);
    return () => window.removeEventListener(SHOP_LOCK_EVENT, sync);
  }, []);
  return unlocked;
}
