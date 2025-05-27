import React from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function PaymentCancelPage() {
  const [, setLocation] = useLocation();

  const handleGoToDashboard = () => {
    setLocation("/dashboard");
  };

  const handleTryAgain = () => {
    setLocation("/subscription-plans");
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-lg">
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertCircle className="h-16 w-16 text-amber-500" />
          </div>
          <CardTitle>Zahlung abgebrochen</CardTitle>
          <CardDescription>
            Ihre Zahlung wurde abgebrochen oder nicht abgeschlossen.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Es wurden keine Gebühren erhoben und Ihr Abonnement wurde nicht aktiviert.
              Sie können es jederzeit erneut versuchen oder ein anderes Abonnement-Paket wählen.
            </p>
            <p className="text-sm text-muted-foreground">
              Falls Sie auf technische Probleme gestoßen sind, kontaktieren Sie bitte unseren Support.
            </p>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleGoToDashboard}>
            Zum Dashboard
          </Button>
          <Button onClick={handleTryAgain}>
            Erneut versuchen
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}