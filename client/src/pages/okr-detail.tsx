import { useParams, useLocation, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type Objective, type KeyResult, type User } from "@shared/schema";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { GlassCard } from "@/components/ui/glass-card";
import { Progress } from "@/components/ui/progress";
import { CircularProgressIndicator } from "@/components/ui/circular-progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  PlusCircle, 
  UserCircle, 
  Calendar, 
  Target, 
  Edit, 
  CheckCircle2, 
  Star, 
  ChevronDown, 
  ChevronRight,
  ChevronLeft,
  Users,
  Clipboard,
  Archive,
  RotateCcw,
  FileClock,
  FileText
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useState } from "react";
import { KeyResultForm } from "@/components/okr/key-result-form";
import { ObjectiveEditForm } from "@/components/okr/objective-edit-form";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-store";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { ProtocolList } from "@/components/protocol/protocol-list";

interface ActivityLog {
  id: number;
  action: string;
  details: string | null;
  userId: number | null;
  boardId: number | null;
  projectId: number | null;
  objectiveId: number | null;
  taskId: number | null;
  teamId: number | null;
  targetUserId: number | null;
  createdAt: string | Date;
  created_at?: string;
  username?: string;
  avatar_url?: string;
  key_result_title?: string;
  board_title?: string;
  project_title?: string;
  objective_title?: string;
  task_title?: string;
  team_title?: string;
}

interface ChecklistItem {
  title: string;
  completed: boolean;
}

// Hilfsfunktion zum sicheren Konvertieren von Datumswerten
const formatSafeDate = (dateValue: string | Date | undefined, formatOptions: Intl.DateTimeFormatOptions): string => {
  const date = dateValue ? new Date(dateValue) : new Date();
  return date.toLocaleString('de-DE', formatOptions);
};

