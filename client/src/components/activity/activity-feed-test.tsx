import { useQuery } from "@tanstack/react-query";
import { type ActivityLog } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { MessageSquare, GitCommit, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Link } from "wouter";

interface ExtendedActivityLog extends ActivityLog {
  board_title?: string;
  board_id?: number;
  project_title?: string;
  project_id?: number;
  okr_title?: string;
  okr_id?: number;
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

export function ActivityFeedTest() {
  const { data: activities = [], isLoading } = useQuery<ExtendedActivityLog[]>({
    queryKey: ["/api/activity/test"],
    queryFn: async () => {
      const response = await fetch("/api/activity/test");
      if (!response.ok) {
        throw new Error("Failed to fetch test activity logs");
      }
      const data = await response.json();
      console.log("Fetched test activity logs:", data);
      return data;
    }
  });

  if (isLoading) {
    return <div>Loading test activities...</div>;
  }

  const renderContextLink = (activity: ExtendedActivityLog) => {
    let contextInfo = null;

    // Debug logging
    console.log("Rendering context for test activity:", {
      id: activity.id,
      board: { id: activity.board_id, title: activity.board_title },
      project: { id: activity.project_id, title: activity.project_title },
      okr: { id: activity.okr_id, title: activity.okr_title }
    });

    if (activity.board_id && activity.board_title) {
      contextInfo = {
        prefix: " im Board ",
        href: `/board/${activity.board_id}`,
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
        href: `/okr/${activity.okr_id}`,
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
      <h3 className="font-semibold mb-4">Test Aktivitäten</h3>
      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3">
            <div className="mt-1 p-2 rounded-full bg-primary/10 text-primary">
              {getActivityIcon(activity.action)}
            </div>
            <div>
              <div className="text-sm space-y-1">
                <span>{activity.details || activity.action}</span>
                {renderContextLink(activity)}
              </div>
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
    </Card>
  );
}
