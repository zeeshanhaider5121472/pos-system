// GET /api/shop/status — does the server have the shop admin lock configured?
// Only reports a boolean; never leaks the values themselves.
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    configured: Boolean(process.env.SHOP_ID && process.env.SHOP_PASSWORD),
  });
}
