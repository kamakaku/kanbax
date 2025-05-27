import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  AlertTriangle
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
  
  // State für Abrechnungszyklus
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(
    localStorage.getItem('billingCycle') as 'monthly' | 'yearly' || 'monthly'
  );
  
  // Beim Laden des Komponente, Abrechnungszyklus aus localStorage abrufen
  useEffect(() => {
    const savedBillingCycle = localStorage.getItem('billingCycle');
    if (savedBillingCycle === 'yearly' || savedBillingCycle === 'monthly') {
      setBillingCycle(savedBillingCycle);
    }
  }, []);
  
  // Änderung des Abrechnungszyklus
  const handleBillingCycleChange = (value: 'monthly' | 'yearly') => {
    setBillingCycle(value);
    localStorage.setItem('billingCycle', value);
  };
  
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
  
  // Abonnementinformationen abrufen - mit forceRefresh für die direkte Aktualisierung nach Bezahlung
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['/api/subscription/current'],
    refetchOnMount: true, // Immer beim Mounten aktualisieren
    refetchOnWindowFocus: true, // Beim Fokussieren des Fensters aktualisieren
    staleTime: 0 // Keine Caching-Zeit, immer frische Daten anfordern
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
    }
  }, []);

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
              localStorage.setItem('billingCycle', billingCycle);
              
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
            <CardTitle>{subscription.packageInfo.displayName}</CardTitle>
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
            <ToggleGroup 
              type="single" 
              value={billingCycle} 
              onValueChange={(value) => {
                if (value) {
                  handleBillingCycleChange(value as 'monthly' | 'yearly');
                }
              }}
              className="justify-start"
            >
              <ToggleGroupItem value="monthly">Monatlich</ToggleGroupItem>
              <ToggleGroupItem value="yearly">Jährlich</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">Preis</p>
              <p className="text-2xl font-bold">
                {formatPrice(subscription.packageInfo.price)}
                <span className="text-sm text-muted-foreground ml-1">
                  {billingCycle === 'monthly' ? '/ Monat' : '/ Jahr'}
                </span>
                {billingCycle === 'yearly' && (
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
            localStorage.setItem('billingCycle', billingCycle);
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
              // Abonnement-Informationen aus dem localStorage holen
              const storedTier = localStorage.getItem('userSubscriptionTier') || 'freelancer';
              const storedCycle = localStorage.getItem('userSubscriptionBillingCycle') || 'monthly';
              
              try {
                // Dialog zur Bestätigung anzeigen
                if (!confirm(`Soll Ihr Abonnement manuell auf ${storedTier} (${storedCycle === 'yearly' ? 'jährlich' : 'monatlich'}) aktualisiert werden?`)) {
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
                
                // Paket-ID basierend auf dem Tier bestimmen
                let packageId = 1; // Standardmäßig "free"
                if (storedTier === 'freelancer') packageId = 2;
                else if (storedTier === 'organisation') packageId = 3;
                else if (storedTier === 'enterprise') packageId = 4;
                else if (storedTier === 'kanbax') packageId = 5;
                
                // Manuelle Aktualisierung durchführen
                const response = await fetch('/api/payments/direct-update', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    userId: parseInt(userId),
                    packageId,
                    billingCycle: storedCycle,
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