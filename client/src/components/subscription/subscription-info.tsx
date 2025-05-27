import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Check,
  X,
  RefreshCw,
  Loader2,
  CreditCard,
  AlertTriangle,
  ArrowDownIcon
} from 'lucide-react';
import { useAuth } from '@/lib/auth-store';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Label } from '@/components/ui/label';

interface SubscriptionInfo {
  companyId: number;
  subscriptionTier: string;
  subscriptionStatus: string;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  subscriptionBillingCycle: 'monthly' | 'yearly';
  packageInfo: {
    displayName: string;
    description: string;
    price: number;
    features: {
      maxProjects: number;
      maxBoards: number;
      maxTeams: number;
      maxUsersPerCompany: number;
      hasGanttView: boolean;
      hasAdvancedReporting: boolean;
      hasApiAccess: boolean;
      hasCustomBranding: boolean;
      hasPrioritySupportAccess: boolean;
    }
  } | null;
}

interface UsageInfo {
  projectCount: number;
  boardCount: number;
  teamCount: number;
  userCount: number;
}

const SubscriptionInfo: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  // Der Abrechnungszyklus wird direkt vom Server abgerufen und nicht mehr lokal geändert
  // Wir entfernen den State und die Handler dafür
  
  // DEBUG: Vollständiges Benutzer-Objekt ausgeben
  console.log("SubscriptionInfo - FULL User Object:", user);
  console.log("SubscriptionInfo - Details:", {
    userId: user?.id,
    username: user?.username,
    companyId: user?.companyId,
    companyIdType: user?.companyId !== undefined ? typeof user.companyId : 'undefined',
    companyIdValue: String(user?.companyId),
    isExplicitNull: user?.companyId === null,
    isUndefined: user?.companyId === undefined,
    subscriptionTier: user?.subscriptionTier,
    isCompanyAdmin: user?.isCompanyAdmin,
  });

  // FORCE_OVERRIDE: Für alle Benutzer immer die Abonnementinformationen anzeigen
  // Temporärer Fix, bis wir das genaue Problem identifiziert haben
  const isCompanyUser = false;
  
  // Erzwinge frische Daten bei jedem Laden durch dynamischen Query Key
  const [cacheKey] = useState(() => Date.now());

  // Funktion zum Aktualisieren der Daten
  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
    queryClient.invalidateQueries({ queryKey: ['/api/subscription/usage'] });
    toast({
      title: "Daten aktualisiert",
      description: "Die Abonnementdaten wurden neu geladen.",
    });
  };
  
  // Wenn der Benutzer ein nicht-admin Firmenmitarbeiter ist, zeigen wir eine Nicht-verfügbar Meldung an
  if (isCompanyUser) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Abonnement-Informationen nicht verfügbar</CardTitle>
          <CardDescription>
            Firmenmitarbeiter ohne Admin-Rechte haben keinen Zugriff auf Abonnement-Informationen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">
              Als Mitarbeiter einer Firma ohne Admin-Rechte können Sie keine Abonnement-Informationen einsehen.
            </p>
            <p className="text-muted-foreground mt-2">
              Bitte wenden Sie sich an Ihren Firmenadministrator, wenn Sie Fragen zu Ihrem Abonnement haben.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Abonnementinformationen abrufen - mit dynamischem Key für frische Daten
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['/api/subscription/current', cacheKey],
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 0 // Keine Cache-Zeit für garantiert frische Daten
  });

  // Nutzungsinformationen für die Statusanzeigen
  const usageInfoQuery = useQuery({
    queryKey: ['/api/subscription/usage'],
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0
  });
  
  // Beim Mounten einmal forciert die Daten neu laden
  useEffect(() => {
    // Wenn wir von der Erfolgseite kommen, explizit neu laden
    const fromPayment = localStorage.getItem('fromSuccessfulPayment');
    if (fromPayment === 'true') {
      console.log('Von erfolgreicher Zahlung zurück - aktualisiere Subscription-Daten');
      localStorage.removeItem('fromSuccessfulPayment');
      
      // Abonnementdaten aktualisieren
      refetch();
      
      // Zeige eine Erfolgsmeldung an
      toast({
        title: "Abonnement aktiviert",
        description: "Ihr neues Abonnement wurde erfolgreich aktiviert.",
        duration: 5000,
      });
      
      // WICHTIG: Automatisch ein Downgrade durchführen, falls nötig
      // Das ist erforderlich, wenn ein Benutzer von einem höheren zu einem niedrigeren Paket wechselt
      handleAutomaticDowngrade();
    }
  }, []);
  
  // Funktion für automatisches Downgrade nach erfolgreicher Zahlung
  const handleAutomaticDowngrade = async () => {
    try {
      // Prüfen, ob wir ein Downgrade durchführen müssen
      const targetTier = localStorage.getItem('targetSubscriptionTier');
      
      if (!targetTier) {
        console.log('Kein Ziel-Tier im localStorage gefunden, kein automatisches Downgrade nötig');
        return;
      }
      
      console.log('Prüfe auf Downgrade-Notwendigkeit. Ziel-Tier aus localStorage:', targetTier);
      
      // WICHTIG: Direkter Backend-Update-Aufruf über die direkte Update-API,
      // die nicht durch Stripe-Webhooks geht sondern sofort durchgeführt wird
      try {
        console.log("Direkter API-Call an /api/payments/direct-update mit forceDowngrade=true");
        
        // Direkte Backend-Update-API nutzen (neu implementiert für solche Fälle)
        const directUpdateResponse = await fetch('/api/payments/direct-update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: localStorage.getItem('userId') ? parseInt(localStorage.getItem('userId')!) : undefined,
            packageId: (() => {
              // Direkte Bestimmung der Paket-ID basierend auf dem Tier-Namen
              switch(targetTier.toLowerCase()) {
                case 'free': return 1;
                case 'freelancer': return 2;
                case 'organisation': return 3;
                case 'enterprise': return 4;
                case 'kanbax': return 5;
                default: return 2; // Fallback zu Freelancer
              }
            })(),
            billingCycle: localStorage.getItem('targetSubscriptionBillingCycle') || 'monthly',
            forceDowngrade: true
          }),
        });
        
        if (directUpdateResponse.ok) {
          const directUpdateResult = await directUpdateResponse.json();
          console.log("✅ Direktes Update über payments/direct-update erfolgreich:", directUpdateResult);
        } else {
          console.error("⚠️ Direktes Update fehlgeschlagen, versuche Standard-API");
          throw new Error("Direktes Update fehlgeschlagen");
        }
      } catch (directUpdateError) {
        console.error("Fehler beim direkten Update:", directUpdateError);
        
        // Fallback: Standard-API verwenden, wenn direkte API fehlschlägt
        const response = await fetch('/api/subscription/update-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tier: targetTier.toLowerCase(),
            billingCycle: localStorage.getItem('targetSubscriptionBillingCycle') || 'monthly',
            forceDowngrade: true // Wichtig: Erlaubt das Downgrade auch bei aktivem Abonnement
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Fehler beim automatischen Downgrade: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log("✅ Automatisches Downgrade über Standard-API erfolgreich:", result);
      }
      
      // Sofort lokale Benutzerinformation aktualisieren
      try {
        console.log("Invalidiere React Query Cache und lade Daten neu");
        
        // Cache explizit invalidieren - nutze queryClient aus dem globalen Fenster-Objekt
        // Typ korrekt definiert und verfügbar
        if (typeof window !== 'undefined' && window.queryClient) {
          // Diese Methode sollte jetzt TypeScript-kompatibel sein
          window.queryClient.invalidateQueries({ queryKey: ['/api/auth/current-user'] });
          window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
          window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/usage'] });
        }
        
        // Explizites Neuladen der Daten
        console.log("Erzwinge Neuladen der Abonnementdaten");
        await refetch();
        
        // Erfolgsmeldung
        toast({
          title: "Abonnement aktualisiert",
          description: `Ihr Abonnement wurde auf ${targetTier} aktualisiert.`,
          duration: 5000,
        });
        
        // Cleanup
        localStorage.removeItem('targetSubscriptionTier');
        localStorage.removeItem('targetSubscriptionBillingCycle');
      } catch (reloadError) {
        console.error("Fehler beim Aktualisieren nach Downgrade:", reloadError);
      }
    } catch (error) {
      console.error("Fehler beim automatischen Downgrade:", error);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mb-2" />
            <h3 className="text-lg font-semibold">Fehler beim Laden der Abonnementinformationen</h3>
            <p className="text-sm text-muted-foreground">
              Bitte versuchen Sie es später erneut oder kontaktieren Sie den Support.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const subscription = data as SubscriptionInfo;
  const usageInfo = usageInfoQuery.data as UsageInfo || {
    projectCount: 0,
    boardCount: 0,
    teamCount: 0,
    userCount: 0
  };

  // DEBUG: Ausgabe der kompletten Subscription-Daten
  console.log("🔍 [SUBSCRIPTION-INFO] Full subscription data:", subscription);
  console.log("🔍 [SUBSCRIPTION-INFO] User billing cycle:", user?.subscriptionBillingCycle);
  console.log("🔍 [SUBSCRIPTION-INFO] API billing cycle:", subscription?.subscriptionBillingCycle);
  console.log("🔍 [SUBSCRIPTION-INFO] Package info:", subscription?.packageInfo);

  // Intelligente Billing Cycle Korrektur: API hat Vorrang, aber User-Daten als Fallback
  if (subscription) {
    if (subscription.subscriptionBillingCycle && subscription.subscriptionBillingCycle !== undefined) {
      // API-Daten sind verfügbar und gültig - verwende sie
      console.log("🔍 [SUBSCRIPTION-INFO] Using API billing cycle:", subscription.subscriptionBillingCycle);
    } else if (user?.subscriptionBillingCycle) {
      // API-Daten sind undefined - verwende User-Daten als Fallback
      console.log("🔍 [SUBSCRIPTION-INFO] Using User billing cycle as fallback:", user.subscriptionBillingCycle);
      subscription.subscriptionBillingCycle = user.subscriptionBillingCycle as "monthly" | "yearly";
    } else {
      // Letzter Fallback
      subscription.subscriptionBillingCycle = "monthly" as "monthly" | "yearly";
    }
  }

  // Wenn keine Abonnementinformationen vorhanden sind
  if (!subscription || !subscription.packageInfo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kostenlose Nutzung</CardTitle>
          <CardDescription>
            Sie nutzen die kostenlose Version mit eingeschränkten Funktionen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Verfügbare Funktionen:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="flex items-center">
                <Check className="h-5 w-5 text-green-500 mr-2" />
                <span>Bis zu 3 Projekte</span>
              </div>
              <div className="flex items-center">
                <Check className="h-5 w-5 text-green-500 mr-2" />
                <span>Bis zu 5 Boards</span>
              </div>
              <div className="flex items-center">
                <Check className="h-5 w-5 text-green-500 mr-2" />
                <span>Bis zu 2 Teams</span>
              </div>
              <div className="flex items-center">
                <Check className="h-5 w-5 text-green-500 mr-2" />
                <span>Bis zu 5 Benutzer</span>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={() => {
              // Flag setzen, dass wir von einem Free-Account upgraden
              localStorage.setItem('upgradeFromFree', 'true');
              localStorage.setItem('billingCycle', 'monthly'); // Standard: monatlich
              
              // Zur Subscription-Plans-Seite navigieren
              setLocation('/subscription-plans');
            }}
            className="w-full"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Upgraden
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Prozentsätze für die Nutzungsanzeigen berechnen
  const projectPercentage = calculatePercentage(
    usageInfo.projectCount,
    subscription.packageInfo.features.maxProjects
  );
  
  const boardPercentage = calculatePercentage(
    usageInfo.boardCount,
    subscription.packageInfo.features.maxBoards
  );
  
  const teamPercentage = calculatePercentage(
    usageInfo.teamCount,
    subscription.packageInfo.features.maxTeams
  );
  
  const userPercentage = calculatePercentage(
    usageInfo.userCount,
    subscription.packageInfo.features.maxUsersPerCompany
  );


  
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              {subscription.packageInfo.displayName}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refreshData}
                className="ml-2"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardTitle>
            <CardDescription>{subscription.packageInfo.description}</CardDescription>
          </div>
          <StatusBadge status={subscription.subscriptionStatus} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Abrechnungszyklus und Preis */}
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Abrechnungszyklus</Label>
            <div className="flex items-center rounded-md border px-4 py-2">
              <span className="font-medium">
                {subscription.subscriptionBillingCycle === 'yearly' ? 'Jährlich' : 'Monatlich'}
              </span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">Preis</p>
              <p className="text-2xl font-bold">
                {subscription.subscriptionBillingCycle === 'yearly' 
                  ? formatPrice(calculateYearlyPrice(subscription.packageInfo.price))
                  : formatPrice(subscription.packageInfo.price) 
                }
                <span className="text-sm text-muted-foreground ml-1">
                  {subscription.subscriptionBillingCycle === 'yearly' ? '/ Jahr' : '/ Monat'}
                </span>
                {subscription.subscriptionBillingCycle === 'yearly' && (
                  <span className="ml-1 text-xs text-green-600 block">Jährlich günstiger</span>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">Gültig bis</p>
              <p className="text-lg">
                {subscription.subscriptionEndDate
                  ? formatDate(subscription.subscriptionEndDate)
                  : "Unbegrenzt"}
              </p>
            </div>
          </div>
        </div>

        {/* Nutzungskontingente */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Kontingente</h3>
          
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Projekte</span>
              <span>
                {usageInfo.projectCount} / {subscription.packageInfo.features.maxProjects}
              </span>
            </div>
            <Progress value={projectPercentage} className="h-2" />
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Boards</span>
              <span>
                {usageInfo.boardCount} / {subscription.packageInfo.features.maxBoards}
              </span>
            </div>
            <Progress value={boardPercentage} className="h-2" />
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Teams</span>
              <span>
                {usageInfo.teamCount} / {subscription.packageInfo.features.maxTeams}
              </span>
            </div>
            <Progress value={teamPercentage} className="h-2" />
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Benutzer</span>
              <span>
                {usageInfo.userCount} / {subscription.packageInfo.features.maxUsersPerCompany}
              </span>
            </div>
            <Progress value={userPercentage} className="h-2" />
          </div>
        </div>

        {/* Premium-Features */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Premium-Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <FeatureItem 
              feature="Gantt-Ansicht" 
              available={subscription.packageInfo.features.hasGanttView} 
            />
            <FeatureItem 
              feature="Erweiterte Berichte" 
              available={subscription.packageInfo.features.hasAdvancedReporting} 
            />
            <FeatureItem 
              feature="API-Zugriff" 
              available={subscription.packageInfo.features.hasApiAccess} 
            />
            <FeatureItem 
              feature="Custom Branding" 
              available={subscription.packageInfo.features.hasCustomBranding} 
            />
            <FeatureItem 
              feature="Premium Support" 
              available={subscription.packageInfo.features.hasPrioritySupportAccess} 
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <Button 
          onClick={() => {
            // Speichere das aktuelle Abonnement und den Abrechnungszyklus für die Subscription-Plans-Seite
            localStorage.setItem('currentSubscriptionTier', subscription.subscriptionTier);
            localStorage.setItem('billingCycle', subscription.subscriptionBillingCycle);
            localStorage.setItem('changeSubscription', 'true');
            
            // Navigiere zur Subscription-Plans-Seite
            setLocation('/subscription-plans');
          }} 
          className="w-full"
        >
          <CreditCard className="mr-2 h-4 w-4" />
          Abonnement ändern
        </Button>
        
        {/* Neuer Button zur manuellen Aktualisierung des Abonnements für Testzwecke */}
        <div className="w-full">
          <p className="text-xs text-muted-foreground mb-2 text-center">
            Haben Sie bereits ein Abonnement gekauft, aber es wird nicht angezeigt?
          </p>
          <Button 
            onClick={async () => {
              // Abonnement-Informationen aus den lokalen Zustandsvariablen holen
              // Diese werden von der API-Abfrage gesetzt und sind aktueller als localStorage
              const currentTier = subscription.subscriptionTier;
              
              // Korrekte Zielwerte aus localStorage oder Fallback verwenden
              // Wenn targetSubscriptionTier nicht gesetzt ist, versuchen wir es mit anderen Variablen
              const targetTier = localStorage.getItem('targetSubscriptionTier') || 
                                localStorage.getItem('demoPackage') ||
                                (localStorage.getItem('selectedPackageId') 
                                  ? (() => {
                                      // Inline-Implementierung der getPackageNameById-Funktion
                                      const pkgId = parseInt(localStorage.getItem('selectedPackageId') || '2');
                                      switch (pkgId) {
                                        case 1: return 'free';
                                        case 2: return 'freelancer';
                                        case 3: return 'organisation';
                                        case 4: return 'enterprise';
                                        case 5: return 'kanbax';
                                        default: return 'freelancer';
                                      }
                                    })()
                                  : 'organisation'); // Standard-Fallback ist Organisation
              
              const targetCycle = localStorage.getItem('targetSubscriptionBillingCycle') || 
                                localStorage.getItem('demoBillingCycle') || 
                                subscription.subscriptionBillingCycle;
              
              // Debug-Informationen in der Konsole
              console.log("Aktueller Tier:", currentTier);
              console.log("Ziel-Tier:", targetTier);
              console.log("Ziel-Abrechnungszyklus:", targetCycle);
              
              try {
                // Prüfen, ob tatsächlich eine Änderung vorliegt
                if (currentTier === targetTier && subscription.subscriptionBillingCycle === targetCycle) {
                  toast({
                    title: "Keine Änderung",
                    description: "Das ausgewählte Abonnement entspricht Ihrem aktuellen Abonnement.",
                  });
                  return;
                }
                
                // Dialog zur Bestätigung anzeigen
                if (!confirm(`Soll Ihr Abonnement von "${currentTier}" auf "${targetTier}" (${targetCycle === 'yearly' ? 'jährlich' : 'monatlich'}) aktualisiert werden?`)) {
                  return;
                }
                
                // Benutzer-ID holen
                const userId = localStorage.getItem('userId');
                if (!userId) {
                  toast({
                    title: "Fehler",
                    description: "Keine Benutzer-ID gefunden. Bitte loggen Sie sich erneut ein.",
                    variant: "destructive"
                  });
                  return;
                }
                
                // Paket-ID basierend auf dem Ziel-Tier bestimmen
                let packageId = 1; // Standardmäßig "free"
                if (targetTier === 'freelancer') packageId = 2;
                else if (targetTier === 'organisation') packageId = 3;
                else if (targetTier === 'enterprise') packageId = 4;
                else if (targetTier === 'kanbax') packageId = 5;
                
                // Manuelle Aktualisierung durchführen
                const response = await fetch('/api/payments/direct-update', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    userId: parseInt(userId),
                    packageId,
                    billingCycle: targetCycle,
                    sessionId: 'manual_update_' + Date.now()
                  })
                });
                
                if (response.ok) {
                  const result = await response.json();
                  console.log("✅ Abonnement manuell aktualisiert:", result);
                  
                  // React Query Cache invalidieren
                  if (window.queryClient) {
                    window.queryClient.invalidateQueries({ queryKey: ['/api/auth/current-user'] });
                    window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
                    window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/usage'] });
                  }
                  
                  // Erfolgsmeldung und Seite neu laden
                  toast({
                    title: "Erfolg",
                    description: "Ihr Abonnement wurde erfolgreich aktualisiert. Die Seite wird neu geladen.",
                    duration: 5000,
                  });
                  
                  // Seite nach 2 Sekunden neu laden
                  setTimeout(() => {
                    window.location.reload();
                  }, 2000);
                } else {
                  // Fehlermeldung anzeigen
                  const errorData = await response.json();
                  throw new Error(errorData.message || 'Unbekannter Fehler bei der Aktualisierung');
                }
              } catch (error) {
                console.error("Fehler bei der manuellen Aktualisierung:", error);
                toast({
                  title: "Fehler",
                  description: error instanceof Error ? error.message : "Fehler bei der Aktualisierung des Abonnements",
                  variant: "destructive"
                });
              }
            }} 
            variant="outline"
            className="w-full text-sm"
          >
            <RefreshCw className="mr-2 h-3 w-3" />
            Abonnement manuell aktualisieren
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

// Hilfsfunktionen und -komponenten
const formatPrice = (price: number) => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2
  }).format(price / 100);
};

