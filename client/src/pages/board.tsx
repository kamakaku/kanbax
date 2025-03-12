import { useEffect } from "react";
import { DragDropContext, type DropResult } from "react-beautiful-dnd";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Board, type Column, type Task } from "@shared/schema";
import { Column as ColumnComponent } from "@/components/board/column";
import { BoardSelector } from "@/components/board/board-selector";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useLocation } from "wouter";

export default function Board() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { currentBoard, setCurrentBoard } = useStore();

  // Redirect to projects page if no board is selected
  useEffect(() => {
    if (!currentBoard) {
      setLocation("/projects");
      toast({
        title: "Please select a project first",
        description: "You need to select a project before viewing boards",
      });
    }
  }, [currentBoard, setLocation, toast]);

  const { data: columns = [], isLoading: columnsLoading } = useQuery<Column[]>({
    queryKey: ["/api/boards", currentBoard?.id, "columns"],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${currentBoard?.id}/columns`);
      if (!res.ok) {
        throw new Error("Failed to fetch columns");
      }
      return res.json();
    },
    enabled: !!currentBoard,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/boards", currentBoard?.id, "tasks"],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${currentBoard?.id}/tasks`);
      if (!res.ok) {
        throw new Error("Failed to fetch tasks");
      }
      return res.json();
    },
    enabled: !!currentBoard,
  });

  const createColumn = useMutation({
    mutationFn: async () => {
      if (!currentBoard?.id) return;

      const maxOrder = columns.reduce((max, col) => Math.max(max, col.order), -1);

      const res = await apiRequest(
        "POST",
        `/api/boards/${currentBoard.id}/columns`,
        {
          title: "New Column",
          order: maxOrder + 1,
        }
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard?.id, "columns"],
      });
      toast({ title: "Column created" });
    },
    onError: (error) => {
      toast({
        title: "Failed to create column",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ id, columnId, order, status }: { id: number; columnId: number; order: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/tasks/${id}`, { columnId, order, status });
      return res.json();
    },
    onSuccess: () => {
      // Invalidate both specific board tasks and all tasks
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard?.id, "tasks"],
      });
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to update task",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const taskId = parseInt(draggableId);
    const newColumnId = parseInt(destination.droppableId);
    const newOrder = destination.index;

    // Find the column to get its status
    const column = columns.find(col => col.id === newColumnId);
    if (!column) return;

    updateTaskStatus.mutate({ 
      id: taskId, 
      columnId: newColumnId, 
      order: newOrder,
      status: column.title?.toLowerCase() || 'todo'
    });
  };

  const handleTaskUpdate = async (updatedTask: Task) => {
    try {
      const res = await apiRequest(
        "PATCH",
        `/api/tasks/${updatedTask.id}`,
        updatedTask
      );

      if (!res.ok) {
        throw new Error("Failed to update task");
      }

      // Invalidate both specific board tasks and all tasks
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard?.id, "tasks"],
      });
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });

      toast({ title: "Task updated successfully" });
    } catch (error) {
      console.error("Task update error:", error);
      toast({
        title: "Failed to update task",
        description: "Could not update the task",
        variant: "destructive",
      });
    }
  };

  const handleTaskDelete = async (taskId: number) => {
    try {
      const res = await apiRequest("DELETE", `/api/tasks/${taskId}`);
      if (!res.ok) {
        throw new Error("Failed to delete task");
      }

      // Invalidate both specific board tasks and all tasks
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard?.id, "tasks"],
      });
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });

      toast({ title: "Task deleted successfully" });
    } catch (error) {
      console.error("Task delete error:", error);
      toast({
        title: "Failed to delete task",
        description: "Could not delete the task",
        variant: "destructive",
      });
    }
  };

  if (!currentBoard) {
    return null; // Will redirect via useEffect
  }

  if (columnsLoading || tasksLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Kanban Board</h1>
        <BoardSelector />
      </div>

      <div className="flex-1 overflow-x-auto">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-6 pb-4">
            {columns.map((column) => (
              <ColumnComponent
                key={column.id}
                column={column}
                tasks={tasks.filter(task => task.columnId === column.id)}
                onUpdate={handleTaskUpdate}
                onDelete={handleTaskDelete}
              />
            ))}
            <Button
              onClick={() => createColumn.mutate()}
              variant="outline"
              className="h-[500px] w-[280px] border-dashed"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Column
            </Button>
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}