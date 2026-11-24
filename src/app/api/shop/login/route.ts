// POST /api/shop/login — shop-owner login that guards product & settings editing.
// Credentials come from the server environment (SHOP_ID / SHOP_PASSWORD), so they
// are never included in the client bundle. Sets a session cookie (no maxAge),
// which the browser clears when it closes.
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
  const SPW = process.env.SHOP_PASSWORD;
  if (!SID || !SPW)
    return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const idOk = shopId.trim().toLowerCase() === SID.toLowerCase();
  const pwOk = password === SPW;
  if (!idOk || !pwOk)
    return NextResponse.json({ error: "wrong" }, { status: 401 });

  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "server_misconfigured" },
      { status: 500 },
    );

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
