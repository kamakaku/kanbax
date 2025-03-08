import { useState } from "react";
import { type Task, type InsertTask } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TaskCard } from "./task-card";
import { TaskForm } from "./task-form";
import { Droppable } from "react-beautiful-dnd";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ColumnProps {
  title: string;
  status: "todo" | "in-progress" | "done";
}

export function Column({ title, status }: ColumnProps) {
  const [showForm, setShowForm] = useState(false);
  const { currentBoard } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/boards", currentBoard?.id, "tasks", status],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${currentBoard?.id}/tasks`);
      if (!res.ok) {
        throw new Error(`Failed to fetch tasks: ${res.statusText}`);
      }
      const tasks = await res.json();
      return tasks.filter((task: Task) => task.status === status);
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
        status,
        order: maxOrder + 1,
        priority: taskData.priority || "medium",
        labels: taskData.labels || []
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

  if (!currentBoard) return null;

  return (
    <div className="flex flex-col bg-muted/50 rounded-lg p-3 min-h-[500px] w-[280px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          <span className="text-muted-foreground text-sm">({tasks.length})</span>
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

      <Droppable droppableId={status}>
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
        status={status}
      />
    </div>
  );
}