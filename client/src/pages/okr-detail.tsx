import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { type Objective, type KeyResult, type User } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserCircle } from "lucide-react";

export function OKRDetailPage() {
  const { id } = useParams<{ id: string }>();
  const objectiveId = parseInt(id);

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

  // Fetch users for avatars
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
    <div className="container mx-auto py-12 space-y-16">
      {/* Objective Card */}
      <div className="flex justify-center">
        <Card className="w-2/3 p-6 relative">
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
      </div>

      {/* Connecting Lines and Key Results */}
      <div className="relative">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 w-0.5 h-full bg-primary/20 -translate-x-1/2" />

        {/* Key Results */}
        <div className="grid gap-8 relative">
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