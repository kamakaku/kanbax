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

export function BoardSelector() {
  const { currentBoard, setCurrentBoard } = useStore();

  const { data: boards } = useQuery<Board[]>({
    queryKey: ["/api/boards"],
  });

  if (!boards?.length) {
    return null;
  }

  return (
    <Select
      value={currentBoard?.id.toString()}
      onValueChange={(value) => {
        const board = boards.find((b) => b.id === parseInt(value));
        if (board) {
          setCurrentBoard(board);
        }
      }}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select a board" />
      </SelectTrigger>
      <SelectContent>
        {boards.map((board) => (
          <SelectItem key={board.id} value={board.id.toString()}>
            {board.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}