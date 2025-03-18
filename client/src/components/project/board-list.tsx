import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type Board, type InsertBoard } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Plus, KanbanSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-store";

interface BoardListProps {
  projectId: number;
}

// Form schema for validation
const formSchema = z.object({
  title: z.string().min(1, "Titel wird benötigt"),
  description: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

export function BoardList({ projectId }: BoardListProps) {
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { setCurrentBoard } = useStore();
  const { user } = useAuth();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
    },
  });

  const { data: boards = [], isLoading } = useQuery<Board[]>({
    queryKey: [`/api/projects/${projectId}/boards`],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/boards`);
      if (!res.ok) {
        throw new Error("Failed to fetch boards");
      }
      return res.json();
    },
  });

  const handleBoardClick = (board: Board) => {
    setCurrentBoard(board);
    setLocation("/all-boards");
  };

  const onSubmit = async (values: FormValues) => {
    if (isSubmitting || !user?.id) {
      toast({
        title: "Fehler",
        description: "Sie müssen angemeldet sein, um ein Board zu erstellen",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // Prepare complete board data according to InsertBoard type
      const boardData: InsertBoard = {
        title: values.title,
        description: values.description || "",
        projectId,
        creatorId: Number(user.id),
      };

      console.log("Submitting board data:", boardData);

      const response = await fetch("/api/boards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(boardData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Server validation errors:", errorData);
        throw new Error(errorData.message || "Failed to create board");
      }

      const newBoard = await response.json();
      console.log("Successfully created board:", newBoard);

      // Update cached data
      await queryClient.invalidateQueries({
        queryKey: [`/api/projects/${projectId}/boards`],
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/boards"],
      });

      setCurrentBoard(newBoard);
      setShowForm(false);
      form.reset();
      setLocation("/all-boards");

      toast({
        title: "Board erfolgreich erstellt",
        description: `Das Board "${newBoard.title}" wurde erstellt.`,
      });
    } catch (error) {
      console.error("Error creating board:", error);
      toast({
        title: "Fehler beim Erstellen des Boards",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-lg text-muted-foreground">Lade Boards...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Boards</h2>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Neues Board
        </Button>
      </div>

      {!boards.length ? (
        <Card className="bg-muted/50">
          <CardContent className="py-6 text-center">
            <KanbanSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Diesem Projekt sind noch keine Boards zugeordnet.
            </p>
            <Button
              onClick={() => setShowForm(true)}
              variant="outline"
              className="mt-4"
            >
              <Plus className="h-4 w-4 mr-2" />
              Board erstellen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <Card
              key={board.id}
              className="relative hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => handleBoardClick(board)}
            >
              <CardHeader>
                <CardTitle>{board.title}</CardTitle>
                <CardDescription>{board.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neues Board erstellen</DialogTitle>
            <DialogDescription>
              Fügen Sie hier die Details für Ihr Board hinzu. Ein Board hilft Ihnen, Aufgaben und deren Status zu organisieren.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titel</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Mein neues Board"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beschreibung</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Beschreiben Sie Ihr Board..."
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? "Board wird erstellt..."
                  : "Board erstellen"
                }
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}