// Berechnet den jährlichen Preis mit 10% Rabatt
const calculateYearlyPrice = (monthlyPrice: number) => {
  return Math.round(monthlyPrice * 12 * 0.9);
};

// Ermittelt den Paketnamen anhand der ID
const getPackageNameById = (packageId: number): string => {
  switch (packageId) {
    case 1:
      return 'free';
    case 2:
      return 'freelancer';
    case 3:
      return 'organisation';
    case 4:
      return 'enterprise';
    case 5:
      return 'kanbax';
    default:
      return 'freelancer'; // Fallback
  }
};


const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('de-DE');
};

const calculatePercentage = (current: number, max: number) => {
  if (max === 0) return 0;
  return Math.min(Math.round((current / max) * 100), 100);
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  switch (status.toLowerCase()) {
    case 'active':
      return <Badge className="bg-green-500">Aktiv</Badge>;
    case 'inactive':
      return <Badge variant="secondary">Inaktiv</Badge>;
    case 'past_due':
      return <Badge variant="destructive">Fällig</Badge>;
    case 'canceled':
      return <Badge variant="outline">Gekündigt</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const FeatureItem: React.FC<{ feature: string; available: boolean }> = ({ 
  feature, 
  available 
}) => {
  return (
    <div className="flex items-center">
      {available ? (
        <Check className="h-5 w-5 text-green-500 mr-2" />
      ) : (
        <X className="h-5 w-5 text-red-500 mr-2" />
      )}
      <span className={available ? "" : "text-muted-foreground"}>{feature}</span>
    </div>
  );
};

export default SubscriptionInfo;