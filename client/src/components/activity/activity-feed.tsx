import { useQuery } from "@tanstack/react-query";
import { type ActivityLog } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, GitCommit, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

const getActivityIcon = (action: string) => {
  switch (action) {
    case "comment":
      return <MessageSquare className="w-4 h-4" />;
    case "update":
      return <GitCommit className="w-4 h-4" />;
    default:
      return <Calendar className="w-4 h-4" />;
  }
};

export function ActivityFeed() {
  const { data: activities = [], isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity"],
  });

  if (isLoading) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">Lade Aktivitäten...</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-4">Aktuelle Aktivitäten</h3>
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3">
              <div className="mt-1 p-2 rounded-full bg-primary/10 text-primary">
                {getActivityIcon(activity.action)}
              </div>
              <div>
                <p className="text-sm">
                  {activity.details || activity.action}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(activity.created_at), {
                    addSuffix: true,
                    locale: de,
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}