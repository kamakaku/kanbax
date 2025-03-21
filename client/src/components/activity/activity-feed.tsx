import { useQuery } from "@tanstack/react-query";
import { type ActivityLog } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  Calendar,
  Plus,
  Edit,
  Trash2,
  Share2,
  Star,
  CheckSquare,
  User
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface ExtendedActivityLog extends ActivityLog {
  board_title?: string;
  board_id?: number;
  project_title?: string;
  project_id?: number;
  okr_title?: string;
  okr_id?: number;
  user_name?: string;
  user_id?: number;
  created_at: string;
}

const getActionDetails = (action: string): { icon: React.ReactNode; color: string } => {
  switch (action) {
    case "comment":
      return { icon: <MessageSquare className="h-4 w-4" />, color: "text-blue-500" };
    case "update":
      return { icon: <Edit className="h-4 w-4" />, color: "text-amber-500" };
    case "create":
      return { icon: <Plus className="h-4 w-4" />, color: "text-green-500" };
    case "delete":
      return { icon: <Trash2 className="h-4 w-4" />, color: "text-red-500" };
    case "share":
      return { icon: <Share2 className="h-4 w-4" />, color: "text-purple-500" };
    case "favorite":
      return { icon: <Star className="h-4 w-4" />, color: "text-yellow-500" };
    case "complete":
      return { icon: <CheckSquare className="h-4 w-4" />, color: "text-green-500" };
    default:
      return { icon: <Calendar className="h-4 w-4" />, color: "text-gray-500" };
  }
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

  const renderContextLink = (activity: ExtendedActivityLog) => {
    let contextInfo = null;

    if (activity.board_id && activity.board_title) {
      contextInfo = {
        prefix: " im Board ",
        href: `/boards/${activity.board_id}`,
        title: activity.board_title
      };
    } else if (activity.project_id && activity.project_title) {
      contextInfo = {
        prefix: " im Projekt ",
        href: `/projects/${activity.project_id}`,
        title: activity.project_title
      };
    } else if (activity.okr_id && activity.okr_title) {
      contextInfo = {
        prefix: " im OKR ",
        href: `/okrs/${activity.okr_id}`,
        title: activity.okr_title
      };
    }

    if (!contextInfo) return null;

    return (
      <>
        {contextInfo.prefix}
        <Link href={contextInfo.href} className="text-primary hover:underline">
          {contextInfo.title}
        </Link>
      </>
    );
  };

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-4">Aktuelle Aktivitäten</h3>
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-4">
          {activities.map((activity) => {
            const { icon, color } = getActionDetails(activity.action);
            return (
              <div key={activity.id} className="flex items-start gap-3">
                <div className={`mt-1 p-2 rounded-full bg-primary/10 ${color}`}>
                  <span className="inline-block" style={{ transform: 'translateY(3px)' }}>
                    {icon}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      {activity.user_name && (
                        <span className="font-medium text-slate-700">
                          {activity.user_name}
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1 ${color}`}>
                        <span style={{ transform: 'translateY(3px)' }}>
                          {activity.action}
                        </span>
                      </span>
                      {activity.details && (
                        <span className="text-muted-foreground">
                          {activity.details}
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground">
                      {renderContextLink(activity)}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(activity.created_at), {
                      addSuffix: true,
                      locale: de,
                    })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}