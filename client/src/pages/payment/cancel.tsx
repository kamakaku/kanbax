import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle } from 'lucide-react';
import { useLocation } from 'wouter';

export default function PaymentCancel() {
  const [, navigate] = useLocation();
  
  // Funktion zum Navigieren zurück zur Abonnementseite
  const handleTryAgain = () => {
    navigate('/subscription-plans');
  };
  
  // Funktion zum Navigieren zum Dashboard
  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Zahlung abgebrochen</CardTitle>
          <CardDescription className="text-center">
            Ihre Zahlungsanfrage wurde abgebrochen. Keine Sorge, es wurde nichts von Ihrem Konto abgebucht.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center justify-center py-4">
            <XCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-center">
              Der Zahlungsvorgang wurde nicht abgeschlossen.
              Sie können es erneut versuchen oder zu einem späteren Zeitpunkt zurückkehren.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button 
            onClick={handleTryAgain} 
            className="w-full"
          >
            Erneut versuchen
          </Button>
          <Button 
            onClick={handleBackToDashboard}
            variant="outline" 
            className="w-full"
          >
            Zurück zum Dashboard
          </Button>
        </CardFooter>
      </Card>
      
      <div className="mt-6 text-center text-sm text-muted-foreground">
        <p>
          Wenn Sie Fragen haben oder Hilfe benötigen, kontaktieren Sie bitte unseren Support.
        </p>
      </div>
    </div>
  );
}