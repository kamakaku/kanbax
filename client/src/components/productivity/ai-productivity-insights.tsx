import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, XCircle, TrendingUp, Zap, Heart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/auth-store";
import { askSecretsHelper } from "@/lib/utils";

interface AIProductivityInsight {
  summary: string;
  positiveAspects: string[];
  improvementAreas: string[];
  recommendations: string[];
  motivationalMessage: string;
}

interface AIServiceStatus {
  available: boolean;
  needsApiKey: boolean;
}

export function AIProductivityInsights() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("zusammenfassung");
  const { user } = useAuthStore();
  const userId = user?.id;

  // Abfrage des API-Status, um zu prüfen, ob der OpenAI-Schlüssel konfiguriert ist
  const { 
    data: serviceStatus,
    isLoading: isStatusLoading,
    refetch: refetchStatus
  } = useQuery<AIServiceStatus>({
    queryKey: ['/api/ai/status'],
    enabled: !!userId,
  });

  // Bedingte Abfrage der KI-Einblicke
  const {
    data: insights,
    isLoading: isInsightsLoading,
    error: insightsError,
    refetch: refetchInsights
  } = useQuery<AIProductivityInsight>({
    queryKey: ['/api/ai/productivity-insights', userId],
    enabled: !!userId && serviceStatus?.available === true,
  });

  // Neu laden der Daten, wenn der Status sich ändert
  useEffect(() => {
    if (serviceStatus?.available) {
      refetchInsights();
    }
  }, [serviceStatus?.available, refetchInsights]);

  // Hilfsmethode für die Anforderung eines API-Schlüssels
  const requestApiKey = async () => {
    await askSecretsHelper(["OPENAI_API_KEY"], 
      "Um KI-gestützte Produktivitätseinblicke zu generieren, benötigen wir einen OpenAI API-Schlüssel. " +
      "Dieser Schlüssel ermöglicht es uns, Ihre Produktivitätsdaten zu analysieren und personalisierte Empfehlungen zu erstellen. " +
      "Bitte geben Sie Ihren OpenAI API-Schlüssel ein."
    );
    
    // Nach dem Hinzufügen des Schlüssels den Status neu laden
    setTimeout(() => {
      refetchStatus();
    }, 1000);
  };

  // Rendert eine Fehlermeldung, wenn der API-Schlüssel fehlt
  if (!isStatusLoading && serviceStatus?.needsApiKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>KI-gestützte Produktivitätseinblicke</CardTitle>
          <CardDescription>
            Erhalten Sie personalisierte Einblicke in Ihre Produktivitätsmuster und Empfehlungen zur Verbesserung.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>OpenAI API-Schlüssel erforderlich</AlertTitle>
            <AlertDescription>
              Für diese Funktion ist ein OpenAI API-Schlüssel erforderlich. Bitte fügen Sie einen API-Schlüssel hinzu, 
              um personalisierte Produktivitätseinblicke zu erhalten.
            </AlertDescription>
          </Alert>
          <Button onClick={requestApiKey}>API-Schlüssel hinzufügen</Button>
        </CardContent>
      </Card>
    );
  }

  // Rendert einen Lade-Zustand während der Abfrage
  if (isStatusLoading || isInsightsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>KI-gestützte Produktivitätseinblicke</CardTitle>
          <CardDescription>
            Erhalten Sie personalisierte Einblicke in Ihre Produktivitätsmuster und Empfehlungen zur Verbesserung.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[90%]" />
            <Skeleton className="h-4 w-[80%]" />
            <Skeleton className="h-4 w-[85%]" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Rendert eine Fehlermeldung bei Problemen mit der API
  if (insightsError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>KI-gestützte Produktivitätseinblicke</CardTitle>
          <CardDescription>
            Erhalten Sie personalisierte Einblicke in Ihre Produktivitätsmuster und Empfehlungen zur Verbesserung.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Fehler</AlertTitle>
            <AlertDescription>
              Es gab ein Problem beim Abrufen Ihrer KI-Einblicke. Bitte versuchen Sie es später erneut.
            </AlertDescription>
          </Alert>
          <Button onClick={() => refetchInsights()} className="mt-4">
            Erneut versuchen
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Rendert die tatsächlichen Insights
  return (
    <Card className="border-t-4 border-t-primary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          KI-gestützte Produktivitätseinblicke
        </CardTitle>
        <CardDescription>
          Personalisierte Analyse Ihrer Produktivitätsdaten und Tipps zur Leistungssteigerung
        </CardDescription>
      </CardHeader>
      <CardContent>
        {insights ? (
          <Tabs defaultValue="zusammenfassung" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="zusammenfassung">Zusammenfassung</TabsTrigger>
              <TabsTrigger value="staerken">Stärken</TabsTrigger>
              <TabsTrigger value="verbesserungen">Verbesserungen</TabsTrigger>
              <TabsTrigger value="empfehlungen">Empfehlungen</TabsTrigger>
              <TabsTrigger value="motivation">Motivation</TabsTrigger>
            </TabsList>
            
            <TabsContent value="zusammenfassung" className="mt-4">
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="flex items-center gap-2 text-primary mb-2">
                  <TrendingUp className="h-5 w-5" />
                  <h3 className="font-medium">Zusammenfassung der Trends</h3>
                </div>
                <p>{insights.summary}</p>
              </div>
            </TabsContent>
            
            <TabsContent value="staerken" className="mt-4">
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-4">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <h3 className="font-medium">Positive Aspekte</h3>
                </div>
                <ul className="space-y-2 mt-2">
                  {insights.positiveAspects.map((aspect, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                      <span>{aspect}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>
            
            <TabsContent value="verbesserungen" className="mt-4">
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-4">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                  <AlertCircle className="h-5 w-5" />
                  <h3 className="font-medium">Verbesserungspotenzial</h3>
                </div>
                <ul className="space-y-2 mt-2">
                  {insights.improvementAreas.map((area, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500 mt-1 flex-shrink-0" />
                      <span>{area}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>
            
            <TabsContent value="empfehlungen" className="mt-4">
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                  <Zap className="h-5 w-5" />
                  <h3 className="font-medium">Empfehlungen für die nächste Woche</h3>
                </div>
                <ul className="space-y-2 mt-2">
                  {insights.recommendations.map((recommendation, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Zap className="h-4 w-4 text-blue-500 mt-1 flex-shrink-0" />
                      <span>{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>
            
            <TabsContent value="motivation" className="mt-4">
              <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 p-4">
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-2">
                  <Heart className="h-5 w-5" />
                  <h3 className="font-medium">Ihre persönliche Motivation</h3>
                </div>
                <p className="mt-2 italic text-center py-4">{insights.motivationalMessage}</p>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-4">
            <p>Keine Produktivitätsdaten verfügbar.</p>
          </div>
        )}
        
        <Separator className="my-4" />
        
        <div className="text-sm text-muted-foreground">
          <p>
            Diese Einblicke werden automatisch anhand Ihrer Produktivitätsdaten der letzten 30 Tage generiert.
            Die KI berücksichtigt Ihre erledigten Aufgaben, Projektzuordnungen und Arbeitszeiten.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}