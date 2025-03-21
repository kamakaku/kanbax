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
      projectId: projectId,
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
      console.log("Sending request with userId:", user.id); // Debug log
      const response = await fetch("/api/boards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          userId: user.id, // Explizit die userId mitschicken
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create board");
      }

      const board = await response.json();

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
        description: "Das Board konnte nicht erstellt werden.",
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