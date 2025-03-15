import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Objective, type KeyResult, type User } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlusCircle, UserCircle, Calendar, Target, Edit } from "lucide-react";
import { useState } from "react";
import { KeyResultForm } from "@/components/okr/key-result-form";
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

export function OKRDetailPage() {
  const { id } = useParams<{ id: string }>();
  const objectiveId = parseInt(id);
  const [isKeyResultDialogOpen, setIsKeyResultDialogOpen] = useState(false);
  const [editingKR, setEditingKR] = useState<KeyResult | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all objectives first
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

  // Find the specific objective
  const objective = objectives.find(obj => obj.id === objectiveId);

  // Fetch key results
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

  // Fetch users
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
    } else {
      updateData.currentValue = typeof value === "number" ? value : 0;
    }

    await updateKeyResult.mutateAsync(updateData);
  };

  if (isLoadingObjectives || isLoadingKeyResults) {
    return <div className="text-center py-8">Lade OKR Details...</div>;
  }

  if (!objective) {
    return <div className="text-center py-8">Objective nicht gefunden.</div>;
  }

  const assignedUser = objective.userId ? users.find(u => u.id === objective.userId) : null;
  const progress = Math.floor(Math.random() * 100); // Später durch echte Berechnung ersetzen

  return (
    <div className="container mx-auto py-12 space-y-16">
      {/* Objective Card */}
      <div className="flex justify-center">
        <Card className="w-2/3 p-6 relative">
          <div className="absolute -left-3 top-1/2 w-1 h-24 bg-primary -translate-y-1/2" />
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold">{objective.title}</h3>
                <p className="text-muted-foreground">{objective.description}</p>
              </div>
              {assignedUser && (
                <Avatar className="h-12 w-12">
                  {assignedUser.avatarUrl ? (
                    <AvatarImage src={assignedUser.avatarUrl} alt={assignedUser.username} />
                  ) : (
                    <AvatarFallback>
                      <UserCircle className="h-6 w-6" />
                    </AvatarFallback>
                  )}
                </Avatar>
              )}
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
                <div>{assignedUser?.username || "Nicht zugewiesen"}</div>
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
            <DialogContent>
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
                const assignedUser = kr.userId ? users.find(u => u.id === kr.userId) : null;

                return (
                  <TableRow key={kr.id}>
                    <TableCell className="font-medium">{kr.title}</TableCell>
                    <TableCell>{kr.description}</TableCell>
                    <TableCell>{kr.type}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-4">
                        {kr.type === "checkbox" ? (
                          <Checkbox
                            checked={krProgress === 100}
                            onCheckedChange={(checked) => handleProgressUpdate(kr, checked)}
                          />
                        ) : (
                          <>
                            <Progress value={krProgress} className="flex-1" />
                            <Input
                              type="number"
                              className="w-20"
                              value={krProgress}
                              onChange={(e) => handleProgressUpdate(kr, Number(e.target.value))}
                              min={0}
                              max={100}
                            />
                          </>
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
        <DialogContent>
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
    </div>
  );
}

export default OKRDetailPage;