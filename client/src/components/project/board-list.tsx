import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Board, type InsertBoard } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { BoardForm } from "@/components/board/board-form";
import { apiRequest } from "@/lib/queryClient";
import { useStore } from "@/lib/store";

interface BoardListProps {
  projectId: number;
}

export function BoardList({ projectId }: BoardListProps) {
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
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

  const createBoard = useMutation({
    mutationFn: async (board: InsertBoard) => {
      const res = await apiRequest(
        "POST",
        `/api/projects/${projectId}/boards`,
        board
      );

      if (!res.ok) {
        throw new Error("Failed to create board");
      }

      return res.json();
    },
    onSuccess: (newBoard) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${projectId}/boards`],
      });
      setCurrentBoard(newBoard);
      toast({ title: "Board erfolgreich erstellt" });
      setShowForm(false);
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Erstellen des Boards",
        description: error.message,
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
          <Link key={board.id} href={`/board/${board.id}`}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle>{board.title}</CardTitle>
                <CardDescription>{board.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <BoardForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={(data) => createBoard.mutate(data)}
      />
    </div>
  );
}