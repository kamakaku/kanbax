import { useState } from "react";
import { type Task, type Column as ColumnType, type InsertTask } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Plus, MoreVertical } from "lucide-react";
import { TaskCard } from "./task-card";
import { TaskForm } from "./task-form";
import { Droppable } from "react-beautiful-dnd";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

interface ColumnProps {
  column: ColumnType;
}

export function Column({ column }: ColumnProps) {
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(column.title);
  const { currentBoard } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/boards", currentBoard?.id, "tasks", column.id],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${currentBoard?.id}/tasks`);
      if (!res.ok) {
        throw new Error(`Failed to fetch tasks: ${res.statusText}`);
      }
      const tasks = await res.json();
      return tasks.filter((task: Task) => task.columnId === column.id);
    },
    enabled: !!currentBoard,
  });

  const createTask = useMutation({
    mutationFn: async (taskData: InsertTask) => {
      if (!currentBoard?.id) {
        throw new Error("No board selected");
      }

      const maxOrder = tasks.reduce((max, task) => Math.max(max, task.order), -1);

      const fullTaskData: InsertTask = {
        ...taskData,
        boardId: currentBoard.id,
        columnId: column.id,
        order: maxOrder + 1,
      };

      const res = await apiRequest(
        "POST",
        `/api/boards/${currentBoard.id}/tasks`,
        fullTaskData
      );

      if (!res.ok) {
        const error = await res.text();
        throw new Error(`Failed to create task: ${error}`);
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard?.id, "tasks"],
      });
      toast({ title: "Task created successfully" });
      setShowForm(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to create task",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateColumn = useMutation({
    mutationFn: async (newTitle: string) => {
      const res = await apiRequest("PATCH", `/api/columns/${column.id}`, {
        title: newTitle,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard?.id, "columns"],
      });
      setIsEditing(false);
      toast({ title: "Column updated" });
    },
    onError: (error) => {
      toast({
        title: "Failed to update column",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteColumn = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/columns/${column.id}`);
      if (!res.ok) {
        throw new Error("Failed to delete column");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard?.id, "columns"],
      });
      toast({ title: "Column deleted" });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete column",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTitleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim() !== column.title) {
      updateColumn.mutate(title.trim());
    } else {
      setIsEditing(false);
    }
  };

  if (!currentBoard) return null;

  return (
    <div className="flex flex-col bg-muted/50 rounded-lg p-3 min-h-[500px] w-[280px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-1">
          {isEditing ? (
            <form onSubmit={handleTitleSubmit} className="flex-1">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                autoFocus
              />
            </form>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight">{column.title}</h2>
                <span className="text-muted-foreground text-sm">({tasks.length})</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => deleteColumn.mutate()}
                    className="text-red-600"
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowForm(true)}
          className="h-8 w-8 hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Droppable droppableId={column.id.toString()}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex-1 overflow-y-auto"
          >
            {tasks.map((task, index) => (
              <TaskCard key={task.id} task={task} index={index} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <TaskForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={(task) => createTask.mutate(task)}
        columnId={column.id}
      />
    </div>
  );
}