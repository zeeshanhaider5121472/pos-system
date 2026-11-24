// src/app/admin/login/page.tsx
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLogin() {
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const router = useRouter();
  async function go() {
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: p }),
    });
    if (r.ok) router.push("/admin");
    else setErr("Wrong password");
  }
  return (
    <div className="grid min-h-screen place-items-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-3 p-6">
          <h1 className="text-lg font-semibold">Owner Console</h1>
          <Input
            type="password"
            value={p}
            onChange={(e) => setP(e.target.value)}
            placeholder="Password"
            onKeyDown={(e) => e.key === "Enter" && go()}
          />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <Button className="w-full" onClick={go}>
            Sign in
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
