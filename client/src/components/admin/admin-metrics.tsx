import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Users, Building2, BarChart3, Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function AdminMetrics() {
  // Plattform-Metriken abrufen
  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['/api/admin/metrics'],
    retry: false,
  });

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fehler beim Laden der Metriken</CardTitle>
          <CardDescription>
            {error instanceof Error ? error.message : "Unbekannter Fehler"}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Benutzer gesamt</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics?.totalUsers || "0"}</div>
          <p className="text-xs text-muted-foreground">
            Davon {metrics?.activeUsers || "0"} aktiv
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Unternehmen</CardTitle>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics?.totalCompanies || "0"}</div>
          <p className="text-xs text-muted-foreground">
            Durchschn. {metrics?.avgUsersPerCompany || "0"} Benutzer/Unternehmen
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ressourcen</CardTitle>
          <Database className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics?.totalResources || "0"}</div>
          <p className="text-xs text-muted-foreground">
            {metrics?.projectsCount || "0"} Projekte / {metrics?.boardsCount || "0"} Boards
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Abonnements</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <div>Free: <span className="font-bold">{metrics?.subscriptionStats?.free || "0"}</span></div>
            <div>Basic: <span className="font-bold">{metrics?.subscriptionStats?.basic || "0"}</span></div>
            <div>Premium: <span className="font-bold">{metrics?.subscriptionStats?.premium || "0"}</span></div>
            <div>Enterprise: <span className="font-bold">{metrics?.subscriptionStats?.enterprise || "0"}</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}