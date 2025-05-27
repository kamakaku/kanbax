import React, { useEffect } from 'react';
import SubscriptionInfo from '@/components/subscription/subscription-info';
import { useToast } from '@/hooks/use-toast';

export default function SubscriptionPage() {
  const { toast } = useToast();

  // WICHTIG: Sofort bei Laden dieser Seite prüfen, ob wir direkt ein Abonnement-Update vornehmen sollen
  useEffect(() => {
    // Wenn wir von der Erfolgseite kommen, prüfen und Upgrade/Downgrade durchführen
    const fromPayment = localStorage.getItem('fromSuccessfulPayment');
    if (fromPayment === 'true') {
      // Sofort anzeigen, dass wir den automatischen Update-Prozess starten
      toast({
        title: "Abonnement-Update wird gestartet",
        description: "Ihr Abonnement wird aktualisiert...",
        duration: 5000,
      });
      
      // Ziel-Tier-Informationen auslesen
      const targetTier = localStorage.getItem('targetSubscriptionTier');
      console.log("SUBSCRIPTION PAGE - Direktes Update mit Tier:", targetTier);
      
      // Direkter API-Aufruf zum Update durchführen
      handleDirectUpdate(targetTier || 'freelancer');
    }
  }, []);
  
  // Funktion zum direkten Update des Abonnements
  const handleDirectUpdate = async (targetTier: string) => {
    try {
      // Abrechnungszyklus aus localStorage holen (mit Fallback)
      const billingCycle = localStorage.getItem('targetSubscriptionBillingCycle') || 'monthly';
      
      console.log("DIREKTES UPDATE WIRD GESTARTET - targetTier:", targetTier, "billingCycle:", billingCycle);
      
      // Mappung von Tier-Namen zu Paket-IDs
      const getPackageId = (tier: string): number => {
        switch(tier.toLowerCase()) {
          case 'free': return 1;
          case 'freelancer': return 2;
          case 'organisation': return 3;
          case 'enterprise': return 4;
          case 'kanbax': return 5;
          default: return 2; // Fallback zu Freelancer
        }
      };
      
      // Benutzer-ID aus localStorage holen
      const userId = parseInt(localStorage.getItem('userId') || '0');
      
      if (!userId) {
        console.error("Keine Benutzer-ID gefunden!");
        toast({
          title: "Fehler",
          description: "Benutzer-ID konnte nicht gefunden werden",
          variant: "destructive",
        });
        return;
      }
      
      // 1. METHODE: Garantierter Update über internen API-Endpunkt
      console.log("GARANTIERTER UPDATE: Versuche Aktualisierung über internen API-Endpunkt");
      try {
        const guaranteedResponse = await fetch('/api/subscription/guaranteed-update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tier: targetTier.toLowerCase(),
            billingCycle: billingCycle
          }),
        });
        
        const guaranteedResult = await guaranteedResponse.json();
        
        if (guaranteedResponse.ok && guaranteedResult.success) {
          console.log("✅ GARANTIERTER UPDATE ERFOLGREICH:", guaranteedResult);
          
          // Cache invalidieren
          if (typeof window !== 'undefined' && window.queryClient) {
            window.queryClient.invalidateQueries({ queryKey: ['/api/auth/current-user'] });
            window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
            window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/usage'] });
          }
          
          // Erfolgsmeldung
          toast({
            title: "Abonnement aktualisiert",
            description: `Ihr Abonnement wurde erfolgreich auf ${targetTier} (${billingCycle === 'yearly' ? 'jährlich' : 'monatlich'}) aktualisiert.`,
            duration: 5000,
          });
          
          // Cleanup
          localStorage.removeItem('targetSubscriptionTier');
          localStorage.removeItem('targetSubscriptionBillingCycle');
          localStorage.removeItem('fromSuccessfulPayment');
          
          // Erfolgreich beendet
          return;
        } else {
          console.warn("⚠️ GARANTIERTER UPDATE FEHLGESCHLAGEN, versuche regulären Update:", guaranteedResult);
        }
      } catch (guaranteedError) {
        console.error("❌ FEHLER BEIM GARANTIERTEN UPDATE:", guaranteedError);
        // Weiter zum direkten Update als Fallback
      }
      
      // 2. METHODE: Direkte Update als Fallback
      console.log(`API-Aufruf an /api/payments/direct-update mit: userId=${userId}, packageId=${getPackageId(targetTier)}, tier=${targetTier}, billingCycle=${billingCycle}`);
      
      const response = await fetch('/api/payments/direct-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          packageId: getPackageId(targetTier),
          billingCycle: billingCycle,
          sessionId: 'direct_update_' + Date.now(),
          forceDowngrade: true,
        }),
      });
      
      // Response verarbeiten und prüfen
      const result = await response.json();
      
      if (response.ok) {
        console.log("✅ DIREKTES UPDATE ERFOLGREICH:", result);
        
        // Cache invalidieren
        if (typeof window !== 'undefined' && window.queryClient) {
          window.queryClient.invalidateQueries({ queryKey: ['/api/auth/current-user'] });
          window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
          window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/usage'] });
        }
        
        // Erfolgsmeldung
        toast({
          title: "Abonnement aktualisiert",
          description: `Ihr Abonnement wurde erfolgreich auf ${targetTier} (${billingCycle === 'yearly' ? 'jährlich' : 'monatlich'}) aktualisiert.`,
          duration: 5000,
        });
        
        // Cleanup
        localStorage.removeItem('targetSubscriptionTier');
        localStorage.removeItem('targetSubscriptionBillingCycle');
        localStorage.removeItem('fromSuccessfulPayment');
      } else {
        console.error("❌ DIREKTES UPDATE FEHLGESCHLAGEN:", result);
        
        toast({
          title: "Fehler",
          description: result.message || "Abonnement konnte nicht aktualisiert werden",
          variant: "destructive",
          duration: 5000,
        });
      }
    } catch (error) {
      console.error("❌ FEHLER BEIM DIREKTEN UPDATE:", error);
      
      toast({
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Abonnement</h1>
        <p className="text-muted-foreground">
          Verwalten Sie Ihr Abonnement und sehen Sie Nutzungslimits ein.
        </p>
      </div>

      <SubscriptionInfo />

      {/* Debug-Button zum manuellen Auslösen des Downgrades, nur wenn localStorage-Value existiert */}
      {localStorage.getItem('targetSubscriptionTier') && (
        <div className="p-4 border rounded-md bg-yellow-50">
          <h2 className="font-bold mb-2">Debug: Abonnement-Update</h2>
          <p className="text-sm mb-2">
            Es wurde ein Abonnement-Update auf "{localStorage.getItem('targetSubscriptionTier')}" 
            ({localStorage.getItem('targetSubscriptionBillingCycle') || 'monthly'}) gefunden, 
            das noch nicht angewendet wurde.
          </p>
          <button 
            onClick={() => handleDirectUpdate(localStorage.getItem('targetSubscriptionTier') || 'freelancer')}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm"
          >
            Update manuell durchführen
          </button>
        </div>
      )}
    </div>
  );
}