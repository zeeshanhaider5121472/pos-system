import nacl from "tweetnacl";
import { getSetting, setSetting } from "./db";

export const WARNING_DAYS = 7;
export const GRACE_DAYS = 3; // read-only days after expiry; set 0 for a hard stop on expiry day
const PUB = process.env.NEXT_PUBLIC_LICENSE_PUBLIC_KEY!;

export interface LicensePayload {
  cid: string;
  fp: string;
  ds?: string; // legacy codes carried the raw device secret
  dsHash?: string; // current codes carry sha256(deviceSecret)
  iat: number;
  exp: string;
  plan: string;
  status: "active" | "revoked";
  features: Record<string, boolean>;
  branding: Record<string, string | number>;
}
export type LicState =
  | "none"
  | "active"
  | "warning"
  | "grace"
  | "locked"
  | "tampered";

const utf8 = new TextEncoder();
const hexToBytes = (h: string) =>
  new Uint8Array(h.match(/../g)!.map((x) => parseInt(x, 16)));
const b64 = {
  enc: (s: string) => btoa(unescape(encodeURIComponent(s))),
  dec: (s: string) => decodeURIComponent(escape(atob(s))),
};

/** 256-bit secret generated once per laptop — its identity, and sync/auth credential */
export async function deviceSecret(): Promise<string> {
  let ds = localStorage.getItem("_ds_v1") ?? (await getSetting("ds"));
  if (!ds) {
    ds = b64.enc(String.fromCharCode(...nacl.randomBytes(32)));
    localStorage.setItem("_ds_v1", ds);
    await setSetting("ds", ds);
  }
  return ds;
}

/** sha256 of the device secret — what db.json stores instead of the raw ds */
export async function dsHashOf(ds: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(ds),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function verifySig(d: LicensePayload, s: string): boolean {
  try {
    return nacl.sign.detached.verify(
      utf8.encode(JSON.stringify(d)),
      hexToBytes(s),
      hexToBytes(PUB),
    );
  } catch {
    return false;
  }
}

export async function activateWithCode(
  code: string,
  myDs: string,
): Promise<LicensePayload> {
  const { d, s } = JSON.parse(b64.dec(code.trim()));
  if (!verifySig(d, s)) throw new Error("INVALID_CODE");
  if (d.status !== "active") throw new Error("REVOKED");
  if (d.dsHash ? (await dsHashOf(myDs)) !== d.dsHash : d.ds !== myDs)
    throw new Error("DEVICE_MISMATCH");
  const now = String(Date.now());
  await Promise.all([
    setSetting("license", { d, s }),
    setSetting("licenseB", { d, s }),
    setSetting("lastSeen", Date.now()),
    new Promise<void>((r) => {
      localStorage.setItem("_ls_v1", now);
      r();
    }),
  ]);
  return d;
}

export async function getLicense(): Promise<LicensePayload | null> {
  return (
    ((await getSetting("license")) ?? (await getSetting("licenseB")))?.d ?? null
  );
}
export async function getBranding(): Promise<Record<string, any>> {
  return (await getLicense())?.branding ?? {};
}

/** Runs on every launch, fully offline. Re-verifies the signature each time. */
export async function evaluateLicense(): Promise<{
  state: LicState;
  daysLeft: number;
  lic: LicensePayload | null;
}> {
  const stored =
    (await getSetting("license")) ?? (await getSetting("licenseB"));
  const lastSeen = Math.max(
    Number(localStorage.getItem("_ls_v1")) || 0,
    ((await getSetting("lastSeen")) as number) || 0,
  );
  const touch = () =>
    Promise.all([
      setSetting("lastSeen", Date.now()),
      new Promise<void>((r) => {
        localStorage.setItem("_ls_v1", String(Date.now()));
        r();
      }),
    ]);

  if (Date.now() < lastSeen - 86_400_000)
    return { state: "tampered", daysLeft: 0, lic: null }; // clock rolled back
  await touch();
  if (!stored) return { state: "none", daysLeft: 0, lic: null };
  if (!verifySig(stored.d, stored.s))
    return { state: "tampered", daysLeft: 0, lic: null }; // expiry edited locally

  const lic = stored.d;
  const daysLeft = Math.ceil(
    (new Date(lic.exp + "T23:59:59").getTime() - Date.now()) / 86_400_000,
  );
  const state =
    daysLeft > WARNING_DAYS
      ? "active"
      : daysLeft > 0
        ? "warning"
        : daysLeft > -GRACE_DAYS
          ? "grace"
          : "locked";
  return { state, daysLeft, lic };
}

export const canSell = (s: LicState) => s === "active" || s === "warning";
export const canBrowse = (s: LicState) =>
  ["active", "warning", "grace"].includes(s);
/** true when the license expiry date has already passed (read-only applies) */
export const isExpired = (lic: LicensePayload | null | undefined) =>
  !!lic && Date.now() > new Date(lic.exp + "T23:59:59").getTime();
export const clockIsSane = (serverTime: number) =>
  Math.abs(Date.now() - serverTime) < 48 * 3_600_000;
