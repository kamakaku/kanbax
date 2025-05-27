import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

/**
 * Diese Komponente prüft beim Laden des Dashboards, ob ein automatisches
 * Abonnement-Update angewendet werden soll. Sie greift direkt auf die 
 * gespeicherten localStorage-Werte zu und führt das Update durch.
 */
export default function SubscriptionUpdateAlert() {
  const { toast } = useToast();
  const [isVisible, setIsVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tier, setTier] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<string | null>(null);

  // Beim Mounten prüfen, ob ein Abonnement-Update vorhanden ist
  useEffect(() => {
    const targetTier = localStorage.getItem('targetSubscriptionTier');
    const targetCycle = localStorage.getItem('targetSubscriptionBillingCycle') || 'monthly';
    
    console.log("Dashboard Alert: Prüfe auf ausstehende Updates:", targetTier, targetCycle);
    
    if (targetTier) {
      setTier(targetTier);
      setBillingCycle(targetCycle);
      setIsVisible(true);
    }
  }, []);
  
  // Funktion zum Formatieren des Paketnamens
  const formatPackageName = (name: string | null): string => {
    if (!name) return '';
    
    switch (name.toLowerCase()) {
      case 'free': return 'Free';
      case 'freelancer': return 'Freelancer';
      case 'organisation': return 'Organisation';
      case 'enterprise': return 'Enterprise';
      case 'kanbax': return 'Kanbax';
      default: return name;
    }
  };
  
  // Funktion zum Ausführen des Abonnement-Updates
  const performUpdate = async () => {
    if (!tier) return;
    
    setIsUpdating(true);
    setProgress(10);
    
    try {
      console.log("Dashboard Alert: Starte garantiertes Update:", tier, billingCycle);
      
      // Direkter API-Aufruf an den garantierten Update-Endpunkt
      setProgress(30);
      const response = await fetch('/api/subscription/guaranteed-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier: tier.toLowerCase(),
          billingCycle: billingCycle || 'monthly' // Explizit Default-Wert setzen, falls null oder undefined
        }),
      });
      
      setProgress(60);
      const result = await response.json();
      
      if (response.ok && result.success) {
        console.log("✅ GARANTIERTES UPDATE ERFOLGREICH:", result);
        setProgress(90);
        
        // Cache invalidieren
        if (typeof window !== 'undefined' && window.queryClient) {
          window.queryClient.invalidateQueries({ queryKey: ['/api/auth/current-user'] });
          window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
          window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/usage'] });
        }
        
        // Cleanup localStorage
        localStorage.removeItem('targetSubscriptionTier');
        localStorage.removeItem('targetSubscriptionBillingCycle');
        localStorage.removeItem('fromSuccessfulPayment');
        setProgress(100);
        
        // Erfolgsmeldung anzeigen
        toast({
          title: "Abonnement aktualisiert",
          description: `Ihr Abonnement wurde erfolgreich auf ${formatPackageName(tier)} (${billingCycle === 'yearly' ? 'jährlich' : 'monatlich'}) aktualisiert.`,
          duration: 5000,
        });
        
        // Component ausblenden
        setTimeout(() => {
          setIsVisible(false);
        }, 1000);
      } else {
        throw new Error(result.message || 'Fehler beim Aktualisieren des Abonnements');
      }
    } catch (error) {
      console.error("❌ FEHLER BEIM DASHBOARD-UPDATE:", error);
      setProgress(100);
      
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Nichts rendern, wenn kein Update notwendig ist
  if (!isVisible) {
    return null;
  }

  return (
    <Card className="mb-4 bg-amber-50 border-amber-200">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <AlertCircle className="h-6 w-6 text-amber-600 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-medium text-amber-900 mb-1">
              Nicht aktiviertes Abonnement-Update gefunden
            </h3>
            <p className="text-sm text-amber-700 mb-3">
              Es wurde ein ausstehender Wechsel zu <strong>{formatPackageName(tier)}</strong> ({billingCycle === 'yearly' ? 'jährlich' : 'monatlich'}) gefunden. Klicken Sie auf den Button, um Ihr Abonnement jetzt zu aktualisieren.
            </p>
            
            {isUpdating ? (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-amber-600">Abonnement wird aktualisiert...</p>
              </div>
            ) : (
              <Button 
                onClick={performUpdate}
                className="bg-amber-600 hover:bg-amber-700 text-white"
                disabled={isUpdating}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Abonnement jetzt aktualisieren
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}