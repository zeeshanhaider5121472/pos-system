// src/app/api/claim/route.ts — public first-time-activation endpoint.
// Runs on the CONTROL deployment (your Vercel deployment of this app), which
// holds GITHUB_TOKEN + LICENSE_PRIVATE_KEY. Shop builds never call this from
// the browser — their local /api/license proxies here only while the device
// is not yet bound. Idempotent: claiming again from the same device just
// returns the current code without committing.
import { claimDevice, rateLimit } from "@/lib/server/registry";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") ?? "x").split(",")[0].trim();
  if (rateLimit(`claim:${ip}`, 10) > 10)
    return NextResponse.json({ error: "TOO_MANY" }, { status: 429 });
  let b: { cid?: string; ds?: string; fp?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "MISSING_PARAMS" }, { status: 400 });
  }
  const cid = String(b.cid ?? "").trim().toUpperCase();
  const ds = String(b.ds ?? "").trim();
  const fp = String(b.fp ?? "").trim();
  if (!cid || !ds)
    return NextResponse.json({ error: "MISSING_PARAMS" }, { status: 400 });
  const r = await claimDevice(cid, ds, fp);
  return r.ok
    ? NextResponse.json({ code: r.code, serverTime: Date.now() })
    : NextResponse.json({ error: r.error }, { status: r.status });
}
