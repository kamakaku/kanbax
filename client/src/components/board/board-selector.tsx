import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Board, type InsertBoard } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BoardForm } from "./board-form";

export function BoardSelector() {
  const [showForm, setShowForm] = useState(false);
  const { currentBoard, setCurrentBoard, currentProject } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: boards } = useQuery<Board[]>({
    queryKey: [`/api/projects/${currentProject?.id}/boards`],
    queryFn: async () => {
      if (!currentProject?.id) return [];
      const res = await fetch(`/api/projects/${currentProject.id}/boards`);
      if (!res.ok) {
        throw new Error("Failed to fetch boards");
      }
      return res.json();
    },
    enabled: !!currentProject?.id,
  });

  const createBoard = useMutation({
    mutationFn: async (board: InsertBoard) => {
      if (!currentProject?.id) return;
      const res = await apiRequest(
        "POST", 
        `/api/projects/${currentProject.id}/boards`,
        board
      );
      return res.json();
    },
    onSuccess: (newBoard) => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/projects/${currentProject?.id}/boards`] 
      });
      setCurrentBoard(newBoard);
      toast({ title: "Board created successfully" });
      setShowForm(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to create board",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!currentProject) {
    return null;
  }

  return (
    <div className="flex items-center gap-4">
      <Select
        value={currentBoard?.id?.toString()}
        onValueChange={(value) => {
          const board = boards?.find((b) => b.id === parseInt(value));
          if (board) {
            setCurrentBoard(board);
          }
        }}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select a board" />
        </SelectTrigger>
        <SelectContent>
          {boards?.map((board) => (
            <SelectItem key={board.id} value={board.id.toString()}>
              {board.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button onClick={() => setShowForm(true)} size="icon">
        <Plus className="h-4 w-4" />
      </Button>

      <BoardForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={(data) => createBoard.mutate(data)}
      />
    </div>
  );
}