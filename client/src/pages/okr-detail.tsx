import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Objective, type KeyResult, type User } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlusCircle, UserCircle, Calendar, Target, Edit, CheckCircle2, Star, ChevronDown, ChevronRight } from "lucide-react";
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

interface ChecklistItem {
  title: string;
  completed: boolean;
}

export function OKRDetailPage() {
  const { id } = useParams<{ id: string }>();
  const objectiveId = parseInt(id);
  const [isKeyResultDialogOpen, setIsKeyResultDialogOpen] = useState(false);
  const [editingKR, setEditingKR] = useState<KeyResult | null>(null);
  const [editingProgress, setEditingProgress] = useState<{[key: number]: number}>({});
  const [isEditingObjective, setIsEditingObjective] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: objective, isLoading: isLoadingObjective, error } = useQuery<Objective>({
    queryKey: ["/api/objectives", objectiveId],
    queryFn: async () => {
      const response = await fetch(`/api/objectives/${objectiveId}`);
      if (!response.ok) {
        throw new Error("Fehler beim Laden des Objectives");
      }
      return response.json();
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

  const updateKeyResult = useMutation({
    mutationFn: async (data: Partial<KeyResult> & { id: number }) => {
      return await apiRequest<KeyResult>(
        "PATCH",
        `/api/key-results/${data.id}`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/objectives", objectiveId, "key-results"],
      });
      toast({ title: "Key Result erfolgreich aktualisiert" });
      setEditingKR(null);
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Aktualisieren",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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

    await updateKeyResult.mutateAsync(updateData);
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

    await updateKeyResult.mutateAsync({
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

  const toggleFavorite = useMutation({
    mutationFn: async () => {
      return await apiRequest('PATCH', `/api/objectives/${objectiveId}/favorite`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/objectives"] });
    },
  });

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

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex justify-center">
        <Card className={cn(
          "w-2/3 p-6 relative",
          progress === 100 && "bg-green-50"
        )}>
          <div className="absolute -left-3 top-1/2 w-1 h-24 bg-primary -translate-y-1/2" />
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-semibold">{objective.title}</h3>
                  {progress === 100 && (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                </div>
                <p className="text-muted-foreground">{objective.description}</p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex -space-x-2 mr-4">
                  {assignedUsers.map((user) => user && (
                    <Avatar key={user.id} className="h-10 w-10 border-2 border-background">
                      {user.avatarUrl ? (
                        <AvatarImage src={user.avatarUrl} alt={user.username} />
                      ) : (
                        <AvatarFallback>
                          <UserCircle className="h-5 w-5" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingObjective(true)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleFavorite.mutate()}
                    className="hover:bg-yellow-100"
                  >
                    <Star 
                      className={`h-5 w-5 ${objective.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400 hover:text-yellow-400"}`}
                    />
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 text-sm">
              <div className="space-y-1">
                <div className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Erstellt am
                </div>
                <div>{format(new Date(objective.createdAt), "dd.MM.yyyy", { locale: de })}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Status
                </div>
                <div>{objective.status}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Zyklus
                </div>
                <div>{objective.cycleId ? objective.cycle?.title : "Kein Zyklus"}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Verantwortlich</div>
                <div>
                  {assignedUsers
                    .filter(Boolean)
                    .map(user => user?.username)
                    .join(", ") || "Nicht zugewiesen"}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Gesamtfortschritt</span>
                <span className="text-sm text-muted-foreground">{progress}%</span>
              </div>
              <Progress 
                value={progress} 
                className={cn(
                  "h-2",
                  progress === 100 && "bg-green-100 [&>[role=progressbar]]:bg-green-500"
                )} 
              />
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-semibold">Key Results</h4>
          <Dialog open={isKeyResultDialogOpen} onOpenChange={setIsKeyResultDialogOpen}>
            <Button onClick={() => setIsKeyResultDialogOpen(true)}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Key Result hinzufügen
            </Button>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Neues Key Result erstellen</DialogTitle>
              </DialogHeader>
              <KeyResultForm
                objectiveId={objectiveId}
                onSuccess={() => setIsKeyResultDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

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

                return (
                  <>
                    <TableRow key={kr.id} className="cursor-pointer hover:bg-muted/50">
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
                      <TableCell onClick={() => toggleRow(kr.id)}>{kr.description}</TableCell>
                      <TableCell onClick={() => toggleRow(kr.id)}>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={krProgress} 
                            className={cn(
                              "flex-1",
                              krProgress === 100 && "bg-green-100 [&>[role=progressbar]]:bg-green-500"
                            )} 
                          />
                          <span className="text-sm text-muted-foreground w-12 text-right">
                            {krProgress}%
                          </span>
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
                    </TableRow>

                    {isExpanded && (
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={5} className="p-4">
                          <div className="space-y-4">
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
                                  onCheckedChange={(checked) => handleProgressUpdate(kr, checked)}
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
                                          handleChecklistItemUpdate(kr, index, checked as boolean)
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
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={!!editingKR} onOpenChange={(open) => !open && setEditingKR(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Key Result bearbeiten</DialogTitle>
          </DialogHeader>
          {editingKR && (
            <KeyResultForm
              objectiveId={objectiveId}
              keyResult={editingKR}
              onSuccess={() => setEditingKR(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditingObjective} onOpenChange={setIsEditingObjective}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Objective bearbeiten</DialogTitle>
          </DialogHeader>
          <ObjectiveEditForm
            objective={objective}
            onSuccess={() => setIsEditingObjective(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default OKRDetailPage;