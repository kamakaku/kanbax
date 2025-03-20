import { useQuery } from "@tanstack/react-query";
import { type ActivityLog } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, GitCommit, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

interface ExtendedActivityLog extends ActivityLog {
  task_title?: string;
  task_id?: number;
  board_title?: string;
  board_id?: number;
  created_at: string;
}

const getActivityIcon = (action: string) => {
  switch (action) {
    case "comment":
      return <MessageSquare className="h-4 w-4" />;
    case "update":
      return <GitCommit className="h-4 w-4" />;
    default:
      return <Calendar className="h-4 w-4" />;
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
      const data = await response.json();
      console.log("Fetched activity logs:", data);
      return data;
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

  const renderActivityLinks = (activity: ExtendedActivityLog) => {
    // Only show links if we have both board and task info
    if (!activity.board_id) return null;

    return (
      <span className="text-sm">
        {activity.task_title && activity.task_id && (
          <>
            {" in Task "}
            <Link 
              href={`/board/${activity.board_id}?taskId=${activity.task_id}`}
              className="text-primary hover:underline inline-flex items-center"
            >
              {activity.task_title}
            </Link>
          </>
        )}
        {activity.board_title && (
          <>
            {" auf Board "}
            <Link 
              href={`/board/${activity.board_id}`}
              className="text-primary hover:underline inline-flex items-center"
            >
              {activity.board_title}
            </Link>
          </>
        )}
      </span>
    );
  };

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-4">Aktuelle Aktivitäten</h3>
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-4">
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Aktivitäten gefunden</p>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className="mt-1 p-2 rounded-full bg-primary/10 text-primary">
                  {getActivityIcon(activity.action)}
                </div>
                <div>
                  <div className="text-sm space-y-1">
                    <span>{activity.details || activity.action}</span>
                    {renderActivityLinks(activity)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(activity.created_at), {
                      addSuffix: true,
                      locale: de,
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}