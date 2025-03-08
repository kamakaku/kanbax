import { useState } from "react";
import { type Task } from "@shared/schema";
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
      const tasks = await res.json();
      return tasks.filter((task: Task) => task.status === status);
    },
    enabled: !!currentBoard,
  });

  const createTask = useMutation({
    mutationFn: async (task: Task) => {
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
    <div className="flex flex-col bg-muted/50 rounded-lg p-4 min-h-[500px] w-[300px]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowForm(true)}
          className="h-8 w-8"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Droppable droppableId={status}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex-1"
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