// src/app/api/admin/customers/route.ts
import { kvGet, kvSet } from "@/lib/server/kv";
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
const clean = (s: unknown, max = 200) =>
  String(s ?? "")
    .slice(0, max)
    .trim();

export async function GET(req: NextRequest) {
  if (!(await auth(req)))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const idx = (await kvGet<string[]>("cust_index")) ?? [];
  const list = (await Promise.all(idx.map((c) => kvGet(`cust:${c}`)))).filter(
    Boolean,
  );
  return NextResponse.json({ list });
}

export async function POST(req: NextRequest) {
  if (!(await auth(req)))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json();
  const cid = clean(b.cid, 24).toUpperCase();
  if (!/^[A-Z0-9_-]{2,24}$/.test(cid))
    return NextResponse.json({ error: "BAD_CID" }, { status: 400 });
  const prev = (await kvGet<any>(`cust:${cid}`)) ?? {};
  let ds = prev.ds;
  if (b.ds === null) ds = null;
  else if (typeof b.ds === "string" && b.ds) ds = b.ds;
  const rec = {
    cid,
    status: b.status === "revoked" ? "revoked" : "active",
    plan: ["monthly", "quarterly", "yearly"].includes(b.plan)
      ? b.plan
      : "monthly",
    expiry: /^\d{4}-\d{2}-\d{2}$/.test(b.expiry ?? "")
      ? b.expiry
      : "1970-01-01",
    ds,
    fp: prev.fp ?? "",
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
    },
    updatedAt: Date.now(),
  };
  await kvSet(`cust:${cid}`, rec);
  const idx = (await kvGet<string[]>("cust_index")) ?? [];
  if (!idx.includes(cid)) await kvSet("cust_index", [...idx, cid]);
  return NextResponse.json({ ok: true });
}
