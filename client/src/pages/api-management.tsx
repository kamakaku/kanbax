import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, Copy, Key, ExternalLink, Code, Book } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface APIKey {
  id: string;
  name: string;
  key?: string;
  permissions: string[];
  createdAt: string;
  lastUsed?: string;
  isActive: boolean;
}

export default function APIManagement() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(["read"]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const { toast } = useToast();

  const permissionOptions = [
    { value: "read", label: "Lesen", description: "Zugriff auf Daten lesen" },
    { value: "write", label: "Schreiben", description: "Daten erstellen und aktualisieren" },
    { value: "delete", label: "Löschen", description: "Daten löschen" },
    { value: "*", label: "Vollzugriff", description: "Alle Operationen (Admin)" }
  ];

  useEffect(() => {
    fetchAPIKeys();
  }, []);

  const fetchAPIKeys = async () => {
    try {
      const response = await apiRequest("GET", "/api/keys");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setApiKeys(data);
    } catch (error) {
      console.error("Error fetching API keys:", error);
      toast({
        title: "Fehler",
        description: "API-Schlüssel konnten nicht geladen werden",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createAPIKey = async () => {
    if (!newKeyName.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Namen für den API-Schlüssel ein",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await apiRequest("POST", "/api/keys", {
        name: newKeyName,
        permissions: newKeyPermissions
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      setNewlyCreatedKey(data.key);
      setNewKeyName("");
      setNewKeyPermissions(["read"]);
      setIsCreateDialogOpen(false);
      
      await fetchAPIKeys();
      
      toast({
        title: "Erfolg",
        description: "API-Schlüssel wurde erfolgreich erstellt",
      });
    } catch (error) {
      console.error("Error creating API key:", error);
      toast({
        title: "Fehler",
        description: "API-Schlüssel konnte nicht erstellt werden",
        variant: "destructive",
      });
    }
  };

  const deleteAPIKey = async (keyId: string, keyName: string) => {
    if (!confirm(`Möchten Sie den API-Schlüssel "${keyName}" wirklich löschen?`)) {
      return;
    }

    try {
      await apiRequest("DELETE", `/api/keys/${keyId}`);
      await fetchAPIKeys();
      
      toast({
        title: "Erfolg",
        description: "API-Schlüssel wurde erfolgreich gelöscht",
      });
    } catch (error) {
      console.error("Error deleting API key:", error);
      toast({
        title: "Fehler",
        description: "API-Schlüssel konnte nicht gelöscht werden",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Kopiert",
      description: "API-Schlüssel wurde in die Zwischenablage kopiert",
    });
  };

  const handlePermissionChange = (permission: string, checked: boolean) => {
    if (checked) {
      setNewKeyPermissions([...newKeyPermissions, permission]);
    } else {
      setNewKeyPermissions(newKeyPermissions.filter(p => p !== permission));
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-12 px-4">
        <div className="flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">REST API Verwaltung</h1>
            <p className="text-muted-foreground">
              Verwalten Sie API-Schlüssel für Drittanbieter-Integrationen
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a href="/api/v1/docs" target="_blank" rel="noopener noreferrer">
                <Book className="mr-2 h-4 w-4" />
                API Dokumentation
              </a>
            </Button>
            
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Neuer API-Schlüssel
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Neuen API-Schlüssel erstellen</DialogTitle>
                  <DialogDescription>
                    Erstellen Sie einen neuen API-Schlüssel für externe Anwendungen
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="keyName">Name</Label>
                    <Input
                      id="keyName"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="z.B. Mobile App, Dashboard Integration"
                    />
                  </div>
                  
                  <div>
                    <Label>Berechtigungen</Label>
                    <div className="space-y-2 mt-2">
                      {permissionOptions.map((permission) => (
                        <div key={permission.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={permission.value}
                            checked={newKeyPermissions.includes(permission.value)}
                            onCheckedChange={(checked) => 
                              handlePermissionChange(permission.value, checked as boolean)
                            }
                          />
                          <div>
                            <Label htmlFor={permission.value} className="font-medium">
                              {permission.label}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              {permission.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Abbrechen
                    </Button>
                    <Button onClick={createAPIKey}>
                      Erstellen
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Newly Created Key Display */}
        {newlyCreatedKey && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-green-800 flex items-center">
                <Key className="mr-2 h-5 w-5" />
                Neuer API-Schlüssel erstellt
              </CardTitle>
              <CardDescription className="text-green-700">
                Kopieren Sie diesen Schlüssel jetzt - er wird nicht erneut angezeigt!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 p-3 bg-white rounded border">
                <code className="flex-1 font-mono text-sm">{newlyCreatedKey}</code>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => copyToClipboard(newlyCreatedKey)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => setNewlyCreatedKey(null)}
              >
                Verstanden, Schlüssel kopiert
              </Button>
            </CardContent>
          </Card>
        )}

        {/* API Keys List */}
        <div className="grid gap-4">
          {apiKeys.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Key className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Keine API-Schlüssel</h3>
                <p className="text-muted-foreground mb-4">
                  Sie haben noch keine API-Schlüssel erstellt. Erstellen Sie einen, um externe Integrationen zu ermöglichen.
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Ersten API-Schlüssel erstellen
                </Button>
              </CardContent>
            </Card>
          ) : (
            apiKeys.map((key) => (
              <Card key={key.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center">
                        <Key className="mr-2 h-5 w-5" />
                        {key.name}
                      </CardTitle>
                      <CardDescription>
                        Erstellt am {new Date(key.createdAt).toLocaleDateString("de-DE")}
                        {key.lastUsed && (
                          <span className="ml-4">
                            Zuletzt verwendet: {new Date(key.lastUsed).toLocaleDateString("de-DE")}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant={key.isActive ? "default" : "secondary"}>
                        {key.isActive ? "Aktiv" : "Inaktiv"}
                      </Badge>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteAPIKey(key.id, key.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium">Berechtigungen</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {key.permissions.map((permission) => (
                          <Badge key={permission} variant="outline" className="text-xs">
                            {permissionOptions.find(p => p.value === permission)?.label || permission}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Schlüssel-ID</Label>
                      <p className="text-sm font-mono text-muted-foreground mt-1">
                        {key.id}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* API Documentation Preview */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Code className="mr-2 h-5 w-5" />
              Schnellstart
            </CardTitle>
            <CardDescription>
              Erste Schritte mit der REST API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="font-medium">Base URL</Label>
              <code className="block p-2 bg-muted rounded mt-1 text-sm">
                {window.location.origin}/api/v1
              </code>
            </div>
            
            <div>
              <Label className="font-medium">Authentifizierung</Label>
              <code className="block p-2 bg-muted rounded mt-1 text-sm">
                Authorization: Bearer IHR_API_SCHLÜSSEL
              </code>
            </div>
            
            <div>
              <Label className="font-medium">Beispiel-Request</Label>
              <pre className="p-3 bg-muted rounded mt-1 text-sm overflow-x-auto">
{`curl -H "Authorization: Bearer IHR_API_SCHLÜSSEL" \\
     ${window.location.origin}/api/v1/user`}
              </pre>
            </div>
            
            <Button variant="outline" asChild className="w-full">
              <a href="/api/v1/docs" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Vollständige API-Dokumentation anzeigen
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}