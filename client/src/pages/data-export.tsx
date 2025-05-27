import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Download, FileText, Database, Info, Shield, Clock } from "lucide-react";

interface ExportInfo {
  availableExports: {
    personal: boolean;
    company: boolean;
  };
  supportedFormats: string[];
  user: {
    id: number;
    username: string;
    email: string;
    hasCompany: boolean;
    isCompanyAdmin: boolean;
  };
  gdprCompliant: boolean;
  lastExportDate: string | null;
}

export default function DataExportPage() {
  const [exportFormat, setExportFormat] = useState<string>("json");
  const [exportType, setExportType] = useState<"personal" | "company">("personal");
  const { toast } = useToast();

  // Lade Export-Informationen
  const { data: exportInfo, isLoading } = useQuery<ExportInfo>({
    queryKey: ["/api/data-export/info"],
  });

  // Download-Mutation
  const downloadMutation = useMutation({
    mutationFn: async ({ type, format }: { type: "personal" | "company"; format: string }) => {
      const response = await fetch(`/api/data-export/${type}?format=${format}`, {
        method: "GET",
        credentials: "include",
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Export fehlgeschlagen");
      }
      
      return response;
    },
    onSuccess: async (response) => {
      // Erstelle Download-Link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const contentDisposition = response.headers.get("content-disposition");
      const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || 
                      `data-export-${exportType}-${Date.now()}.${exportFormat}`;
      
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Export erfolgreich",
        description: `Ihre ${exportType === "personal" ? "persönlichen" : "Firmen-"}Daten wurden heruntergeladen.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Export fehlgeschlagen",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDownload = () => {
    downloadMutation.mutate({ type: exportType, format: exportFormat });
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!exportInfo) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Fehler beim Laden der Export-Informationen.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Datenexport</h1>
        <p className="text-muted-foreground">
          Exportieren Sie Ihre Daten gemäß DSGVO-Vorschriften für Datenportabilität
        </p>
      </div>

      {/* DSGVO-Hinweis */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>DSGVO-konformer Export:</strong> Sie haben das Recht auf Datenportabilität gemäß Art. 20 DSGVO. 
          Dieser Export enthält alle Ihre personenbezogenen Daten in strukturierter, gängiger und maschinenlesbarer Form.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Export-Konfiguration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export-Konfiguration
            </CardTitle>
            <CardDescription>
              Wählen Sie den Exporttyp und das gewünschte Format
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Export-Typ */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Export-Typ</label>
              <Select value={exportType} onValueChange={(value: "personal" | "company") => setExportType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Persönliche Daten
                    </div>
                  </SelectItem>
                  {exportInfo.availableExports.company && (
                    <SelectItem value="company">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Firmendaten
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {exportType === "company" && !exportInfo.availableExports.company && (
                <p className="text-sm text-muted-foreground">
                  Firmendatenexport nur für Administratoren verfügbar
                </p>
              )}
            </div>

            {/* Format */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Format</label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {exportInfo.supportedFormats.map((format) => (
                    <SelectItem key={format} value={format}>
                      {format.toUpperCase()}
                      {format === "json" && " (Strukturiert)"}
                      {format === "csv" && " (Tabellenkalkulation)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Download-Button */}
            <Button 
              onClick={handleDownload}
              disabled={downloadMutation.isPending}
              className="w-full"
            >
              {downloadMutation.isPending ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full mr-2" />
                  Export wird vorbereitet...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  {exportType === "personal" ? "Persönliche Daten" : "Firmendaten"} herunterladen
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Export-Informationen */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Export-Informationen
            </CardTitle>
            <CardDescription>
              Details zu verfügbaren Exporten und Ihren Daten
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Benutzerinformationen */}
            <div className="space-y-2">
              <h4 className="font-medium">Benutzerkonto</h4>
              <div className="text-sm space-y-1">
                <p><strong>Benutzername:</strong> {exportInfo.user.username}</p>
                <p><strong>E-Mail:</strong> {exportInfo.user.email}</p>
                <div className="flex gap-2 flex-wrap">
                  {exportInfo.user.hasCompany && (
                    <Badge variant="secondary">Firmenmitglied</Badge>
                  )}
                  {exportInfo.user.isCompanyAdmin && (
                    <Badge variant="default">Firmen-Admin</Badge>
                  )}
                  {exportInfo.gdprCompliant && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      DSGVO-konform
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Verfügbare Exporte */}
            <div className="space-y-2">
              <h4 className="font-medium">Verfügbare Exporte</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Persönliche Daten</span>
                  <Badge variant={exportInfo.availableExports.personal ? "default" : "secondary"}>
                    {exportInfo.availableExports.personal ? "Verfügbar" : "Nicht verfügbar"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Firmendaten</span>
                  <Badge variant={exportInfo.availableExports.company ? "default" : "secondary"}>
                    {exportInfo.availableExports.company ? "Verfügbar" : "Nicht verfügbar"}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            {/* Letzte Export-Information */}
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Letzter Export
              </h4>
              <p className="text-sm text-muted-foreground">
                {exportInfo.lastExportDate
                  ? `Zuletzt exportiert: ${new Date(exportInfo.lastExportDate).toLocaleString('de-DE')}`
                  : "Noch kein Export durchgeführt"
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Informationsbereich */}
      <Card>
        <CardHeader>
          <CardTitle>Was ist in Ihrem Export enthalten?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium mb-2">Persönliche Daten enthalten:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Benutzerprofil und Einstellungen</li>
                <li>• Erstellte und zugewiesene Aufgaben</li>
                <li>• Projekte und Boards mit Zugriff</li>
                <li>• Kommentare und Aktivitätsverlauf</li>
                <li>• Team-Mitgliedschaften</li>
                <li>• OKR-Daten (Objectives & Key Results)</li>
                <li>• Firmeninformationen (falls zutreffend)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Format-Details:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• <strong>JSON:</strong> Strukturierte, maschinenlesbare Daten</li>
                <li>• <strong>CSV:</strong> Tabellenformat für Spreadsheet-Programme</li>
                <li>• Alle Formate sind vollständig DSGVO-konform</li>
                <li>• Daten können in andere Systeme importiert werden</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}