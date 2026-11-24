// src/app/api/admin/login/route.ts
import { SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (password !== process.env.ADMIN_PASSWORD)
    return NextResponse.json({ error: "wrong" }, { status: 401 });
  const token = await new SignJWT({ r: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!));
  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_sess", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 604800,
    path: "/",
  });
  return res;
}