export function OKRDetailPage() {
  const { id } = useParams<{ id: string }>();
  const objectiveId = parseInt(id);
  const [isKeyResultDialogOpen, setIsKeyResultDialogOpen] = useState(false);
  const [editingKR, setEditingKR] = useState<KeyResult | null>(null);
  const [editingProgress, setEditingProgress] = useState<{[key: number]: number}>({});
  const [isEditingObjective, setIsEditingObjective] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showUnarchiveDialog, setShowUnarchiveDialog] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data: objective, isLoading: isLoadingObjective, error } = useQuery<Objective>({
    queryKey: ["/api/objectives", objectiveId],
    queryFn: async () => {
      try {
        console.log(`Requesting objective with ID: ${objectiveId}`);
        const response = await fetch(`/api/objectives/${objectiveId}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error fetching objective ${objectiveId}:`, response.status, errorText);
          throw new Error(`Fehler beim Laden des Objectives: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`Successfully loaded objective:`, data);
        return data;
      } catch (err) {
        console.error("Error in objective fetch:", err);
        throw err;
      }
    },
    enabled: !!objectiveId && !isNaN(objectiveId),
  });

  const { data: keyResults = [], isLoading: isLoadingKeyResults } = useQuery<KeyResult[]>({
    queryKey: ["/api/objectives", objectiveId, "key-results"],
    queryFn: async () => {
      const response = await fetch(`/api/objectives/${objectiveId}/key-results`);
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Key Results");
      }
      return response.json();
    },
    enabled: !!objectiveId && !isNaN(objectiveId),
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Benutzer");
      }
      return response.json();
    },
  });
  
  const { data: activityLogs = [], isLoading: isLoadingActivities } = useQuery({
    queryKey: ["/api/activity-logs", { objectiveId }],
    queryFn: async () => {
      const response = await fetch(`/api/activity-logs?objectiveId=${objectiveId}`);
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Aktivitäten");
      }
      return response.json();
    },
    enabled: !!objectiveId && !isNaN(objectiveId),
  });

  const handleUpdateKeyResult = async (data: Partial<KeyResult> & { id: number }) => {
    try {
      await apiRequest<KeyResult>(
        "PATCH",
        `/api/key-results/${data.id}`,
        data
      );
      
      await queryClient.invalidateQueries({
        queryKey: ["/api/objectives", objectiveId, "key-results"],
      });
      toast({ title: "Key Result erfolgreich aktualisiert" });
      setEditingKR(null);
    } catch (error) {
      toast({
        title: "Fehler beim Aktualisieren",
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
        variant: "destructive",
      });
    }
  };

  const handleProgressUpdate = async (kr: KeyResult, value: number | boolean) => {
    let updateData: Partial<KeyResult> & { id: number } = {
      id: kr.id,
    };

    if (kr.type === "checkbox") {
      updateData.currentValue = value ? 100 : 0;
    } else if (kr.type === "checklist" && kr.checklistItems) {
      const items = kr.checklistItems.map(item => 
        typeof item === 'string' ? JSON.parse(item) as ChecklistItem : item
      );
      const completedItems = items.filter(item => item.completed).length;
      const totalItems = items.length;
      updateData.currentValue = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
    } else {
      const numValue = typeof value === "number" ? value : 0;
      updateData.currentValue = Math.min(Math.max(numValue, 0), 100);
    }

    await handleUpdateKeyResult(updateData);
  };

  const handleProgressInputChange = (krId: number, value: string) => {
    const numValue = Math.min(Math.max(parseInt(value) || 0, 0), 100);
    setEditingProgress(prev => ({ ...prev, [krId]: numValue }));
  };

  const handleProgressInputBlur = async (kr: KeyResult) => {
    const value = editingProgress[kr.id];
    if (value !== undefined && value !== kr.currentValue) {
      await handleProgressUpdate(kr, value);
    }
    setEditingProgress(prev => {
      const newState = { ...prev };
      delete newState[kr.id];
      return newState;
    });
  };

  const handleChecklistItemUpdate = async (kr: KeyResult, itemIndex: number, completed: boolean) => {
    if (!kr.checklistItems) return;

    const items = kr.checklistItems.map(item => 
      typeof item === 'string' ? JSON.parse(item) as ChecklistItem : item
    );

    const updatedItems = [...items];
    updatedItems[itemIndex] = { ...updatedItems[itemIndex], completed };

    await handleUpdateKeyResult({
      id: kr.id,
      checklistItems: updatedItems.map(item => JSON.stringify(item)),
      currentValue: (updatedItems.filter(item => item.completed).length / updatedItems.length) * 100,
    });
  };

  const toggleRow = (krId: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(krId)) {
        newSet.delete(krId);
      } else {
        newSet.add(krId);
      }
      return newSet;
    });
  };

  const handleToggleFavorite = async () => {
    try {
      await apiRequest('PATCH', `/api/objectives/${objectiveId}/favorite`);
      
      // Aktualisiere sowohl die Detailansicht als auch die Listenansicht
      await queryClient.invalidateQueries({ queryKey: ["/api/objectives", objectiveId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/objectives"] });
      
      toast({
        title: "Favoriten-Status aktualisiert",
        description: "Der Favoriten-Status des Objectives wurde aktualisiert.",
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description: `Fehler beim Aktualisieren des Favoriten-Status: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        variant: "destructive"
      });
    }
  };
  
  const handleArchive = () => {
    setShowArchiveDialog(true);
  };
  
  const confirmArchive = async () => {
    try {
      await apiRequest("PATCH", `/api/objectives/${objectiveId}`, {
        status: "archived"
      });

      // Aktualisiere sowohl die Detailansicht als auch die Listenansicht
      await queryClient.invalidateQueries({ queryKey: ["/api/objectives", objectiveId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/objectives"] });
      
      toast({
        title: "Objective archiviert",
        description: "Das Objective wurde erfolgreich archiviert.",
      });
      
      setShowArchiveDialog(false);
    } catch (error) {
      console.error("Error archiving objective:", error);
      toast({
        title: "Fehler beim Archivieren",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    }
  };
  
  const handleUnarchive = () => {
    setShowUnarchiveDialog(true);
  };
  
  const confirmUnarchive = async () => {
    try {
      await apiRequest("PATCH", `/api/objectives/${objectiveId}`, {
        status: "active"
      });

      // Aktualisiere sowohl die Detailansicht als auch die Listenansicht
      await queryClient.invalidateQueries({ queryKey: ["/api/objectives", objectiveId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/objectives"] });
      
      toast({
        title: "Objective wiederhergestellt",
        description: "Das Objective wurde erfolgreich wiederhergestellt.",
      });
      
      setShowUnarchiveDialog(false);
    } catch (error) {
      console.error("Error unarchiving objective:", error);
      toast({
        title: "Fehler beim Wiederherstellen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    }
  };

  if (isLoadingObjective || isLoadingKeyResults) {
    return <div className="text-center py-8">Lade OKR Details...</div>;
  }

  if (error) {
    return <div className="text-center py-8">Fehler: {error.message}</div>;
  }

  if (!objective) {
    return <div className="text-center py-8">Objective nicht gefunden.</div>;
  }

  const assignedUsers = objective.userIds
    ? users.filter(u => objective.userIds?.includes(u.id))
    : objective.userId 
    ? [users.find(u => u.id === objective.userId)] 
    : [];

  const progress = keyResults.length > 0
    ? Math.round(keyResults.reduce((sum, kr) => sum + (kr.currentValue || 0), 0) / keyResults.length)
    : 0;

  // Ersteller-Information wird momentan noch nicht bei OKRs gespeichert
  const isCreator = user?.isCompanyAdmin;

  const getObjectiveCreatorName = () => {
    return user?.username || "Unbekannt";
  };

  return (
    <div className="container py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/all-okrs")}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Zurück
          </Button>
          <h1 className="text-2xl font-bold">{objective.title}</h1>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleToggleFavorite}
            className="hover:bg-yellow-100"
          >
            <Star 
              className={`h-4 w-4 ${objective.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400 hover:text-yellow-400"}`}
            />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsEditingObjective(true)}>
            <Edit className="h-4 w-4" />
          </Button>
          
          {objective.status !== "archived" ? (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => handleArchive()}
              title="Archivieren"
            >
              <Archive className="h-4 w-4 text-gray-500" />
            </Button>
          ) : (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => handleUnarchive()}
              title="Wiederherstellen"
            >
              <RotateCcw className="h-4 w-4 text-blue-500" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="activity">Aktivitäten</TabsTrigger>
              <TabsTrigger value="protocols">Protokolle</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="space-y-6">
              <GlassCard className="p-6">
                <div className="flex justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">OKR-Details</h2>
                    <p className="text-muted-foreground mt-2">{objective.description || "Keine Beschreibung vorhanden"}</p>
                  </div>
                </div>
                
                <Separator className="my-4" />
                
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="flex items-center">
                    <Users className="h-3 w-3 mr-1" />
                    {assignedUsers.filter(Boolean).length} Verantwortliche
                  </Badge>
                  <Badge variant="secondary" className="flex items-center">
                    <Clipboard className="h-3 w-3 mr-1" />
                    {keyResults.length} Key Results
                  </Badge>
                  <Badge variant="secondary" className="flex items-center">
                    <Target className="h-3 w-3 mr-1" />
                    {progress}% Fortschritt
                  </Badge>
                  {objective.status === "archived" && (
                    <Badge variant="outline" className="bg-gray-100 text-gray-500">
                      Archiviert
                    </Badge>
                  )}
                  {objective.status === "completed" && (
                    <Badge variant="outline" className="bg-green-100 text-green-500">
                      Abgeschlossen
                    </Badge>
                  )}
                </div>
                
                <div className="mt-4 space-y-2">
                  <div className="flex items-center">
                    <span className="text-sm font-medium">Gesamtfortschritt</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="h-3 flex-1 rounded-full overflow-hidden relative">
                      {/* Schraffur-Hintergrund mit engeren diagonalen Linien */}
                      <div className="absolute inset-0 bg-white">
                        <svg 
                          width="100%" 
                          height="100%" 
                          xmlns="http://www.w3.org/2000/svg" 
                          className="overflow-visible"
                        >
                          <defs>
                            <pattern 
                              id="diagonalHatchDetail" 
                              width="4" 
                              height="4" 
                              patternUnits="userSpaceOnUse" 
                              patternTransform="rotate(45)"
                            >
                              <line 
                                x1="0" 
                                y1="0" 
                                x2="0" 
                                y2="4" 
                                stroke="#888" 
                                strokeWidth="1.5" 
                                strokeOpacity="0.65"
                              />
                            </pattern>
                          </defs>
                          <rect width="100%" height="100%" fill="url(#diagonalHatchDetail)" />
                        </svg>
                      </div>
                      
                      {/* Fortschrittsbalken */}
                      <div 
                        role="progressbar" 
                        className={cn(
                          "h-full rounded-full transition-all relative z-10",
                          progress === 100 ? 
                            "bg-green-500" : 
                            "bg-gradient-to-r from-blue-400 to-blue-600"
                        )}
                        style={{ width: `${progress || 0}%` }}
                      />
                    </div>
                    <span className="font-medium text-sm min-w-[40px] text-right">
                      {progress || 0}%
                    </span>
                  </div>
                </div>
              </GlassCard>

            </TabsContent>
            
            <TabsContent value="activity" className="space-y-4">
              <div className="bg-card rounded-lg border">
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center">
                      <FileClock className="h-5 w-5 mr-2 text-muted-foreground" />
                      Aktivitätsprotokoll
                    </h3>
                  </div>
                </div>
                <div className="p-0">
                  <ActivityFeed 
                    objectiveId={objectiveId} 
                    title={`Aktivitäten für Objective "${objective.title}"`} 
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="protocols" className="space-y-4">
              <div className="bg-card rounded-lg border">
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center">
                      <FileText className="h-5 w-5 mr-2 text-muted-foreground" />
                      Sitzungsprotokolle
                    </h3>
                  </div>
                </div>
                <div className="p-0">
                  <ProtocolList
                    objectiveId={objectiveId}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h4 className="text-lg font-semibold">Key Results ({keyResults.length})</h4>
              <Button 
                onClick={() => setIsKeyResultDialogOpen(true)}
                className="bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-md transition-all duration-300 hover:shadow-lg"
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Key Result hinzufügen
              </Button>
            </div>
            
            <KeyResultForm
              objectiveId={objectiveId}
              onSuccess={() => setIsKeyResultDialogOpen(false)}
              open={isKeyResultDialogOpen}
              onOpenChange={setIsKeyResultDialogOpen}
            />
                
                {keyResults.length > 0 ? (
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]"></TableHead>
                          <TableHead>Titel</TableHead>
                          <TableHead>Beschreibung</TableHead>
                          <TableHead className="w-[100px]">Fortschritt</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {keyResults.map((kr) => {
                          const krProgress = kr.currentValue || 0;
                          const isExpanded = expandedRows.has(kr.id);

                          // Wir verwenden zwei separate Array-Elemente: die Hauptzeile und (wenn erweitert) die Details-Zeile
                          return [
                            // Hauptzeile - immer sichtbar
                            <TableRow key={`kr-main-${kr.id}`} className="cursor-pointer hover:bg-muted/50">
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => toggleRow(kr.id)}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              </TableCell>
                              <TableCell className="font-medium" onClick={() => toggleRow(kr.id)}>
                                <div className="flex items-center gap-2">
                                  {kr.title}
                                  {krProgress === 100 && (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell onClick={() => toggleRow(kr.id)}>
                                {kr.description && kr.description.length > 80 
                                  ? `${kr.description.substring(0, 80)}...` 
                                  : kr.description}
                              </TableCell>
                              <TableCell onClick={() => toggleRow(kr.id)}>
                                <div className="flex items-center gap-3 justify-between">
                                  <CircularProgressIndicator 
                                    value={krProgress} 
                                    size="sm" 
                                    label={`${krProgress}%`}
                                    useStripedBackground={true}
                                  />
                                </div>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingKR(kr);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>,
                            
                            // Erweiterte Zeile - nur wenn erweitert
                            isExpanded ? (
                              <TableRow key={`kr-expanded-${kr.id}`} className="bg-muted/30">
                                <TableCell colSpan={5} className="p-4">
                                  <div className="space-y-4">
                                    {kr.description && (
                                      <div className="mb-4">
                                        <h4 className="font-medium text-sm text-muted-foreground mb-1">Beschreibung:</h4>
                                        <p className="text-sm">{kr.description}</p>
                                      </div>
                                    )}
                                    {kr.type === "percentage" && (
                                      <div className="flex items-center gap-4">
                                        <span className="text-sm font-medium">Prozent:</span>
                                        <Input
                                          type="number"
                                          min="0"
                                          max="100"
                                          value={editingProgress[kr.id] ?? kr.currentValue ?? 0}
                                          onChange={(e) => handleProgressInputChange(kr.id, e.target.value)}
                                          onBlur={() => handleProgressInputBlur(kr)}
                                          className="w-24"
                                        />
                                      </div>
                                    )}

                                    {kr.type === "checkbox" && (
                                      <div className="flex items-center gap-4">
                                        <Checkbox
                                          checked={kr.currentValue === 100}
                                          onCheckedChange={(checked) => handleProgressUpdate(kr, checked === true)}
                                        />
                                        <span className="text-sm">Abgeschlossen</span>
                                      </div>
                                    )}

                                    {kr.type === "checklist" && kr.checklistItems && (
                                      <div className="space-y-2">
                                        {kr.checklistItems.map((item, index) => {
                                          const checklistItem = typeof item === 'string' 
                                            ? JSON.parse(item) as ChecklistItem 
                                            : item;

                                          return (
                                            <div key={index} className="flex items-center gap-4">
                                              <Checkbox
                                                checked={checklistItem.completed}
                                                onCheckedChange={(checked) => 
                                                  handleChecklistItemUpdate(kr, index, checked === true)
                                                }
                                              />
                                              <span className="text-sm">{checklistItem.title}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null
                      ];
                    })}
                  </TableBody>
                </Table>
              </Card>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Keine Key Results für dieses Objective.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-3">Details</h3>
            <div className="bg-card rounded-lg border p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <div className="font-medium">{objective.status || "Nicht gesetzt"}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Zyklus</div>
                  <div className="font-medium">
                    {objective.cycleId ? (objective.cycle?.title || "Zyklus " + objective.cycleId) : "Kein Zyklus"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Erstellt am</div>
                  <div className="font-medium">
                    {format(new Date(objective.createdAt), "dd.MM.yyyy", { locale: de })}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Fortschritt</div>
                  <div className="font-medium">{progress}%</div>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-3">Verantwortliche</h3>
            <div className="bg-card rounded-lg border p-4 space-y-3">
              {assignedUsers.filter(Boolean).map((user) => user && (
                <div key={user.id} className="flex items-center space-x-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatarUrl || ""} />
                    <AvatarFallback>{user.username?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-grow">
                    <div className="text-sm font-medium">{user.username}</div>
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                  </div>
                </div>
              ))}
              
              {assignedUsers.filter(Boolean).length === 0 && (
                <div className="text-sm text-muted-foreground">Keine Verantwortlichen zugewiesen</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {editingKR && (
        <KeyResultForm
          objectiveId={objectiveId}
          keyResult={editingKR}
          onSuccess={() => setEditingKR(null)}
          open={!!editingKR}
          onOpenChange={(open) => !open && setEditingKR(null)}
        />
      )}

      <Dialog open={isEditingObjective} onOpenChange={setIsEditingObjective}>
        <DialogContent className="sm:max-w-[600px] p-0">
          <div className="p-6 pb-0">
            <DialogHeader>
              <DialogTitle>Objective bearbeiten</DialogTitle>
            </DialogHeader>
          </div>
          
          <div className="overflow-y-auto px-6 pb-0 pt-2" style={{ maxHeight: "calc(85vh - 160px)" }}>
            <ObjectiveEditForm
              objective={objective}
              onSuccess={() => setIsEditingObjective(false)}
            />
          </div>
          
          <div className="p-6 border-t flex flex-row justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsEditingObjective(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              form="objective-edit-form"
              className="bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-md transition-all duration-300 hover:shadow-lg"
            >
              Objective aktualisieren
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Archive Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Objective archivieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie das Objective "{objective.title}" wirklich archivieren? 
              Es wird aus der Liste der aktiven Objectives entfernt, kann aber später wiederhergestellt werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive} className="bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-md transition-all duration-300 hover:shadow-lg">Archivieren</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unarchive Dialog */}
      <AlertDialog open={showUnarchiveDialog} onOpenChange={setShowUnarchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Objective wiederherstellen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie das Objective "{objective.title}" wirklich wiederherstellen? 
              Es wird wieder in der Liste der aktiven Objectives angezeigt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnarchive} className="bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-md transition-all duration-300 hover:shadow-lg">Wiederherstellen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default OKRDetailPage;