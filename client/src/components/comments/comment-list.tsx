import { useQuery } from "@tanstack/react-query";
import { type Comment, type User } from "@shared/schema";
import { useAuth } from "@/lib/auth-store";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CommentEditor } from "./comment-editor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User as UserIcon } from "lucide-react";

interface CommentListProps {
  taskId: number;
}

export function CommentList({ taskId }: CommentListProps) {
  const { user } = useAuth();

  // Fetch comments
  const { data: comments = [], isLoading: isLoadingComments } = useQuery<Comment[]>({
    queryKey: [`/api/tasks/${taskId}/comments`],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/comments`);
      if (!res.ok) {
        throw new Error("Failed to fetch comments");
      }
      return res.json();
    },
  });

  // Fetch users for each comment
  const { data: users = {}, isLoading: isLoadingUsers } = useQuery<Record<number, User>>({
    queryKey: [`/api/users`],
    queryFn: async () => {
      const userIds = [...new Set(comments.map(c => c.authorId))];
      const users: Record<number, User> = {};

      for (const userId of userIds) {
        const res = await fetch(`/api/users/${userId}`);
        if (res.ok) {
          const user = await res.json();
          users[userId] = user;
        }
      }

      return users;
    },
    enabled: comments.length > 0,
  });

  const isLoading = isLoadingComments || isLoadingUsers;

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
        {comments.map((comment) => {
          const author = users[comment.authorId];

          return (
            <div key={comment.id} className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={author?.avatarUrl} alt={author?.username} />
                <AvatarFallback className="bg-primary/10">
                  <UserIcon className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {author?.username || 'Unbekannter Benutzer'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(comment.createdAt), "dd. MMM yyyy, HH:mm", { locale: de })}
                  </span>
                </div>
                <div 
                  className="prose prose-sm dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: comment.content }}
                />
              </div>
            </div>
          );
        })}
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