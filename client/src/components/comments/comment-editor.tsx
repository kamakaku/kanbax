import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

interface CommentEditorProps {
  taskId: number;
  onCommentAdded?: () => void;
}

export function CommentEditor({ taskId, onCommentAdded }: CommentEditorProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [content, setContent] = useState("");

  const handleSubmit = async () => {
    if (!content || !user) return;

    try {
      const result = await apiRequest("POST", `/api/tasks/${taskId}/comments`, {
        content,
        rawContent: content,
        authorId: user.id,
        taskId,
      });

      // Reset content
      setContent("");

      // Invalidate comments query
      queryClient.invalidateQueries({
        queryKey: [`/api/tasks/${taskId}/comments`],
      });

      toast({ title: "Kommentar hinzugefügt" });

      if (onCommentAdded) {
        onCommentAdded();
      }
    } catch (error) {
      console.error("Add comment error:", error);
      toast({
        title: "Fehler beim Hinzufügen des Kommentars",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <RichTextEditor 
        content={content}
        onChange={setContent}
        placeholder="Kommentar schreiben..."
        uploadType="comment"
        entityId={taskId}
      />
      <div className="flex justify-end">
        <Button 
          onClick={handleSubmit}
          disabled={!content.trim()}
          className="bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-md transition-all duration-300 hover:shadow-lg"
        >
          Kommentar hinzufügen
        </Button>
      </div>
    </div>
  );
}
