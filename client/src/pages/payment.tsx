import React, { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-store";
import { createCheckoutSession } from "@/lib/payment-helpers";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";

export default function PaymentPage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/payment/:subscriptionId");
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  // Abrechnungszyklus-State
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(
    localStorage.getItem('billingCycle') as 'monthly' | 'yearly' || 'monthly'
  );

  // Lade Informationen zur gewählten Subscription
  useEffect(() => {
    if (!params?.subscriptionId) {
      setError("Keine Subscription-ID gefunden");
      return;
    }

    const fetchSubscriptionInfo = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/subscriptions/${params.subscriptionId}`);
        
        if (!response.ok) {
          throw new Error("Fehler beim Laden der Subscription-Informationen");
        }
        
        const data = await response.json();
        setSubscriptionInfo(data);
      } catch (err) {
        setError((err as Error).message || "Ein unbekannter Fehler ist aufgetreten");
        toast({
          title: "Fehler",
          description: (err as Error).message || "Subscription-Informationen konnten nicht geladen werden",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptionInfo();
  }, [params?.subscriptionId, toast]);

  const handleInitiatePayment = async () => {
    if (!subscriptionInfo || !user?.id) return;
    
    try {
      setLoading(true);
      
      // Verwende den billingCycle-State, der oben initialisiert wurde
      console.log("Verwendeter Abrechnungszyklus auf Payment-Seite:", billingCycle);
      
      // Verwende den Helper zum Erstellen einer Checkout-Session
      const checkoutResult = await createCheckoutSession(
        subscriptionInfo.id,
        subscriptionInfo.packageId,
        user.id,
        billingCycle // Abrechnungszyklus übergeben
      );
      
      if (checkoutResult?.checkoutUrl) {
        // Weiterleitung zur Stripe-Checkout-Seite
        window.location.href = checkoutResult.checkoutUrl;
      } else {
        throw new Error("Keine Checkout-URL erhalten");
      }
    } catch (err) {
      setError((err as Error).message || "Ein unbekannter Fehler ist aufgetreten");
      toast({
        title: "Fehler",
        description: (err as Error).message || "Zahlung konnte nicht initiiert werden",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    setLocation("/dashboard");
  };

  if (loading && !subscriptionInfo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
        <p>Lade Zahlungsinformationen...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Fehler</CardTitle>
            <CardDescription>Bei der Verarbeitung Ihrer Zahlung ist ein Fehler aufgetreten.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{error}</p>
          </CardContent>
          <CardFooter>
            <Button onClick={handleGoBack}>Zurück zum Dashboard</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Zahlung für Ihr Abonnement</CardTitle>
          <CardDescription>
            Bitte schließen Sie den Zahlungsvorgang ab, um Ihr Abonnement zu aktivieren.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {subscriptionInfo && (
            <>
              <div className="border-b pb-4">
                <h3 className="text-lg font-medium">Übersicht</h3>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="text-sm text-muted-foreground">Paket:</div>
                  <div className="text-sm font-medium">{subscriptionInfo.packageName}</div>
                  
                  <div className="text-sm text-muted-foreground">Abrechnungszyklus:</div>
                  <div>
                    <ToggleGroup 
                      type="single" 
                      value={billingCycle} 
                      onValueChange={(value) => {
                        if (value) {
                          setBillingCycle(value as 'monthly' | 'yearly');
                          localStorage.setItem('billingCycle', value);
                        }
                      }}
                      className="flex justify-start"
                    >
                      <ToggleGroupItem value="monthly" size="sm">Monatlich</ToggleGroupItem>
                      <ToggleGroupItem value="yearly" size="sm">Jährlich</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  
                  <div className="text-sm text-muted-foreground">Preis:</div>
                  <div className="text-sm font-medium">
                    {subscriptionInfo.price}€ {billingCycle === 'monthly' ? '/ Monat' : '/ Jahr'}
                    {billingCycle === 'yearly' && (
                      <span className="ml-1 text-xs text-green-600 font-normal">(Günstiger)</span>
                    )}
                  </div>
                  
                  <div className="text-sm text-muted-foreground">Enthaltene Features:</div>
                  <div className="text-sm font-medium">
                    {subscriptionInfo.features?.join(", ") || "Keine Features angegeben"}
                  </div>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Die Zahlung wird über Stripe abgewickelt, einem sicheren Zahlungsdienstleister. 
                  Ihre Kreditkartendaten werden nicht auf unseren Servern gespeichert.
                </p>
                <p className="text-sm text-muted-foreground">
                  Durch Klicken auf "Jetzt bezahlen" werden Sie zu Stripe weitergeleitet, 
                  wo Sie die Zahlung sicher abschließen können.
                </p>
              </div>
            </>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleGoBack}>Abbrechen</Button>
          <Button onClick={handleInitiatePayment} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verarbeite...
              </>
            ) : (
              "Jetzt bezahlen"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}