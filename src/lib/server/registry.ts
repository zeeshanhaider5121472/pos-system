// src/lib/server/registry.ts — the whole "database" layer.
// Replaces Upstash: data/db.json lives in a GitHub repo. Reads come from the
// static Vercel URL (DB_JSON_URL); writes go through the GitHub Contents API
// (one PUT = commit + push to main; Vercel redeploys the static file).
//
// Because db.json is publicly readable, it must NEVER contain raw secrets:
//  - device binding stores sha256(deviceSecret), not the secret itself
//  - shop login passwords store scrypt(salt, password), never plaintext
import nacl from "tweetnacl";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export interface ShopAdmin {
  user: string;
  salt: string;
  hash: string;
}
export interface RegistryShop {
  cid: string;
  status: "active" | "revoked";
  plan: "monthly" | "quarterly" | "yearly";
  expiry: string; // YYYY-MM-DD
  dsHash?: string; // sha256(deviceSecret); "" until first activation
  fp?: string;
  features?: Record<string, boolean>;
  branding?: Record<string, string | number>;
  admin?: ShopAdmin; // per-shop login (set in /admin)
  code?: string | null; // pre-signed activation code (after dsHash is set)
  updatedAt?: number;
}
export interface Registry {
  v: 1;
  updatedAt: number;
  shops: RegistryShop[];
}

export const emptyRegistry = (): Registry => ({ v: 1, updatedAt: 0, shops: [] });

function normalizeRegistry(db: any): Registry {
  if (!db || typeof db !== "object" || !Array.isArray(db.shops))
    return emptyRegistry();
  return { v: 1, updatedAt: Number(db.updatedAt) || 0, shops: db.shops };
}

/* ── hashing ─────────────────────────────────────────────────────────────── */

export const sha256hex = (s: string) =>
  createHash("sha256").update(s).digest("hex");

export function hashPassword(pw: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 32).toString("hex");
  return { salt, hash };
}
export function verifyPassword(
  pw: string,
  admin?: Partial<ShopAdmin>,
): boolean {
  if (!admin?.salt || !admin?.hash) return false;
  try {
    const a = Buffer.from(admin.hash, "hex");
    const b = scryptSync(pw, admin.salt, 32);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/* ── in-memory rate limiter (per server instance) ───────────────────────── */

const RL = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs = 3_600_000) {
  const now = Date.now();
  const e = RL.get(key);
  if (!e || now > e.reset) {
    RL.set(key, { n: 1, reset: now + windowMs });
    return 1;
  }
  e.n += 1;
  return e.n;
}

/* ── reads: static URL (no token; works in shop builds) ─────────────────── */

let STATIC_CACHE: { db: Registry; at: number } | null = null;

export async function readRegistryStatic(
  opts: { allowCache?: boolean } = {},
): Promise<Registry> {
  const url = process.env.DB_JSON_URL;
  if (!url) throw new Error("DB_JSON_URL_NOT_CONFIGURED");
  try {
    const res = await fetch(
      `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`,
      { cache: "no-store" },
    );
    if (!res.ok) throw new Error(`DB_JSON_HTTP_${res.status}`);
    const db = normalizeRegistry(await res.json());
    STATIC_CACHE = { db, at: Date.now() };
    return db;
  } catch (e) {
    if (opts.allowCache && STATIC_CACHE) return STATIC_CACHE.db;
    throw e;
  }
}

/* ── reads/writes: GitHub Contents API (owner / control deployment) ─────── */

const GH = "https://api.github.com";
function ghCfg() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) return null;
  return {
    token,
    repo,
    branch: process.env.GITHUB_BRANCH || "main",
    path: process.env.DB_PATH || "data/db.json",
  };
}
const ghHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "Content-Type": "application/json",
});

/** Authoritative read straight from GitHub (not the CDN copy). */
export async function readRegistryGithub(): Promise<{
  db: Registry;
  sha: string | null;
}> {
  const cfg = ghCfg();
  if (!cfg) throw new Error("GITHUB_NOT_CONFIGURED");
  const res = await fetch(
    `${GH}/repos/${cfg.repo}/contents/${cfg.path}?ref=${cfg.branch}&t=${Date.now()}`,
    { headers: ghHeaders(cfg.token), cache: "no-store" },
  );
  if (res.status === 404) return { db: emptyRegistry(), sha: null };
  if (!res.ok) throw new Error(`GITHUB_READ_${res.status}`);
  const j = await res.json();
  const db = normalizeRegistry(
    JSON.parse(Buffer.from(j.content, "base64").toString("utf8")),
  );
  return { db, sha: j.sha as string };
}

