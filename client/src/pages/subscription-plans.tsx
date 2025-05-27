import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Check, X } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createDirectStripeCheckout } from "@/lib/stripe";

// Typ-Definition für den Benutzer
interface User {
  id: number;
  username: string;
  email: string;
  subscriptionTier: string;
  subscriptionBillingCycle?: string;
  isCompanyAdmin?: boolean;
  companyId?: number | null;
}

interface SubscriptionPackage {
  id: number;
  name: string;
  displayName: string;
  price: number;
  maxProjects: number | null;
  maxBoards: number | null;
  maxTeams: number | null;
  maxUsers: number | null;
  maxTasks: number | null;
  maxOkrs: number | null;
  features: string[];
  createdAt: string;
  updatedAt: string;
}

export default function SubscriptionPlans() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // Status für Abonnement-Änderung oder Upgrade
  // Für Testzwecke setzen wir diese direkt auf true, um die Stripe-Integration zu testen
  const [isChangingSubscription] = useState<boolean>(true);
  const [isUpgradingFromFree] = useState<boolean>(true);
  
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(
    localStorage.getItem('billingCycle') as 'monthly' | 'yearly' || 'monthly'
  );
  
  // Status für die Aktualisierung des Abonnements
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Aktuelle Benutzer-Informationen aus dem API abrufen
  const { data: user } = useQuery<User>({
    queryKey: ['/api/auth/current-user'],
    refetchOnWindowFocus: false
  });

  const { data: packages = [], isLoading } = useQuery<SubscriptionPackage[]>({
    queryKey: ["/api/public/subscription-packages"],
    refetchOnWindowFocus: false,
  });

  const handleSelectPackage = async (packageId: number) => {
    try {
      setIsUpdating(true);
      localStorage.setItem('selectedPackageId', packageId.toString());
      localStorage.setItem('billingCycle', billingCycle);

      // Get package name and determine if it's a company package
      const selectedPackage = packages.find(pkg => pkg.id === packageId);
      const packageName = selectedPackage?.name.toLowerCase() || '';
      const isCompanyPackage = ['organisation', 'enterprise'].includes(packageName);

      // Explizit Tier-Information und billing cycle setzen für das manuelle Update
      localStorage.setItem('targetSubscriptionTier', packageName);
      localStorage.setItem('targetSubscriptionBillingCycle', billingCycle);
      console.log(`Paket ausgewählt: ID=${packageId}, Name=${packageName}, BillingCycle=${billingCycle}`);
      console.log(`In localStorage gesetzt: targetSubscriptionTier=${packageName}, targetSubscriptionBillingCycle=${billingCycle}`);

      // Store package type
      localStorage.setItem('packageType', isCompanyPackage ? 'company' : 'individual');

      // Prüfen, ob es sich um eine Änderung eines bestehenden Abonnements oder ein Upgrade von Free handelt
      if (isChangingSubscription || isUpgradingFromFree) {
        try {
          console.log(`Abonnement wird aktualisiert auf ${selectedPackage?.name} mit Abrechnungszyklus ${billingCycle}`);
          
          // Für kostenpflichtige Pakete: Direkt zu Stripe weiterleiten
          if (selectedPackage?.price !== 0) {
            console.log('Starte Checkout-Prozess für:', selectedPackage?.name);
            console.log('Abrechnungszyklus:', billingCycle);
            console.log('Paketpreis (in Cent):', selectedPackage?.price);
            
            // Berechne und zeige den korrekten Preis basierend auf dem Abrechnungszyklus
            const effectivePrice = billingCycle === 'yearly' 
              ? Math.round(selectedPackage!.price * 12 * 0.9) 
              : selectedPackage!.price;
            
            console.log('Effektiver Preis (in Cent):', effectivePrice);
            
            try {
              // Annahme: Wir haben eine userId im localStorage oder in einer Session
              const userId = localStorage.getItem('userId') || '9'; // Fallback auf 9 wenn nicht vorhanden
              
              // Direkt zu Stripe weiterleiten
              await createDirectStripeCheckout(
                selectedPackage?.name || 'freelancer', // Fallback-Wert, falls selectedPackage undefined
                billingCycle,
                parseInt(userId)
              );
              
              // Hinweis: Die Weiterleitung erfolgt automatisch in der createDirectStripeCheckout-Funktion
              // Daher werden die folgenden Zeilen nur ausgeführt, wenn die Weiterleitung fehlschlägt
              
              toast({
                title: "Weiterleitung zu Stripe",
                description: "Sie werden zur Zahlungsabwicklung weitergeleitet...",
                duration: 5000,
              });
              
              return;
            } catch (error) {
              console.error('Fehler bei der Weiterleitung zu Stripe:', error);
              toast({
                title: "Fehler bei der Zahlungsabwicklung",
                description: "Es gab ein Problem bei der Weiterleitung zum Zahlungsanbieter. Bitte versuchen Sie es später erneut.",
                variant: "destructive",
                duration: 5000
              });
              
              // Zurücksetzen des Ladestatus
              setIsUpdating(false);
              return;
            }
          }
          
          // Direkte serverseitige Aktualisierung, unabhängig vom Pakettyp
          // Wir führen diesen Schritt für alle Pakete durch, um sicherzustellen, dass das Abonnement korrekt aktualisiert wird
          const userId = localStorage.getItem('userId');
          const packageId = selectedPackage?.id || 1;
          
          console.log(`👉 DIREKTE AKTUALISIERUNG AUS SUBSCRIPTION PLANS: User=${userId}, Paket=${packageId}, Tier=${selectedPackage?.name}, Zyklus=${billingCycle}`);
          
          try {
            // Direkten Update-Endpunkt aufrufen
            const directUpdateResponse = await fetch('/api/payments/direct-update', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                userId: parseInt(userId || '0'),
                packageId,
                billingCycle,
                sessionId: 'subscription_plans_update_' + Date.now()
              })
            });
            
            if (directUpdateResponse.ok) {
              console.log("✅ AUTOMATISCHE AKTUALISIERUNG aus Subscription-Plans erfolgreich");
            } else {
              console.warn("⚠️ Automatisches Update fehlgeschlagen, fahre mit Standard-Update fort");
            }
          } catch (directUpdateError) {
            console.error("❌ Fehler bei direkter Aktualisierung:", directUpdateError);
          }
          
          // Fallback: API-Anfrage senden, um das Abonnement zu aktualisieren (API ändert sich nicht)
          const response = await fetch('/api/subscription/update-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tier: selectedPackage?.name || 'free',
              billingCycle: billingCycle
            }),
          });

          if (!response.ok) {
            throw new Error(`API-Fehler: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          
          console.log('Antwort vom Server:', data);
          
          if (data.success) {
            console.log("Erfolgreiche Aktualisierung vom Server-API-Endpunkt", data);
            
            // Sofort lokale Benutzerinformation aktualisieren
            try {
              // Importiere und verwende die reloadUserData-Funktion
              const { reloadUserData } = await import('@/lib/auth-store');
              console.log("Aktualisiere lokale Benutzerdaten nach Aktualisierung des Abonnements...");
              const userData = await reloadUserData();
              console.log("Aktualisierte Benutzerdaten:", userData);
              
              // Explizit localStorage aktualisieren
              const userTier = selectedPackage?.name?.toLowerCase() || 'free';
              localStorage.setItem('userSubscriptionTier', userTier);
              localStorage.setItem('userSubscriptionBillingCycle', billingCycle);
              console.log(`Expliziter localStorage Update: tier=${userTier}, cycle=${billingCycle}`);
              
              // Cache invalidieren
              if (window.queryClient) {
                window.queryClient.invalidateQueries({ queryKey: ['/api/auth/current-user'] });
                window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
                window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/usage'] });
                console.log("React Query Cache invalidiert");
              }
            } catch (localUpdateError) {
              console.error("Fehler beim lokalen Update:", localUpdateError);
              // Kritisch, aber wir brechen nicht ab
            }
            
            // Kein Stripe-Checkout nötig, Abonnement wurde direkt aktualisiert
            toast({
              title: "Ihr Abonnement wurde aktualisiert",
              description: `Ihr Abonnement wurde erfolgreich auf "${selectedPackage?.displayName || 'Free'}" aktualisiert.`,
              duration: 5000,
            });
            
            // Zum Dashboard zurückleiten
            navigate('/dashboard', { replace: true });
          } else {
            // Fehler - Sollte eigentlich nicht auftreten, da Fehler bereits abgefangen wurden
            toast({
              title: "Fehler",
              description: "Beim Aktualisieren Ihres Abonnements ist ein unerwarteter Fehler aufgetreten.",
              variant: "destructive"
            });
          }
        } catch (error) {
          // Bei Netzwerkfehler oder anderen Problemen: Detaillierte Fehlerinformationen
          console.error('Fehler bei der Aktualisierung des Abonnements:', error);
          
          // Benutzerfreundliche Fehlermeldung anzeigen
          let errorMessage = "Es ist ein Fehler bei der Aktualisierung Ihres Abonnements aufgetreten.";
          
          if (error instanceof Error) {
            errorMessage += ` Details: ${error.message}`;
          }
          
          toast({
            title: "Fehler beim Aktualisieren des Abonnements",
            description: errorMessage,
            variant: "destructive",
            duration: 10000 // 10 Sekunden anzeigen
          });
        } finally {
          // In jedem Fall: Flags zurücksetzen
          localStorage.removeItem('changeSubscription');
          localStorage.removeItem('upgradeFromFree');
          setIsUpdating(false);
        }
      } else {
        // Bei Neuregistrierung zur Registrierungsseite weiterleiten
        setIsUpdating(false);
        navigate('/auth?mode=register', { replace: true, state: { isRegister: true } });
      }
    } catch (error) {
      console.error('Unerwarteter Fehler bei der Paketauswahl:', error);
      setIsUpdating(false);
      toast({
        title: "Fehler",
        description: "Es ist ein unerwarteter Fehler aufgetreten. Bitte versuchen Sie es später erneut.",
        variant: "destructive",
        duration: 5000
      });
    }
  };

  // Funktion zur Berechnung des Jahrespreises mit 10% Rabatt
  const calculateYearlyPrice = (monthlyPrice: number): number => {
    const yearlyPrice = (monthlyPrice * 12) * 0.9; // 10% Rabatt
    console.log(`Berechnung des Jahrespreises: ${monthlyPrice} × 12 × 0.9 = ${yearlyPrice}`);
    return Math.round(yearlyPrice); // Auf ganze Zahlen runden
  };

  // Funktion um Limits anzuzeigen: "Unbegrenzt" für null-Werte oder 9999, X-Icon für nicht verfügbare Features
  const formatLimit = (limit: number | null | undefined): React.ReactNode => {
    if (limit === null || limit === undefined || limit === 9999) return "Unbegrenzt";
    return limit === 0 ? <X className="h-5 w-5 text-red-500 inline-block" /> : limit.toString();
  };

  // Paketspezifische CSS Klassen und Features
  const getPackageStyle = (packageName: string) => {
    switch (packageName.toLowerCase()) {
      case 'free':
        return 'border-gray-200';
      case 'freelancer':
        return 'border-blue-200';
      case 'organisation':
        return 'border-green-200';
      case 'enterprise':
        return 'border-purple-200';
      case 'kanbax':
        return 'border-yellow-200';
      default:
        return 'border-gray-200';
    }
  };

  // Paketspezifische Features
  const getPackageFeatures = (pkg: SubscriptionPackage) => {
    const features = [];

    // Basis-Features, die sich aus den Limits ableiten
    features.push({ text: `${formatLimit(pkg.maxProjects)} Projekte`, available: true });
    features.push({ text: `${formatLimit(pkg.maxBoards)} Boards`, available: true });
    features.push({ text: pkg.name.toLowerCase() === 'free' || pkg.name.toLowerCase() === 'freelancer' ? "Teams" : `${formatLimit(pkg.maxTeams)} Teams`, 
                   available: pkg.name.toLowerCase() !== 'free' && pkg.name.toLowerCase() !== 'freelancer' });
    features.push({ text: (() => {
      switch(pkg.name.toLowerCase()) {
        case 'free':
        case 'freelancer':
          return '1 Benutzer';
        case 'organisation':
          return '10 Benutzer (weitere für 9€/Monat)';
        case 'enterprise':
          return '30 Benutzer (weitere für 9€/Monat)';
        default:
          return `${formatLimit(pkg.maxUsers)} Benutzer`;
      }
    })(), available: true });
    features.push({ text: `${formatLimit(pkg.maxTasks)} Tasks`, available: true });
    features.push({ text: pkg.name.toLowerCase() === 'free' || pkg.name.toLowerCase() === 'freelancer' ? "OKRs" : `${formatLimit(pkg.maxOkrs)} OKRs`, 
                   available: pkg.name.toLowerCase() !== 'free' && pkg.name.toLowerCase() !== 'freelancer' });

    // Alle möglichen Features definieren
    const allFeatures = [
      { text: 'Gantt-Ansicht', freelancer: true, organisation: true, enterprise: true }
    ];

    // Features basierend auf Pakettyp hinzufügen
    allFeatures.forEach(feature => {
      switch (pkg.name.toLowerCase()) {
        case 'freelancer':
          features.push({ text: feature.text, available: feature.freelancer });
          break;
        case 'organisation':
          features.push({ text: feature.text, available: feature.organisation });
          break;
        case 'enterprise':
          features.push({ text: feature.text, available: feature.enterprise });
          break;
        default:
          features.push({ text: feature.text, available: false });
      }
    });

    return features;
  };

  // Bestimmt, ob das Paket für Einzelnutzer oder Unternehmen ist
  const isCompanyPackage = (packageName: string) => {
    return ['organisation', 'enterprise'].includes(packageName.toLowerCase());
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Lade Abonnement-Pakete...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">Wählen Sie Ihr Abonnement-Paket</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Finden Sie das richtige Paket für Ihre Bedürfnisse. Von kostenfreien Optionen für Einzelpersonen 
          bis hin zu umfassenden Lösungen für Teams und Unternehmen.
        </p>

        <div className="flex items-center justify-center mt-6 space-x-2">
          <Label htmlFor="billing-cycle" className={billingCycle === 'monthly' ? 'font-medium' : 'text-muted-foreground'}>
            Monatlich
          </Label>
          <Switch 
            id="billing-cycle" 
            checked={billingCycle === 'yearly'}
            onCheckedChange={(checked) => setBillingCycle(checked ? 'yearly' : 'monthly')}
          />
          <Label htmlFor="billing-cycle" className={billingCycle === 'yearly' ? 'font-medium' : 'text-muted-foreground'}>
            Jährlich <span className="text-xs text-green-600 ml-1">(10% Rabatt)</span>
          </Label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 mb-12">
        {[...packages].sort((a, b) => {
          const order: Record<string, number> = { 'free': 0, 'freelancer': 1, 'organisation': 2, 'enterprise': 3 };
          return (order[a.name.toLowerCase()] || 999) - (order[b.name.toLowerCase()] || 999);
        }).map((pkg: SubscriptionPackage) => (
          <Card 
            key={pkg.id} 
            className={`flex flex-col border-2 ${getPackageStyle(pkg.name)} hover:shadow-lg transition-shadow`}
          >
            <CardHeader className="pb-2">
              <CardTitle>{pkg.displayName}</CardTitle>
              <CardDescription>
                {isCompanyPackage(pkg.name) 
                  ? 'Für Teams und Unternehmen' 
                  : 'Für Einzelpersonen'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <div className="text-3xl font-bold mb-6">
                {pkg.name.toLowerCase() === 'free' ? 
                  '0€' : 
                  (billingCycle === 'monthly' ? 
                    ((pkg.price / 100).toFixed(2).replace('.', ',') + '€') : 
                    // Monatlicher Preis bei jährlicher Zahlung (reduziert)
                    ((Math.round(pkg.price * 12 * 0.9) / 1200).toFixed(2).replace('.', ',') + '€')
                  )
                }
                <span className="text-sm font-normal text-muted-foreground">/{billingCycle === 'monthly' ? 'Monat' : 'Monat (jährlich)'}</span>
                {billingCycle === 'yearly' && pkg.name.toLowerCase() !== 'free' && (
                  <div className="text-sm font-normal text-green-600 mt-1">
                    {/* Jahrespreis direkt berechnen - nicht calculateYearlyPrice verwenden */}
                    {(Math.round(pkg.price * 12 * 0.9) / 100).toFixed(2).replace('.', ',')}€/Jahr
                  </div>
                )}
              </div>
              <ul className="space-y-2">
                {getPackageFeatures(pkg).map((feature, index) => (
                  <li key={index} className="flex items-start">
                    {feature.available ? (
                      <Check className="h-5 w-5 text-green-500 mr-2 shrink-0" />
                    ) : (
                      <X className="h-5 w-5 text-red-500 mr-2 shrink-0" />
                    )}
                    <span className={!feature.available ? 'text-gray-400' : ''}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="flex flex-col space-y-2">
              <Button 
                onClick={() => handleSelectPackage(pkg.id)} 
                className="w-full"
                variant={pkg.name.toLowerCase() === 'free' ? 'outline' : 'default'}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird bearbeitet...
                  </>
                ) : (
                  pkg.name.toLowerCase() === 'free' ? 'Kostenlos starten' : 'Auswählen'
                )}
              </Button>
              
              {/* Spezieller Downgrade-Button für Abonnement-Tiers unterhalb des aktuellen Abonnements */}
              {user?.subscriptionTier && 
               (function() {
                 // Ranking der Tiers - niedrigere Werte = niedrigere Tiers
                 const tierRanking: Record<string, number> = {
                   'free': 0,
                   'freelancer': 1,
                   'organisation': 2,
                   'enterprise': 3,
                   'kanbax': 2
                 };
                 
                 // Aktuelles Tier des Benutzers
                 const userTier = user.subscriptionTier?.toLowerCase() || 'free';
                 const currentTierRank = tierRanking[userTier] || 0;
                 
                 // Ranking des Pakets
                 const packageTierName = pkg.name.toLowerCase();
                 const packageTierRank = tierRanking[packageTierName] || 0;
                 
                 // Zeige den Downgrade-Button nur, wenn das Paket ein niedrigeres Tier ist
                 return packageTierRank < currentTierRank ? (
                   <Button 
                     onClick={async () => {
                       setIsUpdating(true);
                       try {
                         console.log(`💾 DIREKTES DOWNGRADE von ${user.subscriptionTier} auf ${pkg.name}`);
                         
                         // Direkter API-Aufruf zum Downgraden ohne Stripe-Prozess
                         // Wir versuchen zuerst einen direkten Update über den payments API-Endpunkt
                         try {
                           console.log("DIREKTER UPDATE-VERSUCH über payments/direct-update");
                           
                           // Paket-ID basierend auf dem Tier-Namen bestimmen
                           const getPackageId = (tier: string): number => {
                             switch(tier.toLowerCase()) {
                               case 'free': return 1;
                               case 'freelancer': return 2;
                               case 'organisation': return 3;
                               case 'enterprise': return 4;
                               case 'kanbax': return 5;
                               default: return 1;
                             }
                           };
                           
                           // Direkter API-Aufruf an den payments/direct-update Endpunkt
                           const directResponse = await fetch('/api/payments/direct-update', {
                             method: 'POST',
                             headers: {
                               'Content-Type': 'application/json',
                             },
                             body: JSON.stringify({
                               userId: currentUser?.id,
                               packageId: getPackageId(pkg.name.toLowerCase()),
                               billingCycle: billingCycle,
                               sessionId: `direct_downgrade_${Date.now()}`,
                               forceDowngrade: true
                             }),
                           });
                           
                           if (directResponse.ok) {
                             const directResult = await directResponse.json();
                             console.log("✅ DIREKTER UPDATE ERFOLGREICH:", directResult);
                             return directResult; // Erfolgreicher direkter Update
                           } else {
                             console.warn("⚠️ Direkter Update fehlgeschlagen, versuche Fallback...");
                           }
                         } catch (directError) {
                           console.error("❌ Fehler beim direkten Update:", directError);
                         }
                         
                         // Fallback: Standard-API-Endpunkt für Updates verwenden
                         console.log("FALLBACK: Verwende Standard-Endpunkt update-user");
                         const response = await fetch('/api/subscription/update-user', {
                           method: 'POST',
                           headers: {
                             'Content-Type': 'application/json',
                           },
                           body: JSON.stringify({
                             tier: pkg.name.toLowerCase(),
                             billingCycle: billingCycle,
                             forceDowngrade: true // Wichtig: Erlaubt das Downgrade auch bei aktivem Abonnement
                           }),
                         });
                         
                         if (!response.ok) {
                           throw new Error(`Fehler beim Downgrade: ${response.status} ${response.statusText}`);
                         }
                         
                         const result = await response.json();
                         console.log("Direktes Downgrade-Ergebnis:", result);
                         
                         // Benutzer-Profil sofort aktualisieren
                         try {
                           const { reloadUserData } = await import('@/lib/auth-store');
                           const userData = await reloadUserData();
                           console.log("Benutzer nach Downgrade:", userData);
                           
                           // Cache explizit invalidieren
                           if (window.queryClient) {
                             window.queryClient.invalidateQueries({ queryKey: ['/api/auth/current-user'] });
                             window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
                             window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/usage'] });
                           }
                         } catch (reloadError) {
                           console.error("Fehler beim Aktualisieren des Benutzer-Profils:", reloadError);
                         }
                         
                         // Explizit localStorage aktualisieren
                         localStorage.setItem('userSubscriptionTier', pkg.name.toLowerCase());
                         localStorage.setItem('userSubscriptionBillingCycle', billingCycle);
                         
                         // Erfolgsmeldung und Navigation zum Dashboard
                         toast({
                           title: "Downgrade erfolgreich",
                           description: `Ihr Abonnement wurde auf "${pkg.displayName}" heruntergestuft.`,
                           duration: 5000,
                         });
                         
                         // Zum Dashboard navigieren
                         navigate('/dashboard', { replace: true });
                       } catch (error) {
                         console.error("Fehler beim Downgrade:", error);
                         
                         toast({
                           title: "Fehler beim Downgrade",
                           description: error instanceof Error ? error.message : "Unbekannter Fehler beim Downgrade",
                           variant: "destructive",
                           duration: 8000,
                         });
                       } finally {
                         setIsUpdating(false);
                       }
                     }}
                     className="w-full mt-2"
                     variant="outline"
                     disabled={isUpdating}
                   >
                     {isUpdating ? (
                       <>
                         <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                         Downgrade wird durchgeführt...
                       </>
                     ) : (
                       <>Direkt zu {pkg.displayName} downgraden</>
                     )}
                   </Button>
                 ) : null;
               })()
              }
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="text-center text-sm text-muted-foreground mt-8">
        <p>Alle Abonnements werden {billingCycle === 'monthly' ? 'monatlich' : 'jährlich'} abgerechnet. Die Preise verstehen sich zzgl. MwSt.</p>
        <p className="mt-2">Bei jährlicher Zahlung sparen Sie 10% gegenüber der monatlichen Zahlweise.</p>
        <p className="mt-2">Benötigen Sie eine individuelle Lösung? Kontaktieren Sie uns für ein maßgeschneidertes Angebot.</p>
        <div className="mt-6 border-t pt-6">
          <p className="text-base">
            Haben Sie einen Einladungscode von Ihrem Unternehmen?{' '}
            <a 
              href="/auth?with-code=true" 
              className="text-primary hover:underline font-medium"
            >
              Hier registrieren
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}