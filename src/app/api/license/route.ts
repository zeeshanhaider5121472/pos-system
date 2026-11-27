// src/app/api/license/route.ts — license sync ("Update Subscription").
// Shop builds: reads the public db.json (DB_JSON_URL). First-time device
// binding needs a registry WRITE, which is delegated to whoever holds the
// owner keys — this server itself (dev machine / control deployment) or the
// control deployment via CONTROL_URL. No secret ever ships in a shop build.
import { claimDevice, rateLimit, readRegistryStatic, sha256hex } from "@/lib/server/registry";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") ?? "x").split(",")[0].trim();
  if (rateLimit(`rl:${ip}`, 20) > 20)
    return NextResponse.json({ error: "TOO_MANY" }, { status: 429 });

  const q = req.nextUrl.searchParams;
  const cid = (q.get("cid") ?? "").trim().toUpperCase();
  const fp = (q.get("fp") ?? "").trim();
  const ds = (q.get("ds") ?? "").trim();
  if (!cid || !ds)
    return NextResponse.json({ error: "MISSING_PARAMS" }, { status: 400 });

  let db;
  try {
    db = await readRegistryStatic({ allowCache: true });
  } catch {
    return NextResponse.json({ error: "REGISTRY_UNREACHABLE" }, { status: 502 });
  }
  const rec = db.shops.find((s) => s.cid === cid);
  if (!rec)
    return NextResponse.json({ error: "UNKNOWN_SHOP" }, { status: 404 });
  if (rec.status === "revoked")
    return NextResponse.json({ error: "REVOKED" }, { status: 403 });

  const h = sha256hex(ds);
  if (rec.dsHash && rec.dsHash !== h)
    return NextResponse.json({ error: "DEVICE_MISMATCH" }, { status: 403 });

  // Already bound to this device → serve the stored (owner-signed) code.
  if (rec.dsHash && rec.code)
    return NextResponse.json({ code: rec.code, serverTime: Date.now() });

  // First activation on this device → needs a registry write.
  if (process.env.GITHUB_TOKEN && process.env.LICENSE_PRIVATE_KEY) {
    const r = await claimDevice(cid, ds, fp);
    return r.ok
      ? NextResponse.json({ code: r.code, serverTime: Date.now() })
      : NextResponse.json({ error: r.error }, { status: r.status });
  }
  const control = process.env.CONTROL_URL;
  if (!control)
    return NextResponse.json({ error: "NEED_VENDOR_SERVER" }, { status: 503 });
  try {
    const r = await fetch(`${control.replace(/\/$/, "")}/api/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cid, ds, fp }),
      cache: "no-store",
    });
    const j = await r.json();
    return NextResponse.json(j, { status: r.status });
  } catch {
    return NextResponse.json({ error: "REGISTRY_UNREACHABLE" }, { status: 502 });
  }
}