/** One PUT = add + commit + push to main. This is the "Save" button. */
export async function commitRegistry(
  db: Registry,
  message: string,
): Promise<{ sha: string; url: string }> {
  const cfg = ghCfg();
  if (!cfg) throw new Error("GITHUB_NOT_CONFIGURED");
  const { sha } = await readRegistryGithub(); // current file sha (lost-update guard)
  const content = Buffer.from(JSON.stringify(db, null, 2) + "\n").toString(
    "base64",
  );
  const res = await fetch(`${GH}/repos/${cfg.repo}/contents/${cfg.path}`, {
    method: "PUT",
    headers: ghHeaders(cfg.token),
    body: JSON.stringify({
      message,
      branch: cfg.branch,
      sha: sha ?? undefined,
      content,
    }),
  });
  if (!res.ok)
    throw new Error(
      `GITHUB_COMMIT_${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  const j = await res.json();
  return { sha: j.commit.sha as string, url: j.commit.html_url as string };
}

/* ── license code signing (owner / control only) ────────────────────────── */

const hexToBytes = (h: string) =>
  new Uint8Array(h.match(/../g)!.map((x) => parseInt(x, 16)));

/** Signs the shop's record into a paste-code. Needs LICENSE_PRIVATE_KEY. */
export function buildCode(rec: RegistryShop): string {
  const payload = {
    cid: rec.cid,
    fp: rec.fp ?? "",
    dsHash: rec.dsHash ?? "",
    iat: Date.now(),
    plan: rec.plan ?? "monthly",
    status: "active" as const,
    exp: rec.expiry,
    features: rec.features ?? {},
    branding: rec.branding ?? {},
  };
  const sig = nacl.sign.detached(
    new TextEncoder().encode(JSON.stringify(payload)),
    hexToBytes(process.env.LICENSE_PRIVATE_KEY!),
  );
  return Buffer.from(
    JSON.stringify({ d: payload, s: Buffer.from(sig).toString("hex") }),
  ).toString("base64");
}

/* ── first-time activation: bind the device, commit, return the code ────── */

export type ClaimResult =
  | { ok: true; code: string }
  | { ok: false; status: number; error: string };

export async function claimDevice(
  cid: string,
  ds: string,
  fp: string,
): Promise<ClaimResult> {
  if (!process.env.GITHUB_TOKEN || !process.env.LICENSE_PRIVATE_KEY)
    return { ok: false, status: 503, error: "NOT_CONTROL_SERVER" };
  let db: Registry;
  try {
    ({ db } = await readRegistryGithub());
  } catch {
    return { ok: false, status: 502, error: "REGISTRY_UNREACHABLE" };
  }
  const rec = db.shops.find((s) => s.cid === cid);
  if (!rec) return { ok: false, status: 404, error: "UNKNOWN_SHOP" };
  if (rec.status === "revoked")
    return { ok: false, status: 403, error: "REVOKED" };
  const h = sha256hex(ds);
  if (rec.dsHash && rec.dsHash !== h)
    return { ok: false, status: 403, error: "DEVICE_MISMATCH" };
  if (!rec.dsHash || !rec.code) {
    rec.dsHash = h;
    rec.fp = fp;
    rec.code = buildCode(rec);
    rec.updatedAt = Date.now();
    db.updatedAt = Date.now();
    try {
      await commitRegistry(db, `claim: ${cid} device bound`);
    } catch {
      return { ok: false, status: 502, error: "REGISTRY_UNREACHABLE" };
    }
  }
  return { ok: true, code: rec.code! };
}

/* ── /admin form payload → clean registry record ─────────────────────────── */

const clean = (s: unknown, max = 200) =>
  String(s ?? "")
    .slice(0, max)
    .trim();

export function sanitizeShop(b: any, prev?: RegistryShop): RegistryShop {
  const cid = clean(b.cid, 24).toUpperCase();
  const rec: RegistryShop = {
    cid,
    status: b.status === "revoked" ? "revoked" : "active",
    plan: ["monthly", "quarterly", "yearly"].includes(b.plan)
      ? b.plan
      : "monthly",
    expiry: /^\d{4}-\d{2}-\d{2}$/.test(b.expiry ?? "") ? b.expiry : "1970-01-01",
    dsHash: b.ds === null ? "" : (prev?.dsHash ?? ""), // reset binding
    fp: prev?.fp ?? "",
    features: Object.fromEntries(
      Object.entries(b.features ?? {}).map(([k, v]) => [k, v === true]),
    ),
    branding: {
      shopName: clean(b.branding?.shopName, 60),
      shopNameUr: clean(b.branding?.shopNameUr, 60),
      address: clean(b.branding?.address, 200),
      phone: clean(b.branding?.phone, 30),
      footerEn: clean(b.branding?.footerEn, 200),
      footerUr: clean(b.branding?.footerUr, 200),
      currency: clean(b.branding?.currency, 8) || "Rs",
      taxRate: Math.max(0, Math.min(50, Number(b.branding?.taxRate) || 0)),
      taxName: clean(b.branding?.taxName, 12) || "Tax",
      // large limit: allows https URLs and embedded data:image/... logos
      logoUrl: clean(b.branding?.logoUrl, 300_000),
    },
    admin: prev?.admin,
    code: null,
    updatedAt: Date.now(),
  };
  // per-shop login: blank password on edit = keep current; blank on create = no lock
  const user = clean(b.admin?.user, 24).toLowerCase();
  const pass = String(b.admin?.pass ?? "");
  if (prev?.admin) {
    if (pass) rec.admin = { user: user || prev.admin.user, ...hashPassword(pass) };
    else if (user) rec.admin = { ...prev.admin, user };
  } else if (pass && user) {
    rec.admin = { user, ...hashPassword(pass) };
  }
  // regenerate the signed code on every save (reflects new expiry/features)
  rec.code = rec.dsHash ? buildCode(rec) : null;
  return rec;
}
