// src/app/api/admin/code/route.ts — offline renewal paste-code.
// The code is (re)generated whenever the shop is saved in /admin, so this
// just returns the stored one; it always reflects the last Save.
import { readRegistryGithub } from "@/lib/server/registry";
import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const tk = req.cookies.get("admin_sess")?.value;
  try {
    await jwtVerify(
      tk!,
      new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!),
    );
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const { cid } = await req.json();
    const { db } = await readRegistryGithub();
    const rec = db.shops.find((s) => s.cid === String(cid).toUpperCase());
    if (!rec)
      return NextResponse.json({ error: "UNKNOWN_SHOP" }, { status: 404 });
    if (!rec.dsHash || !rec.code)
      return NextResponse.json({ error: "NEVER_ACTIVATED" }, { status: 400 });
    return NextResponse.json({ code: rec.code });
  } catch (e) {
    const msg = String((e as Error)?.message ?? "");
    if (msg.includes("GITHUB_NOT_CONFIGURED"))
      return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
    return NextResponse.json({ error: "REGISTRY_UNREACHABLE" }, { status: 502 });
  }
}
