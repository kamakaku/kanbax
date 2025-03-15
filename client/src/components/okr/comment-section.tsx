import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserCircle } from "lucide-react";
import { type User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const commentSchema = z.object({
  content: z.string().min(1, "Kommentar kann nicht leer sein"),
});

interface CommentSectionProps {
  objectiveId?: number;
  keyResultId?: number;
}

export function CommentSection({ objectiveId, keyResultId }: CommentSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof commentSchema>>({
    resolver: zodResolver(commentSchema),
    defaultValues: {
      content: "",
    },
  });

  // Fetch comments
  const { data: comments = [], isLoading } = useQuery({
    queryKey: [`/api/okr-comments`, { objectiveId, keyResultId }],
    queryFn: async () => {
      const response = await fetch(`/api/okr-comments?${
        objectiveId ? `objectiveId=${objectiveId}` : `keyResultId=${keyResultId}`
      }`);
      if (!response.ok) throw new Error("Fehler beim Laden der Kommentare");
      return response.json();
    },
  });

  // Fetch users for displaying author information
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error("Fehler beim Laden der Benutzer");
      return response.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof commentSchema>) => {
      return await apiRequest("POST", "/api/okr-comments", {
        ...values,
        objectiveId,
        keyResultId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/okr-comments`, { objectiveId, keyResultId }],
      });
      form.reset();
      toast({ title: "Kommentar erfolgreich hinzugefügt" });
    },
    onError: (error) => {
      console.error("Error adding comment:", error);
      toast({
        title: "Fehler beim Hinzufügen des Kommentars",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <div>Lade Kommentare...</div>;
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    placeholder="Schreiben Sie einen Kommentar..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Wird gespeichert..." : "Kommentar hinzufügen"}
          </Button>
        </form>
      </Form>

      <div className="space-y-4">
        {comments.map((comment) => {
          const author = users.find((u) => u.id === comment.authorId);
          return (
            <div key={comment.id} className="flex gap-4 p-4 bg-muted/30 rounded-lg">
              <Avatar className="h-10 w-10">
                {author?.avatarUrl ? (
                  <AvatarImage src={author.avatarUrl} alt={author.username} />
                ) : (
                  <AvatarFallback>
                    <UserCircle className="h-6 w-6" />
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{author?.username}</span>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(comment.createdAt), "PP", { locale: de })}
                  </span>
                </div>
                <p className="mt-1 text-sm">{comment.content}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
