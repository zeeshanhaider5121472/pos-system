// POST /api/shop/login — shop-owner login that guards product & settings
// editing. Credentials are PER SHOP now: each record in db.json can carry its
// own login id + scrypt password hash, set from the owner console (/admin).
// The build's SHOP_ID decides which record this install belongs to.
// Offline: falls back to the last cached copy of the registry, so the lock
// keeps working after restarts as long as the server has seen db.json once.
import { readRegistryStatic, verifyPassword } from "@/lib/server/registry";
import { SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let body: { shopId?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* fall through with empty body */
  }
  const shopId = String(body?.shopId ?? "");
  const password = String(body?.password ?? "");

  const SID = process.env.SHOP_ID?.trim();
  if (!SID)
    return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let rec;
  try {
    const db = await readRegistryStatic({ allowCache: true });
    rec = db.shops.find((s) => s.cid === SID.toUpperCase());
  } catch {
    return NextResponse.json({ error: "offline" }, { status: 502 });
  }
  if (!rec?.admin)
    return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const idOk = rec.admin.user.toLowerCase() === shopId.trim().toLowerCase();
  if (!idOk || !verifyPassword(password, rec.admin))
    return NextResponse.json({ error: "wrong" }, { status: 401 });

  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret)
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });

  const token = await new SignJWT({ r: "shop" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("12h")
    .sign(new TextEncoder().encode(secret));

  const res = NextResponse.json({ ok: true });
  res.cookies.set("shop_sess", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return res;
}
