import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { insertBoardSchema } from "@shared/schema";
import { useLocation } from "wouter";

interface BoardCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: number;
}

export function BoardCreateDialog({ open, onOpenChange, projectId }: BoardCreateDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const form = useForm({
    resolver: zodResolver(insertBoardSchema),
    defaultValues: {
      title: "",
      description: "",
      project_id: projectId || null,
      creator_id: user?.id || 0,
      team_ids: [],
      assigned_user_ids: [],
      is_favorite: false
    },
  });

  const onSubmit = async (data: any) => {
    if (!user?.id) {
      toast({
        title: "Fehler",
        description: "Benutzer-ID nicht verfügbar",
        variant: "destructive",
      });
      return;
    }

    try {
      const boardData = {
        ...data,
        creator_id: user.id,
      };

      console.log("Sending board creation request:", boardData);

      const response = await fetch("/api/boards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(boardData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Board creation failed:", errorData);
        throw new Error(errorData.message || "Failed to create board");
      }

      const board = await response.json();
      console.log("Board created successfully:", board);

      // Aktualisiere die Queries
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity"] });

      toast({
        title: "Board erstellt",
        description: "Das Board wurde erfolgreich erstellt.",
      });

      onOpenChange(false);
      setLocation(`/boards/${board.id}`);
    } catch (error) {
      console.error("Failed to create board:", error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Das Board konnte nicht erstellt werden.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neues Board erstellen</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Input
              placeholder="Board Titel"
              {...form.register("title")}
            />
            <Input
              placeholder="Beschreibung (optional)"
              {...form.register("description")}
            />
            <Button type="submit">Board erstellen</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}