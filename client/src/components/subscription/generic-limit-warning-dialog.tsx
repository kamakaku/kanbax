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
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { AlertTriangle, Loader2 } from "lucide-react";

interface LimitInfo {
  hasReachedLimit?: boolean;  // Für /api/subscription/check-limit/*
  limitReached?: boolean;     // Für /api/limits/task-creation
  currentPlan?: string;
  currentCount?: number;
  maxCount?: number;
  nextTier?: string | null;
  [key: string]: any;
}

interface GenericLimitWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  limitType: string;
  resourceName: string;
  resourceNamePlural: string;
  endpoint: string;
}

export function GenericLimitWarningDialog({ 
  open, 
  onOpenChange, 
  title, 
  limitType, 
  resourceName, 
  resourceNamePlural,
  endpoint 
}: GenericLimitWarningDialogProps) {
  const { data: limitInfo, error, isLoading } = useQuery<LimitInfo>({
    queryKey: [endpoint],
    queryFn: async () => {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Fehler beim Abrufen der Limit-Informationen für ${resourceNamePlural}`);
      }
      return response.json();
    },
    enabled: open, // Nur abrufen, wenn der Dialog tatsächlich geöffnet ist
  });

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [tierDisplayName, setTierDisplayName] = useState<string>("Gratis");
  const [currentSubscriptionTier, setCurrentSubscriptionTier] = useState<string>("free");

  // Abonnement-Informationen laden
  const { data: subscriptionInfo } = useQuery<{ 
    companyId: number | null; 
    subscriptionTier: string;
    expiresAt: string | null;
  }>({
    queryKey: ['/api/subscription/current'],
    enabled: open,
  });

  useEffect(() => {
    if (error) {
      toast({
        title: "Fehler",
        description: `Limit-Informationen für ${resourceNamePlural} konnten nicht abgerufen werden.`,
        variant: "destructive",
      });
    }

    // Abonnement-Informationen setzen, wenn verfügbar
    if (subscriptionInfo?.subscriptionTier) {
      setCurrentSubscriptionTier(subscriptionInfo.subscriptionTier);
      
      // Tier-Namen basierend auf dem zurückgegebenen Plan anpassen
      switch (subscriptionInfo.subscriptionTier) {
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
          setTierDisplayName(subscriptionInfo.subscriptionTier);
      }
    }
  }, [error, toast, subscriptionInfo, resourceNamePlural]);

  const getMaxAllowedText = () => {
    switch (limitType) {
      case "projects":
        return currentSubscriptionTier === "free" 
          ? "Im kostenlosen Paket ist nur ein Projekt erlaubt." 
          : `Im ${tierDisplayName}-Paket sind maximal ${getMaxCount()} ${resourceNamePlural} erlaubt.`;
      case "boards":
        return currentSubscriptionTier === "free" 
          ? "Im kostenlosen Paket ist nur ein Board erlaubt." 
          : `Im ${tierDisplayName}-Paket sind maximal ${getMaxCount()} ${resourceNamePlural} erlaubt.`;
      case "tasks":
        return `Im ${tierDisplayName}-Paket sind maximal ${getMaxCount()} ${resourceNamePlural} erlaubt.`;
      default:
        return `Das Limit für ${resourceNamePlural} wurde erreicht.`;
    }
  };

  const getMaxCount = () => {
    switch (limitType) {
      case "projects":
        return currentSubscriptionTier === "free" ? 1 : 
               currentSubscriptionTier === "freelancer" ? 5 : 10;
      case "boards":
        return currentSubscriptionTier === "free" ? 1 : 
               currentSubscriptionTier === "freelancer" ? 1 : 20;
      case "tasks":
        return currentSubscriptionTier === "free" ? 10 : 
               currentSubscriptionTier === "freelancer" ? 100 : 1000;
      default:
        return "mehrere";
    }
  };

  const descriptionId = "limit-warning-description";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent aria-describedby={descriptionId}>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription id={descriptionId}>
            {isLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Limit-Informationen werden geladen...</span>
              </div>
            ) : (limitInfo?.hasReachedLimit || limitInfo?.limitReached) ? (
              <>
                <p className="mb-2">
                  {getMaxAllowedText()} Ihr aktuelles Paket ist: <strong>{tierDisplayName}</strong>.
                </p>
                <p>
                  Für mehr {resourceNamePlural} können Sie auf ein höheres Paket upgraden.
                </p>
              </>
            ) : (
              <p>
                Sie können weitere {resourceNamePlural} erstellen.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Schließen</AlertDialogCancel>
          {(limitInfo?.hasReachedLimit || limitInfo?.limitReached) && (
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