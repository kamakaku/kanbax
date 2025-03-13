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
      const userIds = [...new Set(comments.map(c => c.authorId || c.userId))];
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

  return (
    <div className="space-y-6">
      <div className="space-y-4 max-h-40 overflow-y-auto">
        {comments.map((comment) => {
          const authorId = comment.authorId || comment.userId;
          const author = authorId ? users[authorId] : null;

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
                    {comment.createdAt 
                      ? format(new Date(comment.createdAt), "dd. MMM yyyy, HH:mm", { locale: de })
                      : 'Unbekannt'}
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

interface Comment {
  id: number;
  taskId: number;
  authorId: number;
  userId?: number;  // Für Abwärtskompatibilität
  content: string;
  createdAt: string;
}

interface User {
  id: number;
  username: string;
  avatarUrl?: string;
}

interface CommentEditorProps {
  taskId: number;
}

function CommentEditor({ taskId }: CommentEditorProps) {
  const [content, setContent] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addComment = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        throw new Error("Fehler beim Hinzufügen des Kommentars");
      }

      return res.json();
    },
    onSuccess: () => {
      setContent("");
      // Kommentarliste neu laden
      queryClient.invalidateQueries([`/api/tasks/${taskId}/comments`]);
      toast({
        title: "Kommentar hinzugefügt",
        description: "Dein Kommentar wurde erfolgreich hinzugefügt.",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: `Fehler beim Hinzufügen des Kommentars: ${error}`,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="mt-4 space-y-2">
      <Textarea
        placeholder="Neuer Kommentar..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={2}
      />
      <Button
        type="button"
        onClick={() => addComment.mutate()}
        disabled={!content.trim() || addComment.isLoading}
      >
        {addComment.isLoading ? "Wird hinzugefügt..." : "Kommentar hinzufügen"}
      </Button>
    </div>
  );
}