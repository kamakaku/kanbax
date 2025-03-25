import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Die API-Antworten haben möglicherweise einen anderen Feldnamen (created_at statt createdAt)
interface ExtendedActivityLog {
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
  requiresNotification?: boolean | null;
  notificationSent?: boolean | null;
  visibleToUsers?: number[] | null;
  notificationType?: string | null;
  
  // API-spezifische Felder
  board_title?: string;
  board_id?: number;
  project_title?: string;
  project_id?: number;
  objective_title?: string;
  objective_id?: number;
  team_title?: string;
  team_id?: number; // Hinzugefügt für snake_case Kompatibilität
  username?: string;
  avatar_url?: string;
  
  // Zeitstemp - kann in verschiedenen Formaten vorliegen
  createdAt: Date | string;
  created_at?: string; // Abwärtskompatibilität für ältere API-Antworten
}

const renderContextLink = (activity: ExtendedActivityLog) => {
  let contextInfo = null;

  if (activity.boardId && activity.board_title) {
    contextInfo = {
      prefix: " im Board ",
      href: `/boards/${activity.boardId}`,
      title: activity.board_title
    };
  } else if (activity.projectId && activity.project_title) {
    contextInfo = {
      prefix: " im Projekt ",
      href: `/projects/${activity.projectId}`,
      title: activity.project_title
    };
  } else if (activity.objectiveId && activity.objective_title) {
    contextInfo = {
      prefix: " im OKR ",
      href: `/all-okrs/${activity.objectiveId}`,
      title: activity.objective_title
    };
  } else if (activity.teamId && activity.team_title) {
    contextInfo = {
      prefix: " im Team ",
      href: `/teams/${activity.teamId}`,
      title: activity.team_title
    };
  }

  if (!contextInfo) return null;

  return (
    <>
      {contextInfo.prefix}
      <Link href={contextInfo.href} className="text-primary hover:underline font-medium">
        {contextInfo.title}
      </Link>
    </>
  );
};

export function ActivityFeed() {
  const { data: activities = [], isLoading } = useQuery<ExtendedActivityLog[]>({
    queryKey: ["/api/activity"],
    queryFn: async () => {
      const response = await fetch("/api/activity");
      if (!response.ok) {
        throw new Error("Failed to fetch activity logs");
      }
      return response.json();
    }
  });

  if (isLoading) {
    return (
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Aktuelle Aktivitäten</h3>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-3 w-[140px]" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-4">Aktuelle Aktivitäten</h3>
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-6">
          {activities.map((activity) => (
            <div key={activity.id} className="space-y-2">
              {/* Avatar und Name */}
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={activity.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {activity.username ? activity.username.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-slate-800">
                  {activity.username || "Unbekannter Benutzer"}
                </span>
              </div>

              {/* Aktion und Kontext */}
              <div className="text-sm text-slate-600">
                {activity.details || activity.action}
                {renderContextLink(activity)}
              </div>

              {/* Zeitstempel */}
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(activity.created_at || activity.createdAt), {
                  addSuffix: true,
                  locale: de,
                })}
              </p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}