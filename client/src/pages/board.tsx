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
import { useLocation } from "wouter";

// Definiere die Standard-Spalten mit korrekten Status-Werten
const defaultColumns = [
  { id: "backlog", title: "backlog" },
  { id: "todo", title: "todo" },
  { id: "in-progress", title: "in-progress" },
  { id: "review", title: "review" },
  { id: "done", title: "done" }
];

export default function Board() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { currentBoard } = useStore();

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

  const updateTaskStatus = useMutation({
    mutationFn: async ({ taskId, newStatus, newOrder, sourceColumnTasks, destinationColumnTasks }: { taskId: number; newStatus: string; newOrder: number; sourceColumnTasks?: Task[]; destinationColumnTasks?: Task[] }) => {
      // Find the existing task
      const task = tasks.find(t => t.id === taskId);
      if (!task) throw new Error("Task not found");

      // Find the matching column
      const targetColumn = defaultColumns.find(col => col.title === newStatus);
      if (!targetColumn) throw new Error(`Invalid status: ${newStatus}`);

      const res = await apiRequest("PATCH", `/api/tasks/${taskId}`, {
        status: newStatus,
        order: newOrder,
        boardId: task.boardId,
        columnId: task.columnId //Preserving original columnId for now.  Could be removed if the backend doesn't need it.
      });

      if (!res.ok) throw new Error("Failed to update task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard?.id, "tasks"],
      });
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
    },
    onError: (error) => {
      console.error("Update task error:", error);
      toast({
        title: "Failed to update task",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    const taskId = parseInt(draggableId);

    // Find the task that was dragged
    const draggedTask = tasks.find(t => t.id === taskId);
    if (!draggedTask) return;

    try {
      // Create new array of tasks
      const newTasks = [...tasks];
      const updatedTask = {
        ...draggedTask,
        status: destination.droppableId,
        order: destination.index
      };

      // Remove task from old position
      const taskIndex = newTasks.findIndex(t => t.id === taskId);
      if (taskIndex !== -1) {
        newTasks.splice(taskIndex, 1);
      }

      // Insert task at new position
      const insertIndex = newTasks.findIndex(t => 
        t.status === destination.droppableId && 
        t.order >= destination.index
      );

      if (insertIndex === -1) {
        newTasks.push(updatedTask);
      } else {
        newTasks.splice(insertIndex, 0, updatedTask);
      }

      // Update orders for all tasks in the destination column
      const tasksInDestColumn = newTasks.filter(t => t.status === destination.droppableId);
      tasksInDestColumn.forEach((task, index) => {
        task.order = index;
      });

      // Optimistic update
      queryClient.setQueryData(["/api/boards", currentBoard?.id, "tasks"], newTasks);

      // Update in backend
      await updateTaskStatus.mutateAsync({
        taskId,
        status: destination.droppableId,
        order: destination.index
      });
    } catch (error) {
      console.error("Failed to update task status:", error);
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: ["/api/boards", currentBoard?.id, "tasks"] });
    }
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
    return null;
  }

  if (tasksLoading) {
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
            {defaultColumns.map((column) => {
              const columnTasks = tasks
                .filter(task => task.status === column.title)
                .sort((a, b) => a.order - b.order);
              
              return (
                <ColumnComponent
                  key={column.id}
                  column={column}
                  tasks={columnTasks}
                  onUpdate={handleTaskUpdate}
                  onDelete={handleTaskDelete}
                />
              );
            })}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}