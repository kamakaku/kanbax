import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { UserIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { type Comment, type User } from "@shared/schema";
// Placeholder for apiRequest function - replace with your actual implementation
const apiRequest = async (method: string, url: string, body?: any) => {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  return res;
};

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
        if (userId) {
          const res = await fetch(`/api/users/${userId}`);
          if (res.ok) {
            const user = await res.json();
            users[userId] = user;
          }
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
        const author = users[comment.authorId];
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
            <div className="text-sm pl-8">
              {comment.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface CommentEditorProps {
  taskId: number;
  onCommentAdded?: () => void;
}

export function CommentEditor({ taskId, onCommentAdded }: CommentEditorProps) {
  const [content, setContent] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const addComment = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/tasks/${taskId}/comments`, {
        content,
        rawContent: content,
        authorId: user?.id,
        taskId
      });

      if (!res.ok) {
        throw new Error("Fehler beim Hinzufügen des Kommentars");
      }

      return res.json();
    },
    onSuccess: () => {
      setContent("");
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/comments`] });
      toast({
        title: "Kommentar hinzugefügt",
        description: "Dein Kommentar wurde erfolgreich hinzugefügt.",
      });

      if (onCommentAdded) {
        onCommentAdded();
      }
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: `Fehler beim Hinzufügen des Kommentars: ${error}`,
        variant: "destructive",
      });
    }
  });

  return (
    <div className="mt-4">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Kommentar schreiben..."
        className="mb-2 min-h-[80px]"
      />
      <Button 
        onClick={() => addComment.mutate()}
        disabled={!content.trim() || addComment.isPending}
        size="sm"
      >
        {addComment.isPending ? "Wird gesendet..." : "Kommentar senden"}
      </Button>
    </div>
  );
}