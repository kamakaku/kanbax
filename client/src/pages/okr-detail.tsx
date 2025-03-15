import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Objective, type KeyResult, type User } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlusCircle, UserCircle, Calendar, Target, Edit, CheckCircle2 } from "lucide-react";
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
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all necessary data
  const { data: objectives = [], isLoading: isLoadingObjectives } = useQuery<Objective[]>({
    queryKey: ["/api/objectives"],
    queryFn: async () => {
      const response = await fetch("/api/objectives");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Objectives");
      }
      return response.json();
    },
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
      // Parse checklist items if they're stored as strings
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

    // Parse checklist items if they're stored as strings
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

  if (isLoadingObjectives || isLoadingKeyResults) {
    return <div className="text-center py-8">Lade OKR Details...</div>;
  }

  const objective = objectives.find(obj => obj.id === objectiveId);
  if (!objective) {
    return <div className="text-center py-8">Objective nicht gefunden.</div>;
  }

  const assignedUsers = objective.userIds
    ? users.filter(u => objective.userIds?.includes(u.id))
    : objective.userId && users.find(u => u.id === objective.userId)
    ? [users.find(u => u.id === objective.userId)]
    : [];

  // Calculate overall progress based on key results
  const progress = keyResults.length > 0
    ? Math.round(keyResults.reduce((sum, kr) => sum + (kr.currentValue || 0), 0) / keyResults.length)
    : 0;

  return (
    <div className="container mx-auto py-6 space-y-8">
      {/* Objective Card */}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2"
                    onClick={() => setIsEditingObjective(true)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-muted-foreground">{objective.description}</p>
              </div>
              <div className="flex -space-x-2">
                {assignedUsers.map((user) => user && (
                  <Avatar key={user.id} className="h-12 w-12 border-2 border-background">
                    {user.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt={user.username} />
                    ) : (
                      <AvatarFallback>
                        <UserCircle className="h-6 w-6" />
                      </AvatarFallback>
                    )}
                  </Avatar>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
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
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        </Card>
      </div>

      {/* Key Results Section */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-semibold">Key Results</h4>
          <Dialog open={isKeyResultDialogOpen} onOpenChange={setIsKeyResultDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="h-4 w-4 mr-2" />
                Key Result hinzufügen
              </Button>
            </DialogTrigger>
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
                <TableHead>Titel</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Fortschritt</TableHead>
                <TableHead className="w-[100px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keyResults.map((kr) => {
                const krProgress = kr.currentValue || 0;

                // Parse checklist items if they're stored as strings
                const checklistItems = kr.checklistItems?.map(item =>
                  typeof item === 'string' ? JSON.parse(item) as ChecklistItem : item
                ) || [];

                return (
                  <TableRow key={kr.id}>
                    <TableCell className="font-medium">{kr.title}</TableCell>
                    <TableCell>{kr.description}</TableCell>
                    <TableCell>{kr.type}</TableCell>
                    <TableCell>
                      <div className="space-y-4">
                        {kr.type === "checkbox" ? (
                          <Checkbox
                            checked={krProgress === 100}
                            onCheckedChange={(checked) => 
                              handleProgressUpdate(kr, checked === true)
                            }
                          />
                        ) : kr.type === "checklist" ? (
                          <div className="space-y-2">
                            {checklistItems.map((item, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <Checkbox
                                  checked={item.completed}
                                  onCheckedChange={(checked) =>
                                    handleChecklistItemUpdate(kr, index, checked === true)
                                  }
                                />
                                <span className="text-sm">{item.title}</span>
                              </div>
                            ))}
                            <Progress value={krProgress} className="h-2" />
                          </div>
                        ) : (
                          <div className="flex items-center gap-4">
                            <Progress value={krProgress} className="flex-1" />
                            <Input
                              type="number"
                              className="w-20"
                              value={editingProgress[kr.id] !== undefined ? editingProgress[kr.id] : krProgress}
                              onChange={(e) => handleProgressInputChange(kr.id, e.target.value)}
                              onBlur={() => handleProgressInputBlur(kr)}
                              min={0}
                              max={100}
                            />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingKR(kr)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Edit Dialog */}
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

      {/* Edit Objective Dialog */}
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