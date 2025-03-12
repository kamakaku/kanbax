import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
} from "lucide-react";

interface CommentEditorProps {
  taskId: number;
  onCommentAdded?: () => void;
}

export function CommentEditor({ taskId, onCommentAdded }: CommentEditorProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert focus:outline-none max-w-none",
      },
    },
  });

  const handleSubmit = async () => {
    if (!editor || !user) return;

    const content = editor.getHTML();
    const rawContent = editor.getJSON();

    try {
      const res = await apiRequest("POST", `/api/tasks/${taskId}/comments`, {
        content,
        rawContent: JSON.stringify(rawContent),
        authorId: user.id,
        taskId,
      });

      if (!res.ok) {
        throw new Error("Failed to add comment");
      }

      // Reset editor
      editor.commands.setContent("");

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

  if (!editor) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg">
        <div className="flex items-center gap-1 p-2 border-b">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive("bold") ? "bg-muted" : ""}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive("italic") ? "bg-muted" : ""}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive("bulletList") ? "bg-muted" : ""}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={editor.isActive("orderedList") ? "bg-muted" : ""}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={editor.isActive("blockquote") ? "bg-muted" : ""}
          >
            <Quote className="h-4 w-4" />
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().undo().run()}
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().redo().run()}
            >
              <Redo className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <EditorContent editor={editor} className="p-4" />
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSubmit}>Kommentar hinzufügen</Button>
      </div>
    </div>
  );
}
