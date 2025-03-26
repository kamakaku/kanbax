import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { UserIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RichTextContent } from "@/components/ui/rich-text-editor";
import { type Comment, type User } from "@shared/schema";

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

  // Fetch users for comments
  const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Benutzer");
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    cacheTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const isLoading = isLoadingComments || isLoadingUsers;

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">
        Lade Kommentare...
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Keine Kommentare vorhanden.
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
      {comments.map((comment) => {
        const author = users.find(u => u.id === comment.authorId);
        const commentDate = new Date(comment.createdAt);
        const formattedDate = format(commentDate, "dd.MM.yyyy HH:mm", { locale: de });

        return (
          <div key={comment.id} className="border-b pb-3 last:border-0">
            <div className="flex items-center gap-2 mb-1">
              <Avatar className="h-6 w-6">
                {author?.avatarUrl ? (
                  <AvatarImage src={author.avatarUrl} alt={author.username} />
                ) : (
                  <AvatarFallback>
                    <UserIcon className="h-4 w-4" />
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {author?.username || `Benutzer #${comment.authorId}`}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formattedDate}
                </span>
              </div>
            </div>
            <div className="text-sm pl-8 prose prose-sm dark:prose-invert max-w-none">
              <RichTextContent content={comment.content} />
            </div>
          </div>
        );
      })}
    </div>
  );
}