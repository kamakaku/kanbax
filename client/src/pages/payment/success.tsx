import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

interface SubscriptionInfo {
  id: number;
  userId: number;
  packageId: number;
  status: string;
  billingCycle: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function PaymentSuccess() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [progress, setProgress] = useState(10);
  const [step, setStep] = useState(1);
  const [price, setPrice] = useState(0);
  
  // Holen der URL-Parameter
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id');
  const demoMode = params.get('demo') === 'true';
  const tier = params.get('tier') || localStorage.getItem('demoPackage') || 'freelancer';
  const billingCycle = params.get('billing') || localStorage.getItem('demoBillingCycle') || 'monthly';
  const storedPrice = localStorage.getItem('demoPackagePrice');
  
  // Funktion zum Formatieren des Paketnamens
  const formatPackageName = (name: string): string => {
    switch (name.toLowerCase()) {
      case 'free':
        return 'Free';
      case 'freelancer':
        return 'Freelancer';
      case 'organisation':
        return 'Organisation';
      case 'enterprise':
        return 'Enterprise';
      case 'kanbax':
        return 'Kanbax';
      default:
        return name;
    }
  };

  // Funktion zum Formatieren des Abrechnungszyklus
  const formatBillingCycle = (cycle: string): string => {
    return cycle === 'yearly' ? 'jährlich' : 'monatlich';
  };
  
