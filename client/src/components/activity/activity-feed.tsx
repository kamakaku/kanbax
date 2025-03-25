import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  User, MessageSquare, GitCommit, Delete, Plus, 
  Edit3, AlertCircle, Users, CheckCircle2 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

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

const getActivityIcon = (activity: ExtendedActivityLog) => {
  const action = activity.action;
  const notificationType = activity.notificationType;
  
  // Verwende das Benachrichtigungstyp-Feld für spezifischere Icons
  if (notificationType) {
    switch (notificationType) {
      case "task_comment":
      case "okr_comment":
      case "comment":
        return <MessageSquare className="h-4 w-4" />;
      case "task_update":
      case "okr_update":
      case "board_update":
      case "update":
        return <Edit3 className="h-4 w-4" />;
      case "task_delete":
      case "okr_delete":
      case "delete":
        return <Delete className="h-4 w-4" />;
      case "assignment":
        return <Users className="h-4 w-4" />;
      case "approval":
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        break;
    }
  }
  
  // Fallback basierend auf action
  switch (action) {
    case "comment":
      return <MessageSquare className="h-4 w-4" />;
    case "update":
      return <Edit3 className="h-4 w-4" />;
    case "create":
      return <Plus className="h-4 w-4" />;
    case "delete":
      return <Delete className="h-4 w-4" />;
    case "assign":
      return <Users className="h-4 w-4" />;
    case "warning":
    case "error":
      return <AlertCircle className="h-4 w-4" />;
    default:
      return <GitCommit className="h-4 w-4" />;
  }
};

const getActivityBadge = (activity: ExtendedActivityLog) => {
  const action = activity.action;
  const notificationType = activity.notificationType;
  
  let variant: "default" | "destructive" | "outline" | "secondary" | undefined = "default";
  let label = action.charAt(0).toUpperCase() + action.slice(1);
  
  // Passe Badge-Stil an Aktionstyp an
  if (action === "delete" || notificationType?.includes("delete")) {
    variant = "destructive";
    label = "Gelöscht";
  } else if (action === "update" || notificationType?.includes("update")) {
    variant = "secondary";
    label = "Aktualisiert";
  } else if (action === "create") {
    variant = "outline";
    label = "Neu";
  } else if (action === "assign" || notificationType === "assignment") {
    variant = "outline";
    label = "Zugewiesen";
  } else if (action === "comment" || notificationType?.includes("comment")) {
    variant = "secondary";
    label = "Kommentar";
  }
  
  return <Badge variant={variant} className="ml-2 text-xs">{label}</Badge>;
};

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
        <ScrollArea className="h-[400px] pr-4">
          <div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`p-4 border-b border-slate-200 ${i === 0 ? 'border-t rounded-t-md' : ''}`}>
                {/* Avatar und Name Platzhalter */}
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-[100px]" />
                    <Skeleton className="h-6 w-[60px] rounded-full" />
                  </div>
                  <div className="ml-auto">
                    <Skeleton className="h-3 w-[80px]" />
                  </div>
                </div>
                
                {/* Aktivitätsdetails Platzhalter */}
                <div className="ml-10 p-3">
                  <div className="flex items-start">
                    <Skeleton className="h-4 w-4 mr-2 mt-0.5" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-[180px] mb-2" />
                      <Skeleton className="h-4 w-[150px]" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-4">Aktuelle Aktivitäten</h3>
      <ScrollArea className="h-[400px] pr-4">
        <div>
          {activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Keine Aktivitäten gefunden
            </div>
          ) : (
            activities.map((activity, index) => (
              <div 
                key={activity.id} 
                className={`p-4 border-b border-slate-200 hover:bg-slate-50/80 transition-colors ${
                  index === 0 ? 'rounded-t-md border-t' : ''
                } ${
                  index === activities.length - 1 ? 'rounded-b-md border-b-0' : ''
                }`}
              >
                {/* Avatar und Name */}
                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="h-8 w-8 border border-slate-200 shadow-sm">
                    <AvatarImage src={activity.avatar_url} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {activity.username ? activity.username.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">
                      {activity.username || "Unbekannter Benutzer"}
                    </span>
                    {getActivityBadge(activity)}
                  </div>
                  
                  {/* Zeitstempel */}
                  <p className="text-xs text-muted-foreground ml-auto">
                    {formatDistanceToNow(new Date(activity.created_at || activity.createdAt), {
                      addSuffix: true,
                      locale: de,
                    })}
                  </p>
                </div>
                
                {/* Aktion und Kontext mit Icon */}
                <div className="text-sm text-slate-600 ml-10 flex items-start">
                  <div className="mr-2 mt-0.5 text-primary">
                    {getActivityIcon(activity)}
                  </div>
                  <div className="flex-1">
                    <div>
                      <span>{activity.details || activity.action}</span>
                    </div>
                    <div className="mt-1">
                      {renderContextLink(activity)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}