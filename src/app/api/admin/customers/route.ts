// src/app/api/admin/customers/route.ts — owner console CRUD.
// The registry is data/db.json in your GitHub repo. Every Save is a commit +
// push to main (GitHub Contents API); the connected Vercel static deployment
// picks it up seconds later. Git history = full audit log of every change.
import {
  commitRegistry,
  readRegistryGithub,
  sanitizeShop,
  type RegistryShop,
} from "@/lib/server/registry";
import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

async function auth(req: NextRequest) {
  const tk = req.cookies.get("admin_sess")?.value;
  if (!tk) return false;
  try {
    await jwtVerify(
      tk,
      new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!),
    );
    return true;
  } catch {
    return false;
  }
}

/** never send password hashes or the long code to the browser list */
const publicView = (s: RegistryShop) => ({
  ...s,
  admin: undefined,
  adminUser: s.admin?.user ?? "",
  code: undefined,
});

function mapErr(e: unknown) {
  const msg = String((e as Error)?.message ?? "");
  if (msg.includes("GITHUB_NOT_CONFIGURED"))
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  return NextResponse.json(
    { error: "REGISTRY_UNREACHABLE", detail: msg.slice(0, 140) },
    { status: 502 },
  );
}

export async function GET(req: NextRequest) {
  if (!(await auth(req)))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { db } = await readRegistryGithub();
    return NextResponse.json({ list: db.shops.map(publicView) });
  } catch (e) {
    return mapErr(e);
  }
}

export async function POST(req: NextRequest) {
  if (!(await auth(req)))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const b = await req.json();
    const cid = String(b.cid ?? "")
      .trim()
      .toUpperCase();
    if (!/^[A-Z0-9_-]{2,24}$/.test(cid))
      return NextResponse.json({ error: "BAD_CID" }, { status: 400 });
    const { db } = await readRegistryGithub();
    const rec = sanitizeShop(
      b,
      db.shops.find((s) => s.cid === cid),
    );
    const i = db.shops.findIndex((s) => s.cid === cid);
    if (i >= 0) db.shops[i] = rec;
    else db.shops.push(rec);
    db.updatedAt = Date.now();
    const c = await commitRegistry(db, `admin: ${cid} saved`);
    return NextResponse.json({
      ok: true,
      commit: { sha: c.sha.slice(0, 7), url: c.url },
    });
  } catch (e) {
    return mapErr(e);
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await auth(req)))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const cid = (req.nextUrl.searchParams.get("cid") ?? "")
      .trim()
      .toUpperCase();
    if (!cid) return NextResponse.json({ error: "BAD_CID" }, { status: 400 });
    const { db } = await readRegistryGithub();
    if (!db.shops.some((s) => s.cid === cid))
      return NextResponse.json({ error: "UNKNOWN_SHOP" }, { status: 404 });
    db.shops = db.shops.filter((s) => s.cid !== cid);
    db.updatedAt = Date.now();
    const c = await commitRegistry(db, `admin: ${cid} deleted`);
    return NextResponse.json({
      ok: true,
      commit: { sha: c.sha.slice(0, 7), url: c.url },
    });
  } catch (e) {
    return mapErr(e);
  }
}
