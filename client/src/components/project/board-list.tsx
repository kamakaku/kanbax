import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type Board, type InsertBoard } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useStore } from "@/lib/store";
import { BoardForm } from "@/components/board/board-form";
import { queryClient } from "@/lib/queryClient";

interface BoardListProps {
  projectId: number;
}

export function BoardList({ projectId }: BoardListProps) {
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { setCurrentBoard } = useStore();

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

  const handleFormSubmit = async (data: InsertBoard) => {
    try {
      const response = await apiRequest<Board>(
        "POST",
        `/api/projects/${projectId}/boards`,
        { ...data, projectId }
      );

      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${projectId}/boards`],
      });

      setCurrentBoard(response);
      setLocation("/board");
      toast({ title: "Board erfolgreich erstellt" });
      setShowForm(false);
    } catch (error) {
      console.error("Error creating board:", error);
      toast({
        title: "Fehler beim Erstellen des Boards",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
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
            <CardHeader>
              <CardTitle>{board.title}</CardTitle>
              <CardDescription>{board.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <BoardForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleFormSubmit}
      />
    </div>
  );
}