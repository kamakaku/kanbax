import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { type Objective, type KeyResult, type User } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlusCircle, UserCircle, Calendar, Target } from "lucide-react";
import { useState } from "react";
import { KeyResultForm } from "@/components/okr/key-result-form";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export function OKRDetailPage() {
  const { id } = useParams<{ id: string }>();
  const objectiveId = parseInt(id);
  const [isKeyResultDialogOpen, setIsKeyResultDialogOpen] = useState(false);

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

      {/* Key Results Bereich */}
      <div className="relative space-y-6">
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

        {/* Center line */}
        <div className="absolute left-1/2 top-16 w-0.5 h-full bg-primary/20 -translate-x-1/2" />

        {/* Key Results */}
        <div className="grid gap-8 relative pt-8">
          {keyResults.map((kr, index) => {
            const krProgress = Math.floor(Math.random() * 100);
            const assignedUser = kr.userId ? users.find(u => u.id === kr.userId) : null;

            return (
              <div key={kr.id} className="flex justify-center">
                <Card className="w-1/2 p-6 relative">
                  {/* Curved connecting line */}
                  <div className="absolute -top-8 left-1/2 w-px h-8 bg-primary/50 -translate-x-1/2" />
                  <div className="flex items-start justify-between">
                    <div className="space-y-4 flex-1">
                      <div className="space-y-2">
                        <h4 className="font-medium">{kr.title}</h4>
                        <p className="text-sm text-muted-foreground">{kr.description}</p>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Zielwert:</span>{" "}
                          {kr.targetValue}
                        </div>
                        {kr.currentValue !== null && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Aktueller Wert:</span>{" "}
                            {kr.currentValue}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <Progress value={krProgress} className="flex-1" />
                        <span className="text-sm font-medium w-12 text-right">
                          {krProgress}%
                        </span>
                      </div>
                    </div>
                    {assignedUser && (
                      <Avatar className="h-8 w-8">
                        {assignedUser.avatarUrl ? (
                          <AvatarImage src={assignedUser.avatarUrl} alt={assignedUser.username} />
                        ) : (
                          <AvatarFallback>
                            <UserCircle className="h-5 w-5" />
                          </AvatarFallback>
                        )}
                      </Avatar>
                    )}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default OKRDetailPage;