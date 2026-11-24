// src/app/api/license/route.ts
import { kvGet, kvIncr, kvSet } from "@/lib/server/kv";
import { NextRequest, NextResponse } from "next/server";
import nacl from "tweetnacl";

const hexToBytes = (h: string) =>
  new Uint8Array(h.match(/../g)!.map((x) => parseInt(x, 16)));

export async function GET(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") ?? "x").split(",")[0].trim();
  if ((await kvIncr(`rl:${ip}`)) > 20)
    return NextResponse.json({ error: "TOO_MANY" }, { status: 429 });

  const q = req.nextUrl.searchParams;
  const cid = (q.get("cid") ?? "").trim().toUpperCase();
  const fp = (q.get("fp") ?? "").trim();
  const ds = (q.get("ds") ?? "").trim();
  if (!cid || !ds)
    return NextResponse.json({ error: "MISSING_PARAMS" }, { status: 400 });

  const rec = await kvGet<any>(`cust:${cid}`);
  if (!rec)
    return NextResponse.json({ error: "UNKNOWN_SHOP" }, { status: 404 });
  if (rec.status === "revoked")
    return NextResponse.json({ error: "REVOKED" }, { status: 403 });
  if (rec.ds && rec.ds !== ds)
    return NextResponse.json({ error: "DEVICE_MISMATCH" }, { status: 403 });
  if (!rec.ds) {
    rec.ds = ds;
    rec.fp = fp;
    await kvSet(`cust:${cid}`, rec);
  }

  const payload = {
    cid,
    fp,
    ds,
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
  const code = Buffer.from(
    JSON.stringify({ d: payload, s: Buffer.from(sig).toString("hex") }),
  ).toString("base64");
  return NextResponse.json({ code, serverTime: Date.now() });
}
