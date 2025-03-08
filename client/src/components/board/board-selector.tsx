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
  const { boards, setCurrentBoard } = useStore();
  
  const { data: fetchedBoards } = useQuery<Board[]>({
    queryKey: ["/api/boards"],
  });

  if (!fetchedBoards?.length) {
    return null;
  }

  return (
    <Select
      onValueChange={(value) => {
        const board = fetchedBoards.find((b) => b.id === parseInt(value));
        if (board) {
          setCurrentBoard(board);
        }
      }}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select a board" />
      </SelectTrigger>
      <SelectContent>
        {fetchedBoards.map((board) => (
          <SelectItem key={board.id} value={board.id.toString()}>
            {board.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
