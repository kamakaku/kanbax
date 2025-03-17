import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Board, type InsertBoard } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Plus, Pencil } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useStore } from "@/lib/store";
import { BoardForm } from "@/components/board/board-form";

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

  const { data: boards, isLoading } = useQuery<Board[]>({
    queryKey: [`/api/projects/${projectId}/boards`],
    queryFn: async () => {
      console.log("Fetching boards for project:", projectId);
      const res = await fetch(`/api/projects/${projectId}/boards`);
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Failed to fetch boards:", errorText);
        throw new Error(errorText || "Failed to fetch boards");
      }
      return res.json();
    },
  });

  const createBoard = useMutation({
    mutationFn: async (board: InsertBoard) => {
      console.log("Creating board with data:", board);
      const res = await apiRequest(
        "POST",
        `/api/projects/${projectId}/boards`,
        { ...board, projectId }
      );
      return res;
    },
    onSuccess: (newBoard) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${projectId}/boards`],
      });
      setCurrentBoard(newBoard);
      setLocation("/board");
      toast({ title: "Board erfolgreich erstellt" });
      setShowForm(false);
    },
    onError: (error) => {
      console.error("Error creating board:", error);
      toast({
        title: "Fehler beim Erstellen des Boards",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {boards?.map((board) => (
          <Card
            key={board.id}
            className="relative hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => {
              setCurrentBoard(board);
              setLocation("/board");
            }}
          >
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2"
              onClick={(e) => {
                e.stopPropagation();
                setEditingBoard(board);
                setShowForm(true);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <CardHeader>
              <CardTitle>{board.title}</CardTitle>
              <CardDescription>{board.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <BoardForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingBoard(null);
        }}
        onSubmit={(data) => createBoard.mutate(data)}
      />
    </div>
  );
}