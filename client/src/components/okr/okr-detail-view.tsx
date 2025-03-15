import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { type Objective, type KeyResult, type User } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { UserCircle } from "lucide-react";

interface OkrDetailViewProps {
  objectiveId: number;
}

export function OkrDetailView({ objectiveId }: OkrDetailViewProps) {
  // Fetch the objective and its key results
  const { data: objective, isLoading: isLoadingObjective } = useQuery<Objective>({
    queryKey: ["/api/objectives", objectiveId],
    queryFn: async () => {
      const response = await fetch(`/api/objectives/${objectiveId}`);
      if (!response.ok) {
        throw new Error("Fehler beim Laden des Objectives");
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
    enabled: !!objectiveId,
  });

  // Fetch assigned user if available
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

  if (isLoadingObjective || isLoadingKeyResults) {
    return <div className="text-center py-8">Lade OKR Details...</div>;
  }

  if (!objective) {
    return <div className="text-center py-8">Objective nicht gefunden.</div>;
  }

  const assignedUser = objective.userId ? users.find(u => u.id === objective.userId) : null;
  const progress = Math.floor(Math.random() * 100); // Später durch echte Berechnung ersetzen

  return (
    <div className="space-y-8">
      {/* Objective Card */}
      <Card className="p-6 relative">
        <div className="absolute -left-3 top-1/2 w-1 h-24 bg-primary -translate-y-1/2" />
        <div className="flex items-start justify-between">
          <div className="space-y-4 flex-1">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">{objective.title}</h3>
              <p className="text-sm text-muted-foreground">{objective.description}</p>
            </div>
            <div className="flex items-center gap-4">
              <Progress value={progress} className="flex-1" />
              <span className="text-sm font-medium w-12 text-right">
                {progress}%
              </span>
            </div>
          </div>
          {assignedUser && (
            <Avatar className="h-10 w-10">
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
      </Card>

      {/* Key Results */}
      <div className="pl-8 space-y-4">
        {keyResults.map((kr) => {
          const krProgress = Math.floor(Math.random() * 100); // Später durch echte Berechnung ersetzen
          const assignedUser = kr.userId ? users.find(u => u.id === kr.userId) : null;

          return (
            <Card key={kr.id} className="p-6 relative">
              <div className="absolute -left-3 top-1/2 w-1 h-16 bg-primary/50 -translate-y-1/2" />
              <div className="flex items-start justify-between">
                <div className="space-y-4 flex-1">
                  <div className="space-y-2">
                    <h4 className="font-medium">{kr.title}</h4>
                    <p className="text-sm text-muted-foreground">{kr.description}</p>
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
          );
        })}
      </div>
    </div>
  );
}
