import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import AdminCompanies from "@/components/admin/admin-companies";
import AdminUsers from "@/components/admin/admin-users";
import AdminMetrics from "@/components/admin/admin-metrics";
import AdminSubscriptionPackages from "@/components/admin/admin-subscription";
import { useAuth } from "@/lib/auth-store";
import { useLocation } from "wouter";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Überprüfung, ob der Benutzer ein Hyper-Admin ist
  const isHyperAdmin = user?.isHyperAdmin === true;

  // Wenn kein Hyper-Admin, Zugriff verweigern und zur Dashboard-Seite weiterleiten
  if (!isHyperAdmin) {
    toast({
      title: "Zugriff verweigert",
      description: "Sie haben keine Berechtigung, auf diese Seite zuzugreifen.",
      variant: "destructive",
    });
    setLocation("/dashboard");
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">SaaS-Administration</h1>
        <p className="text-muted-foreground">
          Verwalten Sie Unternehmen, Benutzer und Plattformeinstellungen.
        </p>
      </div>

      <Tabs defaultValue="companies" className="space-y-4">
        <TabsList>
          <TabsTrigger value="companies">Unternehmen</TabsTrigger>
          <TabsTrigger value="users">Benutzer</TabsTrigger>
          <TabsTrigger value="subscriptions">Abonnements</TabsTrigger>
          <TabsTrigger value="metrics">Plattform-Metriken</TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="space-y-4">
          <AdminCompanies />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <AdminUsers />
        </TabsContent>
        
        <TabsContent value="subscriptions" className="space-y-4">
          <AdminSubscriptionPackages />
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <AdminMetrics />
        </TabsContent>
      </Tabs>
    </div>
  );
}