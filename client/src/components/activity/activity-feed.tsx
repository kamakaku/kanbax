import { useQuery } from "@tanstack/react-query";
import { type ActivityLog } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
                  {activity.user_name && (
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {activity.user_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <span className="font-medium text-slate-800">
                  {activity.user_name}
                </span>
              </div>

              {/* Aktion und Kontext */}
              <div className="text-sm text-slate-600">
                {activity.details || activity.action}
                {renderContextLink(activity)}
              </div>

              {/* Zeitstempel */}
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(activity.created_at), {
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