  // Funktion zum Abrufen der Abonnementinformationen
  const fetchSubscriptionInfo = async () => {
    try {
      if (demoMode) {
        // Im Demo-Modus verwenden wir die simulierten Daten aus localStorage
        console.log('Demo-Modus: Simuliere erfolgreiche Zahlung');
        
        // Wichtig: Explizit die korrekten Target-Parameter für den manuellen Update-Prozess setzen
        localStorage.setItem('targetSubscriptionTier', tier.toLowerCase());
        localStorage.setItem('targetSubscriptionBillingCycle', billingCycle);
        console.log("SUCCESS-PAGE: Ziel-Tier explizit gesetzt auf:", tier.toLowerCase());
        console.log("SUCCESS-PAGE: Ziel-Billing-Cycle explizit gesetzt auf:", billingCycle);
        
        setTimeout(() => {
          setProgress(100);
          setStep(3);
          setLoading(false);
          
          // Simuliertes Abonnement-Objekt für den Demo-Modus
          setSubscription({
            id: 999,
            userId: parseInt(localStorage.getItem('userId') || '9'),
            packageId: tier === 'freelancer' ? 2 : (tier === 'organisation' ? 3 : 4),
            status: 'active',
            billingCycle: billingCycle,
            stripeCustomerId: 'demo_customer',
            stripeSubscriptionId: 'demo_subscription',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }, 1500); // Kurze simulierte Ladezeit
        
        return;
      }
      
      if (!sessionId) {
        setLoading(false);
        setError('Keine Session-ID gefunden. Die Zahlungsbestätigung kann nicht überprüft werden.');
        return;
      }
      
      // API-Anfrage, um die Abonnementinformationen abzurufen
      setProgress(30);
      setStep(2);
      
      // Direkte Abfrage der Session und Aktualisierung des Benutzers
      const sessionResponse = await fetch(`/api/payments/success?session_id=${sessionId}`);
      
      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json();
        throw new Error(errorData.message || 'Fehler beim Abrufen der Zahlungsinformationen');
      }
      
      const sessionData = await sessionResponse.json();
      setProgress(70);
      setStep(3);
      
      if (sessionData.success && sessionData.subscription) {
        setSubscription(sessionData.subscription);
        
        // Webhooks sollten die Aktualisierung bereits durchgeführt haben
        // Wir prüfen den Abonnementstatus und versuchen es nur, wenn das Abonnement noch nicht aktiv ist
        console.log("Prüfe Abonnement-Status:", sessionData.subscription);
        
        if (sessionData.subscription.status !== "active") {
          console.log("⚠️ Abonnement ist nicht aktiv. Versuche direkte Aktualisierung als Backup...");
          
          try {
            // Hole die Paket-ID und andere notwendige Informationen aus der Session
            const packageId = sessionData.subscription.packageId || 
                              (tier === 'freelancer' ? 2 : (tier === 'organisation' ? 3 : 4));
            const userId = sessionData.subscription.userId || parseInt(localStorage.getItem('userId') || '0');
            
            // Endpoint für die manuelle Aktualisierung als Backup, wenn Webhooks nicht funktioniert haben
            const updateResponse = await fetch('/api/payments/direct-update', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                userId,
                packageId,
                billingCycle,
                sessionId
              })
            });
            
            if (updateResponse.ok) {
              const updateResult = await updateResponse.json();
              console.log("✅ Benutzer-Abonnement manuell aktualisiert:", updateResult);
              setProgress(100);
            } else {
              console.error("❌ Fehler bei der direkten Aktualisierung:", await updateResponse.text());
            }
          } catch (updateError) {
            console.error("❌ Fehler bei der direkten Aktualisierung:", updateError);
          }
        } else {
          console.log("✅ Abonnement ist bereits aktiv - keine manuelle Aktualisierung notwendig");
          setProgress(100);
        }
      } else {
        throw new Error('Keine Abonnementdaten empfangen');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Fehler beim Abrufen der Abonnementinformationen:', error);
      setLoading(false);
      setError(error instanceof Error ? error.message : 'Unbekannter Fehler beim Abrufen der Zahlungsinformationen');
      
      // Fallback auf Demo-Modus bei API-Fehlern
      console.log('Fallback auf Demo-Modus wegen API-Fehler');
      setSubscription({
        id: 999,
        userId: parseInt(localStorage.getItem('userId') || '9'),
        packageId: tier === 'freelancer' ? 2 : (tier === 'organisation' ? 3 : 4),
        status: 'active',
        billingCycle: billingCycle,
        stripeCustomerId: 'demo_customer',
        stripeSubscriptionId: 'demo_subscription',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  };
  
  // Formatieren des Preises aus Cent in Euro mit Dezimalpunkt
  const formatPrice = (priceInCents: number): string => {
    // Preis in Euro umrechnen (Cent / 100)
    const priceInEuro = priceInCents / 100;
    
    // Formatieren mit deutschem Format (Komma statt Punkt)
    return priceInEuro.toFixed(2).replace('.', ',') + ' €';
  };

  // Beim Laden der Komponente die Abonnementinformationen abrufen
  useEffect(() => {
    // Preis aus localStorage setzen, falls vorhanden
    if (storedPrice) {
      setPrice(parseInt(storedPrice));
    }
    
    // Simulation des Fortschritts
    const interval = setInterval(() => {
      setProgress((prevProgress) => {
        const newProgress = prevProgress + 5;
        
        if (newProgress >= 30 && step === 1) {
          clearInterval(interval);
          return 30;
        }
        
        if (newProgress >= 100) {
          clearInterval(interval);
          return 100;
        }
        
        return newProgress;
      });
    }, 200);
    
    // Abonnementinformationen abrufen
    fetchSubscriptionInfo();
    
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Funktion zum Aktualisieren des lokalen Benutzerprofils
  const updateLocalUserProfile = async () => {
    try {
      // Importiere die Funktion zum Neuladen der Benutzerdaten
      const { reloadUserData } = await import('@/lib/auth-store');
      
      // Lade die Benutzerdaten neu
      const userData = await reloadUserData();
      
      // Aktualisiere lokale Speicherung
      if (userData) {
        console.log('Benutzerprofil aktualisiert nach Zahlung:', userData);
        
        // Force-Update des lokalen Speichers
        localStorage.setItem('userSubscriptionTier', userData.subscriptionTier || tier);
        localStorage.setItem('userSubscriptionBillingCycle', userData.subscriptionBillingCycle || billingCycle);
      } else {
        // Fallback: Manuelles Setzen der Daten
        console.log('Fallback: Setze Subscription-Daten manuell', { tier, billingCycle });
        localStorage.setItem('userSubscriptionTier', tier);
        localStorage.setItem('userSubscriptionBillingCycle', billingCycle);
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren des lokalen Benutzerprofils:', error);
      
      // Fallback: Setze die Werte direkt
      localStorage.setItem('userSubscriptionTier', tier);
      localStorage.setItem('userSubscriptionBillingCycle', billingCycle);
      
      // Wichtig: Stelle sicher, dass targetSubscriptionTier ebenfalls korrekt gesetzt ist
      localStorage.setItem('targetSubscriptionTier', tier.toLowerCase());
      localStorage.setItem('targetSubscriptionBillingCycle', billingCycle);
      console.log("Notfall-Fallback: targetSubscriptionTier explizit gesetzt auf:", tier.toLowerCase());
    }
  };

  // Automatische sofortige Aktualisierung bei Seitenladung
  useEffect(() => {
    const autoUpdateSubscription = async () => {
      try {
        setProgress(75);
        const userId = localStorage.getItem('userId');
        const packageId = (() => {
          // Direkte Bestimmung der Paket-ID basierend auf dem Tier-Namen
          switch(tier.toLowerCase()) {
            case 'free': return 1;
            case 'freelancer': return 2;
            case 'organisation': return 3;
            case 'enterprise': return 4;
            case 'kanbax': return 5;
            default: return 2; // Fallback zu Freelancer
          }
        })();
        
        console.log(`SUCCESS-PAGE: AUTO-UPDATE: Führe automatische Aktualisierung durch für Benutzer ${userId}, Paket ${packageId} (${tier}), Zyklus ${billingCycle}`);
        
        // ✨ ABSOLUT GARANTIERTER AUTOMATISCHER UPDATE ✨
        console.log("GARANTIERTER UPDATE: Starte vollautomatisches Update-Verfahren");
        
        // 1. Versuch: Verwende den guaranteed-update API-Endpunkt
        console.log("GARANTIERTER UPDATE: Erster Versuch über guaranteed-update API");
        try {
          const guaranteedResponse = await fetch('/api/subscription/guaranteed-update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              tier: tier.toLowerCase(),
              billingCycle: billingCycle || 'monthly' // Explizit den billing cycle übergeben mit Fallback
            })
          });
          
          const guaranteedResult = await guaranteedResponse.json();
          
          if (guaranteedResponse.ok && guaranteedResult.success) {
            console.log("✅ GARANTIERTER UPDATE: Erfolgreich durchgeführt:", guaranteedResult);
            
            // Fortfahren mit Erfolg
            setProgress(100);
            await updateLocalUserProfile();
            toast({
              title: "Abonnement automatisch aktualisiert",
              description: `Ihr Abonnement (${formatPackageName(tier)}) wurde erfolgreich aktiviert.`,
              duration: 5000,
            });
            
            // Cache invalidieren
            if (window.queryClient) {
              window.queryClient.invalidateQueries({ queryKey: ['/api/auth/current-user'] });
              window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
              window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/usage'] });
            }
            
            setLoading(false);
            return; // Erfolgreich beendet
          } else {
            console.warn("⚠️ GUARANTEED UPDATE: Fehlgeschlagen, versuche interne API Methode...", guaranteedResult);
          }
        } catch (guaranteedError) {
          console.error("❌ GUARANTEED UPDATE: Fehler:", guaranteedError);
          // Weiter zu alternativen Methoden
        }
          
        // 2. Versuch: Verwende den internen direkten Update-Endpunkt als Alternative
        console.log("GARANTIERTER UPDATE: Zweiter Versuch über internen Direct-Update-API");
        try {
          const directUpdateResponse = await fetch('/api/internal/update-subscription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: parseInt(userId || '0'),
              tier: tier.toLowerCase(),
              billingCycle: billingCycle || 'monthly', // Explizit den billing cycle übergeben mit Fallback
              apiKey: 'local_development_key' // Für Entwicklung - in Produktion sollte dies sicher gehandhabt werden
            })
          });
          
          const directResult = await directUpdateResponse.json();
          
          if (directUpdateResponse.ok && directResult.success) {
            console.log("✅ GARANTIERTER UPDATE: Erfolgreich durchgeführt:", directResult);
            
            // Fortfahren mit Erfolg
            setProgress(100);
            await updateLocalUserProfile();
            toast({
              title: "Abonnement automatisch aktualisiert",
              description: `Ihr Abonnement (${formatPackageName(tier)}) wurde erfolgreich aktiviert.`,
              duration: 5000,
            });
            
            // Cache invalidieren
            if (window.queryClient) {
              window.queryClient.invalidateQueries({ queryKey: ['/api/auth/current-user'] });
              window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
              window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/usage'] });
            }
            
            setLoading(false);
            return; // Erfolgreich beendet
          } else {
            console.warn("⚠️ GARANTIERTER UPDATE: Fehlgeschlagen, versuche alternative Methoden...", directResult);
          }
        } catch (directError) {
          console.error("❌ GARANTIERTER UPDATE: Fehler:", directError);
          // Weiter zu alternativen Methoden
        }
        
        // 2. Versuch: Aktualisierung über normalen subscription/update-user API mit forceDowngrade-Option
        console.log("AUTOMATISCHES UPDATE: Zweiter Versuch über subscription/update-user API");
        try {
          const subscriptionUpdateResponse = await fetch('/api/subscription/update-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              tier: tier.toLowerCase(),
              billingCycle: billingCycle || 'monthly',
              forceDowngrade: true
            })
          });
          
          const subscriptionResult = await subscriptionUpdateResponse.json();
          
          if (subscriptionUpdateResponse.ok && subscriptionResult.success) {
            console.log("✅ AUTOMATISCHES UPDATE: Über subscription/update-user erfolgreich:", subscriptionResult);
            
            // Fortfahren mit Erfolg
            setProgress(100);
            await updateLocalUserProfile();
            toast({
              title: "Abonnement automatisch aktualisiert",
              description: `Ihr Abonnement (${formatPackageName(tier)}) wurde erfolgreich aktiviert.`,
              duration: 5000,
            });
            
            // Cache invalidieren
            if (window.queryClient) {
              window.queryClient.invalidateQueries({ queryKey: ['/api/auth/current-user'] });
              window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
              window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/usage'] });
            }
            
            setLoading(false);
            return; // Erfolgreich beendet
          } else {
            console.warn("⚠️ AUTOMATISCHES UPDATE: Über subscription/update-user fehlgeschlagen, letzter Versuch...");
          }
        } catch (subscriptionError) {
          console.error("❌ AUTOMATISCHES UPDATE: Fehler mit subscription/update-user:", subscriptionError);
          // Weiter zum letzten Versuch
        }
        
