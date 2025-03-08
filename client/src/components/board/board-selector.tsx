import { useQuery } from "@tanstack/react-query";
import { type Board } from "@shared/schema";
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
import { queryClient } from "@/lib/queryClient";

export function BoardSelector() {
  const { currentBoard, setCurrentBoard } = useStore();
  const { toast } = useToast();

  const { data: boards } = useQuery<Board[]>({
    queryKey: ["/api/boards"],
  });

  const createBoard = async () => {
    try {
      const res = await apiRequest("POST", "/api/boards", {
        title: "New Board",
        description: "A new board for your tasks",
      });
      const newBoard = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      toast({ title: "Board created successfully" });
      setCurrentBoard(newBoard);
    } catch (error) {
      toast({
        title: "Failed to create board",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Select
        value={currentBoard?.id.toString()}
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

      <Button onClick={createBoard} size="icon">
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}