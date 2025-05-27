import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/auth-store';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from '@/components/ui/button';

export function PauseNotice() {
  const { user, logout } = useAuth();
  const [showNotice, setShowNotice] = useState(false);
  const [pauseReason, setPauseReason] = useState<string | null>(null);
  const [pauseType, setPauseType] = useState<'user' | 'company'>('user');
  
  useEffect(() => {
    // Überprüfen, ob der Benutzer oder das Unternehmen pausiert ist
    if (user) {
      // @ts-ignore - Wir haben den Nutzer um isPaused erweitert, aber nicht im Typ
      if (user.isPaused) {
        setShowNotice(true);
        // @ts-ignore - pauseReason ist im Typ nicht definiert
        setPauseReason(user.pauseReason || null);
        setPauseType('user');
      } 
      // @ts-ignore - isCompanyPaused ist im Typ nicht definiert
      else if (user.isCompanyPaused) {
        setShowNotice(true);
        // @ts-ignore - companyPauseReason ist im Typ nicht definiert
        setPauseReason(user.companyPauseReason || null);
        setPauseType('company');
      } else {
        setShowNotice(false);
      }
    } else {
      setShowNotice(false);
    }
  }, [user]);
  
  if (!showNotice) return null;
  
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {pauseType === 'user' ? 'Konto pausiert' : 'Unternehmen pausiert'}
      </AlertTitle>
      <AlertDescription className="flex flex-col space-y-2">
        <p>
          {pauseType === 'user' 
            ? 'Ihr Konto wurde pausiert.' 
            : 'Ihr Unternehmen wurde pausiert.'}
          <br />
          <strong>Begründung:</strong> {pauseReason || "Keine Begründung angegeben"}
        </p>
        <div>
          <Button variant="outline" size="sm" onClick={() => logout()}>
            Abmelden
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}