
import { useState } from "react";
import { DragDropContext, DropResult } from "react-beautiful-dnd";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Board as BoardType, type Column, type Task } from "@shared/schema";
import { Column as ColumnComponent } from "@/components/board/column";
import { ColumnForm } from "@/components/board/column-form";

export default function Board() {
  const params = useParams();
  const boardId = parseInt(params.id as string);
  const queryClient = useQueryClient();
  const [showColumnForm, setShowColumnForm] = useState(false);

  const { data: board, isLoading: boardLoading } = useQuery<BoardType>({
    queryKey: [`/api/boards/${boardId}`],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${boardId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch board");
      }
      return res.json();
    },
  });

  const { data: columns = [], isLoading: columnsLoading } = useQuery<Column[]>({
    queryKey: [`/api/boards/${boardId}/columns`],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${boardId}/columns`);
      if (!res.ok) {
        throw new Error("Failed to fetch columns");
      }
      return res.json();
    },
    enabled: !!boardId,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: [`/api/boards/${boardId}/tasks`],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${boardId}/tasks`);
      if (!res.ok) {
        throw new Error("Failed to fetch tasks");
      }
      return res.json();
    },
    enabled: !!boardId,
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (updatedTask: Task) => {
      const res = await fetch(`/api/tasks/${updatedTask.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedTask),
      });
      if (!res.ok) {
        throw new Error("Failed to update task");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/boards/${boardId}/tasks`] });
    },
    onError: (error) => {
      console.error("Task update error:", error);
    },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: async (columnId: number) => {
      const res = await fetch(`/api/columns/${columnId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Failed to delete column");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/boards/${boardId}/columns`] });
    },
  });

  const updateColumnMutation = useMutation({
    mutationFn: async (column: Column) => {
      const res = await fetch(`/api/columns/${column.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(column),
      });
      if (!res.ok) {
        throw new Error("Failed to update column");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/boards/${boardId}/columns`] });
    },
  });

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId, type } = result;

    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    if (type === "task") {
      const taskId = parseInt(draggableId.replace("task-", ""));
      const task = tasks.find((t) => t.id === taskId);
      
      if (!task) {
        return;
      }

      const updatedTask: Task = {
        ...task,
        status: destination.droppableId,
        columnId: columns.find((col) => col.status === destination.droppableId)?.id || 0,
        order: destination.index,
      };

      updateTaskMutation.mutate(updatedTask);
    }
  };

  const getColumnTasks = (columnStatus: string) => {
    return tasks
      .filter((task) => task.status === columnStatus)
      .sort((a, b) => a.order - b.order);
  };

  const isLoading = boardLoading || columnsLoading || tasksLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Loading board...</p>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Board not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">{board.title}</h1>
        <Button onClick={() => setShowColumnForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Column
        </Button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex space-x-4 overflow-x-auto pb-4">
          {columns && columns.length > 0 ? (
            columns
              .sort((a, b) => a.order - b.order)
              .map((column, index) => (
                <ColumnComponent
                  key={column.id}
                  column={column}
                  tasks={getColumnTasks(column.status || '')}
                  index={index}
                  boardId={boardId}
                  onDeleteColumn={(columnId) => deleteColumnMutation.mutate(columnId)}
                  onEditColumn={(column) => updateColumnMutation.mutate(column)}
                />
              ))
          ) : (
            <div className="flex-1 text-center p-8">
              <p className="text-lg text-muted-foreground">No columns found</p>
              <Button 
                onClick={() => setShowColumnForm(true)}
                variant="outline" 
                className="mt-4"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add your first column
              </Button>
            </div>
          )}
        </div>
      </DragDropContext>

      <ColumnForm
        open={showColumnForm}
        onClose={() => setShowColumnForm(false)}
        boardId={boardId}
      />
    </div>
  );
}
