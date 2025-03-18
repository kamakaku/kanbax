import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Board, type InsertBoard, insertBoardSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, KanbanSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { apiRequest } from "@/lib/queryClient";
import { useStore } from "@/lib/store";

interface BoardListProps {
  projectId: number;
}

export function BoardList({ projectId }: BoardListProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingBoard, setEditingBoard] = useState<Board | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { setCurrentBoard } = useStore();

  const form = useForm<InsertBoard>({
    resolver: zodResolver(insertBoardSchema),
    defaultValues: {
      title: "",
      description: "",
      projectId: projectId,
    },
  });

  const { data: boards, isLoading } = useQuery<Board[]>({
    queryKey: [`/api/projects/${projectId}/boards`],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/boards`);
      if (!res.ok) {
        throw new Error("Failed to fetch boards");
      }
      return res.json();
    },
  });

  const createBoard = useMutation({
    mutationFn: async (data: InsertBoard) => {
      console.log("Creating board with data:", data); // Debug log

      const res = await apiRequest(
        "POST",
        `/api/projects/${projectId}/boards`,
        { ...data, projectId }
      );

      console.log("Create board response:", res); // Debug log

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to create board");
      }

      const newBoard = await res.json();
      console.log("Created new board:", newBoard); // Debug log
      return newBoard;
    },
    onSuccess: (newBoard) => {
      console.log("Board creation successful:", newBoard); // Debug log
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${projectId}/boards`],
      });
      setCurrentBoard(newBoard);
      setLocation("/board");
      toast({ title: "Board erfolgreich erstellt" });
      setShowForm(false);
      form.reset();
    },
    onError: (error: Error) => {
      console.error("Board creation error:", error);
      toast({
        title: "Fehler beim Erstellen des Boards",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateBoard = useMutation({
    mutationFn: async (data: InsertBoard & { id: number }) => {
      const { id, ...updateData } = data;
      const res = await apiRequest(
        "PATCH",
        `/api/boards/${id}`,
        updateData
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update board");
      }

      return res.json();
    },
    onSuccess: (updatedBoard) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${projectId}/boards`],
      });
      toast({ title: "Board erfolgreich aktualisiert" });
      setShowForm(false);
      setEditingBoard(null);
      form.reset();
    },
    onError: (error: Error) => {
      console.error("Board update error:", error);
      toast({
        title: "Fehler beim Aktualisieren des Boards",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: InsertBoard) => {
    console.log("Form submitted with data:", data); // Debug log
    try {
      if (editingBoard) {
        await updateBoard.mutateAsync({ ...data, id: editingBoard.id });
      } else {
        await createBoard.mutateAsync(data);
      }
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  const handleBoardClick = (board: Board) => {
    setCurrentBoard(board);
    setLocation("/board");
  };

  const handleEditClick = (e: React.MouseEvent, board: Board) => {
    e.stopPropagation();
    setEditingBoard(board);
    form.reset({
      title: board.title,
      description: board.description || "",
      projectId: board.projectId,
    });
    setShowForm(true);
  };

  const handleCreateBoard = () => {
    setEditingBoard(null);
    form.reset({
      title: "",
      description: "",
      projectId: projectId,
    });
    setShowForm(true);
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
        <Button onClick={handleCreateBoard}>
          <Plus className="mr-2 h-4 w-4" />
          Neues Board
        </Button>
      </div>

      {!boards?.length ? (
        <Card className="bg-muted/50">
          <CardContent className="py-6 text-center">
            <KanbanSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Diesem Projekt sind noch keine Boards zugeordnet.
            </p>
            <Button
              onClick={handleCreateBoard}
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
            >
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 bg-background/80 hover:bg-background"
                onClick={(e) => handleEditClick(e, board)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <div onClick={() => handleBoardClick(board)}>
                <CardHeader>
                  <CardTitle>{board.title}</CardTitle>
                  <CardDescription>{board.description}</CardDescription>
                </CardHeader>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBoard ? "Board bearbeiten" : "Neues Board erstellen"}
            </DialogTitle>
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
                      <Input placeholder="Mein neues Board" {...field} />
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
                disabled={createBoard.isPending || updateBoard.isPending}
              >
                {createBoard.isPending || updateBoard.isPending ? (
                  "Wird gespeichert..."
                ) : (
                  editingBoard ? "Board aktualisieren" : "Board erstellen"
                )}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}