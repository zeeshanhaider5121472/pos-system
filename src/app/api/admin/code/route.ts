// src/app/api/admin/code/route.ts — generate a paste-code for offline customers (after first activation)
import { kvGet } from "@/lib/server/kv";
import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import nacl from "tweetnacl";
const hexToBytes = (h: string) =>
  new Uint8Array(h.match(/../g)!.map((x) => parseInt(x, 16)));

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
  const { cid } = await req.json();
  const rec = await kvGet<any>(`cust:${String(cid).toUpperCase()}`);
  if (!rec)
    return NextResponse.json({ error: "UNKNOWN_SHOP" }, { status: 404 });
  if (!rec.ds)
    return NextResponse.json({ error: "NEVER_ACTIVATED" }, { status: 400 });
  const payload = {
    cid: rec.cid,
    fp: rec.fp ?? "",
    ds: rec.ds,
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
  return NextResponse.json({ code });
}
