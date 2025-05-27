import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, ArrowRight } from 'lucide-react';

export default function PaymentSuccess() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(true);
  const [success, setSuccess] = useState(false);
  const [packageName, setPackageName] = useState('');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [isDemo, setIsDemo] = useState(false);

  // Extrahiere Query-Parameter aus der URL
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const demoMode = query.get('demo') === 'true';
    const tier = query.get('tier') || localStorage.getItem('demoPackage') || 'freelancer';
    const billing = query.get('billing') || localStorage.getItem('demoBillingCycle') || 'monthly';
    
    // Paketinformationen für die Anzeige festlegen
    setPackageName(getDisplayName(tier));
    setBillingCycle(billing);
    setIsDemo(demoMode);
    
    // Simuliert den Verarbeitungsprozess für ein besseres Benutzererlebnis
    const timer = setTimeout(() => {
      setIsProcessing(false);
      setSuccess(true);
      
      if (demoMode) {
        toast({
          title: "Demo-Modus",
          description: "Dies ist eine Simulation des Zahlungsprozesses. In einer realen Umgebung würde hier die Stripe-Zahlung verarbeitet.",
          duration: 5000,
        });
      } else {
        // Hier würde normalerweise die Stripe-Session überprüft werden
        toast({
          title: "Zahlung erfolgreich",
          description: `Ihr Abonnement wurde aktualisiert auf ${getDisplayName(tier)}`,
          duration: 5000,
        });
      }
      
      // Aufräumen des Speichers
      localStorage.removeItem('demoPackage');
      localStorage.removeItem('demoBillingCycle');
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [toast]);
  
  // Gibt den benutzerfreundlichen Namen für ein Abonnement zurück
  const getDisplayName = (tierName: string): string => {
    switch (tierName.toLowerCase()) {
      case 'free':
        return 'Free';
      case 'freelancer':
        return 'Freelancer';
      case 'organisation':
        return 'Organisation';
      case 'enterprise':
        return 'Enterprise';
      default:
        return tierName;
    }
  };
  
  // Umleitung zum Dashboard
  const handleContinue = () => {
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="container flex items-center justify-center min-h-screen py-12 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {isProcessing ? 'Verarbeite Zahlung...' : 'Zahlung abgeschlossen!'}
          </CardTitle>
          <CardDescription>
            {isProcessing 
              ? 'Bitte warten Sie, während wir Ihre Zahlung verarbeiten' 
              : `Ihr Abonnement wurde erfolgreich auf ${packageName} (${billingCycle === 'yearly' ? 'Jährlich' : 'Monatlich'}) aktualisiert`
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          {isProcessing ? (
            <div className="animate-pulse flex space-x-4 w-full justify-center my-8">
              <div className="h-12 w-12 bg-primary/30 rounded-full"></div>
              <div className="h-12 w-12 bg-primary/50 rounded-full"></div>
              <div className="h-12 w-12 bg-primary/70 rounded-full"></div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4 my-8">
              <div className="rounded-full bg-green-100 p-3">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-medium">Ihr Konto wurde aktualisiert</h3>
                <p className="text-sm text-muted-foreground">
                  Sie haben jetzt Zugriff auf alle Funktionen des {packageName}-Pakets
                </p>
                {isDemo && (
                  <p className="text-xs text-amber-600 mt-4 p-2 bg-amber-50 rounded-lg">
                    Demo-Modus: In einer realen Umgebung würde diese Seite nach einer echten Zahlung über Stripe angezeigt werden.
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleContinue} 
            className="w-full" 
            disabled={isProcessing}
          >
            {isProcessing ? (
              'Bitte warten...'
            ) : (
              <>
                Zum Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}