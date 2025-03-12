import { useQuery } from "@tanstack/react-query";
import { type Comment } from "@shared/schema";
import { useAuth } from "@/lib/auth-store";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CommentEditor } from "./comment-editor";

interface CommentListProps {
  taskId: number;
}

export function CommentList({ taskId }: CommentListProps) {
  const { user } = useAuth();

  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey: [`/api/tasks/${taskId}/comments`],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/comments`);
      if (!res.ok) {
        throw new Error("Failed to fetch comments");
      }
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">
        Lade Kommentare...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">{comment.authorName}</span>
              <span className="text-sm text-muted-foreground">
                {format(new Date(comment.createdAt), "PPp", { locale: de })}
              </span>
            </div>
            <div 
              className="prose prose-sm dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: comment.content }}
            />
          </div>
        ))}
        {comments.length === 0 && (
          <div className="text-sm text-muted-foreground">
            Noch keine Kommentare vorhanden.
          </div>
        )}
      </div>
      {user && <CommentEditor taskId={taskId} />}
    </div>
  );
}
