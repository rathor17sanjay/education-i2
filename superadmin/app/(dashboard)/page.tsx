"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type AdminUser = { id: string; email: string; role: string; tenant_id: string | null };

export default function DashboardHomePage() {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch("/admin/me")
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        setAdmin(await res.json());
      })
      .catch(() => setError("Could not load admin session."));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold">Dashboard</h1>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-base">Signed in as</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!admin && !error && <Skeleton className="h-10 w-full" />}
          {admin && (
            <div className="flex items-center justify-between">
              <p className="text-sm">{admin.email}</p>
              <Badge variant="secondary">{admin.role}</Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
