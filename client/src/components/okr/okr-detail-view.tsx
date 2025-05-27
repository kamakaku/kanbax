import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { type Objective, type KeyResult, type User } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { UserCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const progress = keyResults.length > 0
    ? Math.round(keyResults.reduce((sum, kr) => sum + (kr.currentValue || 0), 0) / keyResults.length)
    : 0;

  return (
    <div className="space-y-8">
      {/* Objective Card */}
      <Card className={cn(
        "p-6 relative",
        progress === 100 && "bg-green-50"
      )}>
        <div className="absolute -left-3 top-1/2 w-1 h-24 bg-primary -translate-y-1/2" />
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold flex items-center gap-2">
                {objective.title}
                {progress === 100 && (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
              </h3>
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
              <div className="text-muted-foreground">Status</div>
              <div>{objective.status}</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Key Results</div>
              <div>{keyResults.length}</div>
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

      {/* Key Results */}
      <div className="pl-8 space-y-4">
        {keyResults.map((kr) => {
          const krProgress = kr.currentValue || 0;

          return (
            <Card 
              key={kr.id} 
              className={cn(
                "p-6 relative",
                krProgress === 100 && "bg-green-50"
              )}
            >
              <div className="absolute -left-3 top-1/2 w-1 h-16 bg-primary/50 -translate-y-1/2" />
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    {kr.title}
                    {krProgress === 100 && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                  </h4>
                  <p className="text-sm text-muted-foreground">{kr.description}</p>
                </div>
                <div className="flex items-center gap-4">
                  <Progress 
                    value={krProgress} 
                    className={cn(
                      "flex-1",
                      krProgress === 100 && "bg-green-100 [&>[role=progressbar]]:bg-green-500"
                    )} 
                  />
                  <span className="text-sm font-medium w-12 text-right">
                    {krProgress}%
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}