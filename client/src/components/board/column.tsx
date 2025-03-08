import { useState } from "react";
import { type Task } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TaskCard } from "./task-card";
import { TaskForm } from "./task-form";
import { Droppable } from "react-beautiful-dnd";

interface ColumnProps {
  title: string;
  status: string;
  tasks: Task[];
  onAddTask: (task: Task) => void;
}

export function Column({ title, status, tasks, onAddTask }: ColumnProps) {
  const [showForm, setShowForm] = useState(false);

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
        onSubmit={onAddTask}
        status={status}
      />
    </div>
  );
}
