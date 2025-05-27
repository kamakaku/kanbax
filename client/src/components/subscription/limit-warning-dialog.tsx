import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { AlertTriangle, Loader2 } from "lucide-react";

interface LimitInfo {
  limitReached: boolean;
  currentPlan: string;
  currentCount: number;
  maxCount: number;
  nextTier: string | null;
}

interface TaskLimitWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskLimitWarningDialog({ open, onOpenChange }: TaskLimitWarningDialogProps) {
  const { data: limitInfo, error, isLoading } = useQuery<LimitInfo>({
    queryKey: ["/api/limits/task-creation"],
    queryFn: async () => {
      const response = await fetch("/api/limits/task-creation");
      if (!response.ok) {
        throw new Error("Fehler beim Abrufen der Limit-Informationen");
      }
      return response.json();
    },
    enabled: open, // Nur abrufen, wenn der Dialog tatsächlich geöffnet ist
  });

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [tierDisplayName, setTierDisplayName] = useState<string>("Gratis");

  useEffect(() => {
    if (error) {
      toast({
        title: "Fehler",
        description: "Limit-Informationen konnten nicht abgerufen werden.",
        variant: "destructive",
      });
    }

    // Tier-Namen basierend auf dem zurückgegebenen Plan anpassen
    if (limitInfo?.currentPlan) {
      switch (limitInfo.currentPlan) {
        case "free":
          setTierDisplayName("Gratis");
          break;
        case "freelancer":
          setTierDisplayName("Freelancer");
          break;
        case "organisation":
          setTierDisplayName("Organisation");
          break;
        case "enterprise":
          setTierDisplayName("Enterprise");
          break;
        default:
          setTierDisplayName(limitInfo.currentPlan);
      }
    }
  }, [error, limitInfo, toast]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Aufgaben-Limit erreicht
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Limit-Informationen werden geladen...</span>
              </div>
            ) : limitInfo?.limitReached ? (
              <>
                <p className="mb-2">
                  Sie haben das maximale Limit von <strong>{limitInfo.maxCount} Aufgaben</strong> für Ihr <strong>{tierDisplayName}</strong>-Abonnement erreicht.
                  Aktuell haben Sie <strong>{limitInfo.currentCount}</strong> von <strong>{limitInfo.maxCount}</strong> möglichen Aufgaben.
                </p>
                <p>
                  Um mehr Aufgaben zu erstellen, können Sie Ihr Abonnement upgraden oder bestehende Aufgaben archivieren.
                </p>
              </>
            ) : (
              <p>
                Sie können weitere Aufgaben erstellen. Aktuell haben Sie {limitInfo?.currentCount || 0} von {limitInfo?.maxCount || 0} Aufgaben.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Schließen</AlertDialogCancel>
          {limitInfo?.limitReached && (
            <AlertDialogAction
              className="bg-gradient-to-r from-violet-500 to-purple-600 text-white"
              onClick={() => setLocation("/subscription-plans")}
            >
              Auf Premium upgraden
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Wir verwenden den benannten Export statt eines Default-Exports