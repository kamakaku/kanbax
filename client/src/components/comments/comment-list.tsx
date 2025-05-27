import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { UserIcon, FileIcon, FileText, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RichTextContent } from "@/components/ui/rich-text-editor";
import { type Comment, type User } from "@shared/schema";
import { Button } from "@/components/ui/button";

interface CommentListProps {
  taskId: number;
}

export function CommentList({ taskId }: CommentListProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient(); // Use global QueryClient instance

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
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });

  const isLoading = isLoadingComments || isLoadingUsers;

  // Improved delete mutation with optimistic updates and error handling
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? "Kommentar wurde bereits gelöscht"
            : "Fehler beim Löschen des Kommentars"
        );
      }
      return commentId;
    },
    onMutate: (commentId) => {
      // Optimistic update - remove comment from UI immediately
      const previousComments = queryClient.getQueryData<Comment[]>(
        [`/api/tasks/${taskId}/comments`]
      );
      if (previousComments) {
        queryClient.setQueryData<Comment[]>(
          [`/api/tasks/${taskId}/comments`],
          previousComments.filter((c) => c.id !== commentId)
        );
      }
      return { previousComments };
    },
    onError: (_error, _commentId, context) => {
      // If error, revert to previous state
      if (context?.previousComments) {
        queryClient.setQueryData(
          [`/api/tasks/${taskId}/comments`],
          context.previousComments
        );
      }
    },
  });

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
        const author = users.find((u: User) => u.id === comment.authorId);
        const commentDate = new Date(comment.createdAt);
        const formattedDate = format(commentDate, "dd.MM.yyyy HH:mm", {
          locale: de,
        });
        const isAuthor = user?.id === comment.authorId;

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
                {isAuthor && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => deleteCommentMutation.mutate(comment.id)}
                    disabled={deleteCommentMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
            </div>
            <div className="text-sm pl-8 prose prose-sm dark:prose-invert max-w-none">
              {comment.content.includes(".pdf") &&
              comment.content.includes("href=") ? (
                <div>
                  <RichTextContent content={comment.content} />
                  {(() => {
                    const pdfMatch = comment.content.match(
                      /href="([^"]+\.pdf)"/
                    );
                    if (pdfMatch && pdfMatch[1]) {
                      let pdfUrl = pdfMatch[1];
                      if (pdfUrl.startsWith("/")) {
                        pdfUrl = window.location.origin + pdfUrl;
                      } else if (!pdfUrl.startsWith("http")) {
                        pdfUrl = window.location.origin + "/" + pdfUrl;
                      }
                      const pdfName = pdfUrl.split("/").pop() || "Dokument.pdf";
                      return (
                        <div className="mt-2 border rounded-md overflow-hidden">
                          <div className="flex items-center p-2 bg-red-50">
                            <FileText className="h-5 w-5 text-red-500 mr-2" />
                            <span className="text-sm font-medium text-red-800">
                              {pdfName}
                            </span>
                          </div>
                          <div className="p-3 bg-gray-50">
                            <a
                              href={pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                e.preventDefault();
                                window.open(pdfUrl, "_blank", "noopener,noreferrer");
                              }}
                              className="flex items-center justify-center p-4 border border-dashed rounded bg-white"
                            >
                              <div className="flex flex-col items-center">
                                <svg
                                  width="48"
                                  height="48"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="text-red-500 mb-2"
                                >
                                  <path d="M7 18H17V16H7V18Z" fill="currentColor" />
                                  <path d="M17 14H7V12H17V14Z" fill="currentColor" />
                                  <path d="M7 10H11V8H7V10Z" fill="currentColor" />
                                  <path
                                    fillRule="evenodd"
                                    clipRule="evenodd"
                                    d="M6 2C4.34315 2 3 3.34315 3 5V19C3 20.6569 4.34315 22 6 22H18C19.6569 22 21 20.6569 21 19V9C21 5.13401 17.866 2 14 2H6ZM6 4H13V9H19V19C19 19.5523 18.5523 20 18 20H6C5.44772 20 5 19.5523 5 19V5C5 4.44772 5.44772 4 6 4ZM15 4.10002C16.6113 4.4271 17.9413 5.52906 18.584 7H15V4.10002Z"
                                    fill="currentColor"
                                  />
                                </svg>
                                <span className="text-sm text-gray-600">
                                  PDF-Dokument öffnen
                                </span>
                              </div>
                            </a>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              ) : (
                <RichTextContent content={comment.content} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}