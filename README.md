## Desktop (.exe) readiness

The app is already desktop-compatible — I verified the three things that usually break: all API calls are relative (/api/...), all data lives in IndexedDB/localStorage (works offline, Electron stores it in its own user-data folder), and the logo/assets load from the bundled public/ folder with a fixed path. window.print() also works inside Electron. When you're ready to build the .exe, the right approach is Electron wrapping the Next.js server (keeps your /api/license Upstash routes working):

npm i -D electron electron-builder
Create electron/main.js that spawns next start -p 3456 (from the packaged .next build) and opens a BrowserWindow at http://localhost:3456
Add "main": "electron/main.js" to package.json and an electron-builder config (NSIS target for Windows)
npm run build && npx electron-builder → produces the .exe installer

## Clothing POS

Offline-first POS for clothing shops (English / اردو). Data lives in the browser(IndexedDB), receipts print on 80mm thermal printers, and a signed licensecontrols the subscription.

Admin lock (shop owner login)
Product management (add / edit / delete) and the Settings page are protected bythe shop owner's Shop ID + password. Employees can still run the till —new sales, receipts and product lookup stay open.

Set these two environment variables on your hosting (Vercel → Project →Settings → Environment Variables), then redeploy:

SHOP_ID=your-shop-id
SHOP_PASSWORD=your-secret-password

text

- The credentials are verified **server-side** (`/api/shop/login`) and are never
  shipped inside the browser bundle.
- After a successful login the owner stays unlocked **until the browser is
  closed** or they press the floating **"Log out Admin"** button.
- If the variables are not set, the lock is disabled and the app shows a
  reminder banner.

## Font size

Settings → **Font Size** makes text across the whole app larger or smaller
(80–140%). It is stored locally on the device.

## Product form rules

- Required: Name, Category, Brand, Gender (defaults to Men), Color, Cost, Price
- Optional: Name (Urdu), Season, Sizes, Opening Stock, Reorder level
- Category is a dropdown of your existing categories with an
  "Add new category…" option.
- Sizes are tap-to-select chips (S / M / L / XL / XXL / Unstitched + custom).
  If none are selected, variants are saved with size **"No Size"**.
- Cost = what you paid the supplier (used for profit reports).
  Price = what the customer pays.
- "Reorder at" is the low-stock warning threshold: when stock falls to this
  number the item is flagged red on the dashboard and POS.
- Opening Stock applies to every size/color variant when the product (or new
  variants) are created; stock can be edited per variant later from Edit.

## Environment variables

See `.env.example` for the full list (license keys, owner console, Upstash
Redis, shop admin lock).

## Getting Started

```bash
npm install
npm run dev
```