        // 3. Versuch (letzte Chance): Direkter API-Aufruf zur Aktualisierung
        console.log("AUTOMATISCHES UPDATE: Letzter Versuch über payments/direct-update API");
        const updateResponse = await fetch('/api/payments/direct-update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: parseInt(userId || '0'),
            packageId,
            billingCycle: billingCycle || 'monthly',
            sessionId: 'final_auto_update_' + Date.now(),
            forceDowngrade: true // Wichtig: Erlaubt auch Downgrades
          })
        });
        
        const updateResult = await updateResponse.json();
        
        if (updateResponse.ok) {
          console.log("✅ SUCCESS-PAGE AUTO-UPDATE: Automatische Aktualisierung erfolgreich durchgeführt:", updateResult);
          setProgress(100);
          
          // Cache invalidieren, damit frische Daten geladen werden
          if (window.queryClient) {
            window.queryClient.invalidateQueries({ queryKey: ['/api/auth/current-user'] });
            window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
            window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/usage'] });
          }
          
          // Lokales Benutzerprofil aktualisieren
          await updateLocalUserProfile();
          
          // Erfolgsmeldung
          toast({
            title: "Abonnement automatisch aktualisiert",
            description: `Ihr Abonnement (${formatPackageName(tier)}) wurde erfolgreich aktiviert.`,
            duration: 5000,
          });
          
          setLoading(false);
        } else {
          console.warn("⚠️ SUCCESS-PAGE AUTO-UPDATE: Automatische Aktualisierung fehlgeschlagen:", updateResult);
          throw new Error("Automatische Aktualisierung fehlgeschlagen: " + (updateResult.message || "Unbekannter Fehler"));
        }
      } catch (error) {
        console.error("❌ SUCCESS-PAGE AUTO-UPDATE: Fehler bei automatischer Aktualisierung:", error);
        // Zur Sicherheit den Nutzer informieren
        toast({
          title: "Automatisches Update fehlgeschlagen",
          description: "Ein weiterer Versuch wird beim Klicken auf 'Zum Dashboard' durchgeführt.",
          variant: "destructive",
          duration: 8000,
        });
        setLoading(false);
      }
    };
    
    // Auto-Update nach kurzer Verzögerung starten (damit Nutzer die Seite sieht)
    const timer = setTimeout(() => {
      if (demoMode || sessionId) {
        autoUpdateSubscription();
      }
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [demoMode, sessionId, tier, billingCycle]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Funktion zum Navigieren zum Dashboard (Backup-Mechanismus)
  const handleContinue = async () => {
    try {
      // Wenn wir hier ankommen, wurde das automatische Update entweder erfolgreich durchgeführt
      // oder ist fehlgeschlagen. Im letzteren Fall versuchen wir es noch einmal.
      
      // Nochmals Cache invalidieren zur Sicherheit
      if (window.queryClient) {
        window.queryClient.invalidateQueries({ queryKey: ['/api/auth/current-user'] });
        window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
        window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/usage'] });
      }
      
      // Flag setzen, damit die Subscription-Seite bei der Rückkehr weiß, dass wir von einer erfolgreichen Zahlung kommen
      localStorage.setItem('fromSuccessfulPayment', 'true');
      
      // Explizit userId setzen, damit der direkte Update-Prozess funktioniert
      const userId = localStorage.getItem('userId');
      
      // WICHTIG: Stelle sicher, dass die Ziel-Informationen explizit im localStorage gesetzt sind
      localStorage.setItem('targetSubscriptionTier', tier.toLowerCase());
      localStorage.setItem('targetSubscriptionBillingCycle', billingCycle || 'monthly');
      
      // Direkt zum Dashboard navigieren
      navigate('/dashboard', { replace: true });
    } catch (error) {
      console.error("❌ ERROR-PAGE: Fehler beim Navigieren:", error);
      navigate('/dashboard', { replace: true });
    }
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {loading ? 'Zahlungsbestätigung läuft...' : (
              error ? 'Fehler bei der Zahlungsbestätigung' : 'Zahlung erfolgreich!'
            )}
          </CardTitle>
          <CardDescription className="text-center">
            {loading ? 'Bitte warten Sie, während wir Ihre Zahlung bestätigen.' : (
              error ? 'Wir konnten Ihre Zahlung nicht bestätigen.' : 'Ihr Abonnement wurde erfolgreich aktiviert.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Fortschrittsanzeige */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground">
              {loading ? `Schritt ${step} von 3: ${step === 1 ? 'Initialisiere Zahlungsbestätigung' : 
                (step === 2 ? 'Verifiziere Zahlungsdaten' : 'Aktiviere Abonnement')}` : (
                error ? 'Zahlungsbestätigung fehlgeschlagen' : 'Zahlungsbestätigung abgeschlossen'
              )}
            </p>
          </div>
          
          {/* Status-Ansicht basierend auf Zustand */}
          <div className="flex flex-col items-center justify-center py-4">
            {loading ? (
              <>
                <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                <p>Bitte warten Sie, während wir Ihre Zahlung verarbeiten...</p>
              </>
            ) : error ? (
              <>
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <p className="text-center text-destructive">{error}</p>
                <p className="text-sm text-center text-muted-foreground mt-2">
                  Trotzdem wurde eine Demo-Version aktiviert, damit Sie die Anwendung testen können.
                </p>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                <p className="text-lg font-semibold text-center">Zahlung erfolgreich abgeschlossen!</p>
                {subscription && (
                  <div className="mt-4 bg-muted p-4 rounded-lg w-full">
                    <h3 className="font-medium mb-2">Abonnementdetails:</h3>
                    <ul className="space-y-1 text-sm">
                      <li><span className="font-medium">Paket:</span> {formatPackageName(tier)}</li>
                      <li><span className="font-medium">Abrechnung:</span> {formatBillingCycle(billingCycle)}</li>
                      <li><span className="font-medium">Preis:</span> {price > 0 ? 
                        (billingCycle === 'yearly' ? 
                          `${formatPrice(price)} pro Jahr (entspricht ${formatPrice(Math.round(price/12))} pro Monat)` : 
                          `${formatPrice(price)} pro Monat`) : 
                        'Kostenlos'}</li>
                      <li><span className="font-medium">Gespeicherter Preis:</span> {storedPrice ? `${storedPrice} Cent` : 'Kein Preis gespeichert'}</li>
                      <li><span className="font-medium">Status:</span> {subscription.status === 'active' ? 'Aktiv' : subscription.status}</li>
                      <li><span className="font-medium">Aktiviert am:</span> {new Date().toLocaleDateString('de-DE')}</li>
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button 
            onClick={handleContinue} 
            className="w-full" 
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird bearbeitet...
              </>
            ) : 'Zum Dashboard'}
          </Button>
        </CardFooter>
      </Card>
      
      {/* Lauftext mit Erfolgsmeldung unter der Karte */}
      {!loading && !error && (
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>
            Vielen Dank für Ihr Vertrauen! Ihr Abonnement ist jetzt aktiv.
            {demoMode && ' (Demo-Modus)'}
          </p>
          <p className="mt-1">
            Bei Fragen zu Ihrem Abonnement kontaktieren Sie bitte unseren Support.
          </p>
        </div>
      )}
    </div>
  );
}