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

export function BoardSelector() {
  const { currentBoard, setCurrentBoard } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: boards } = useQuery<Board[]>({
    queryKey: ["/api/boards"],
  });

  const createBoard = useMutation({
    mutationFn: async (board: InsertBoard) => {
      const res = await apiRequest("POST", "/api/boards", board);
      return res.json();
    },
    onSuccess: (newBoard) => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      setCurrentBoard(newBoard);
      toast({ title: "Board created successfully" });
    },
    onError: (error) => {
      toast({
        title: "Failed to create board",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const handleCreateBoard = () => {
    createBoard.mutate({
      title: "New Board",
      description: "A new board for your tasks",
    });
  };

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

      <Button onClick={handleCreateBoard} size="icon">
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}