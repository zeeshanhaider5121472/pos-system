// src/proxy.ts — Next 16 (if your version expects middleware.ts, rename this file and keep the same code)
import { NextRequest, NextResponse } from "next/server";
export function proxy(req: NextRequest) {
  if (
    req.nextUrl.pathname.startsWith("/admin") &&
    req.nextUrl.pathname !== "/admin/login" &&
    !req.cookies.get("admin_sess")
  )
    return NextResponse.redirect(new URL("/admin/login", req.url));
  return NextResponse.next();
}
export const config = { matcher: ["/admin/:path*"] };
