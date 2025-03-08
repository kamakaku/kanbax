import { useEffect } from "react";
import { DragDropContext, type DropResult } from "react-beautiful-dnd";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Task, type Board, type InsertTask } from "@shared/schema";
import { Column } from "@/components/board/column";
import { BoardSelector } from "@/components/board/board-selector";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

const COLUMNS = [
  { title: "To Do", status: "todo" },
  { title: "In Progress", status: "in-progress" },
  { title: "Done", status: "done" },
];

export default function Board() {
  const { toast } = useToast();
  const { tasks, setTasks, updateTaskOrder, currentBoard, setCurrentBoard } = useStore();

  const { data: boards } = useQuery<Board[]>({
    queryKey: ["/api/boards"],
  });

  const { data: boardTasks, isLoading } = useQuery<Task[]>({
    queryKey: ["/api/boards", currentBoard?.id, "tasks"],
    enabled: !!currentBoard,
  });

  const createTask = useMutation({
    mutationFn: async (task: InsertTask) => {
      const res = await apiRequest(
        "POST",
        `/api/boards/${currentBoard?.id}/tasks`,
        task
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard?.id, "tasks"],
      });
      toast({ title: "Task created successfully" });
    },
    onError: (error) => {
      toast({ 
        title: "Failed to create task",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...task }: Partial<Task> & { id: number }) => {
      const res = await apiRequest("PATCH", `/api/tasks/${id}`, task);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard?.id, "tasks"],
      });
    },
  });

  useEffect(() => {
    if (boards?.length && !currentBoard) {
      setCurrentBoard(boards[0]);
    }
  }, [boards, currentBoard, setCurrentBoard]);

  useEffect(() => {
    if (boardTasks) {
      setTasks(boardTasks);
    }
  }, [boardTasks, setTasks]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { draggableId, source, destination } = result;
    const taskId = parseInt(draggableId);
    const newStatus = destination.droppableId;
    const newOrder = destination.index;

    updateTaskOrder(taskId, newStatus, newOrder);
    updateTask.mutate({ id: taskId, status: newStatus, order: newOrder });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
      </div>
    );
  }

  if (!currentBoard) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Please select a board</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Kanban Board</h1>
        <BoardSelector />
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-6 overflow-x-auto pb-4">
          {COLUMNS.map(({ title, status }) => (
            <Column
              key={status}
              title={title}
              status={status as "todo" | "in-progress" | "done"}
              tasks={tasks.filter((task) => task.status === status)}
              onAddTask={(task) => createTask.mutate(task)}
            />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}