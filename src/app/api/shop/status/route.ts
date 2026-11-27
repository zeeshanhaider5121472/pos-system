// GET /api/shop/status — is the per-shop admin lock configured?
// The lock is ON when SHOP_ID is set in this build AND the registry record
// for that shop carries login credentials (set in /admin). Fails CLOSED:
// if db.json is unreachable and not cached we still report configured=true —
// a temporary network problem must never silently unlock product editing.
import { readRegistryStatic } from "@/lib/server/registry";
import { connection, NextResponse } from "next/server";

// must run per-request (reads env + fetches db.json), never prerendered
export async function GET() {
  await connection();
  const SID = process.env.SHOP_ID?.trim();
  if (!SID) return NextResponse.json({ configured: false });
  try {
    const db = await readRegistryStatic({ allowCache: true });
    const rec = db.shops.find((s) => s.cid === SID.toUpperCase());
    // no record yet (misconfigured SHOP_ID) → keep the lock closed too
    return NextResponse.json({ configured: !rec || !!rec.admin });
  } catch {
    return NextResponse.json({ configured: true });
  }
}
