"use client";
// Subscription edit gate — same rule as New Sale (canSell): while the
// subscription is active (or in the 7-day warning window) editing is allowed.
// Once the expiry date has passed the whole app becomes read-only:
// no new/edit/deleted products, no new customers, no settings changes.
import { useEffect, useState } from "react";
import { canSell, evaluateLicense } from "./license";

export function useEditable() {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    let live = true;
    evaluateLicense().then((r) => live && setOk(canSell(r.state)));
    return () => {
      live = false;
    };
  }, []);
  return ok;
}
