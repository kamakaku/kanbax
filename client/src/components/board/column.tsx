import React, { useState } from "react";
import { Droppable } from "react-beautiful-dnd";
import { Task } from "@shared/schema";
import { Task as TaskComponent } from "./task";
import { TaskDialog } from "./task-dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface ColumnProps {
  column: {
    id: string | number;
    title?: string;
  };
  tasks: Task[];
}

const statusColors: Record<string, { bg: string; text: string }> = {
  backlog: { bg: "bg-slate-50", text: "text-slate-600" },
  todo: { bg: "bg-blue-50", text: "text-blue-600" },
  "in-progress": { bg: "bg-amber-50", text: "text-amber-600" },
  review: { bg: "bg-purple-50", text: "text-purple-600" },
  done: { bg: "bg-green-50", text: "text-green-600" },
};

const statusLabels: Record<string, string> = {
  backlog: "Backlog",
  todo: "To Do",
  "in-progress": "In Progress",
  review: "Review",
  done: "Done",
};

export function Column({ column, tasks }: ColumnProps) {
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const columnStyle = statusColors[column.title?.toLowerCase() || "backlog"] || statusColors.backlog;
  const displayTitle = column.title ? statusLabels[column.title.toLowerCase()] || column.title : "Untitled";

  return (
    <div className="min-w-[280px] max-w-[280px] bg-white rounded-lg border border-slate-200">
      <div className="p-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${columnStyle.text.replace("text-", "bg-")}`} />
            <h3 className={`font-medium text-sm ${columnStyle.text}`}>{displayTitle}</h3>
            <div className={`px-1.5 rounded text-xs ${columnStyle.text} bg-white border border-current`}>
              {tasks.length}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={`h-6 w-6 hover:bg-slate-50 ${columnStyle.text}`}
            onClick={() => {
              setSelectedTask(null);
              setIsTaskDialogOpen(true);
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <Droppable droppableId={column.title || ""}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`p-3 min-h-[150px] transition-colors flex flex-col gap-3 ${
              snapshot.isDraggingOver ? "bg-slate-50" : ""
            }`}
          >
            {tasks.map((task, index) => (
              <TaskComponent
                key={task.id}
                task={task}
                index={index}
                onClick={(task) => {
                  setSelectedTask(task);
                  setIsTaskDialogOpen(true);
                }}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <TaskDialog
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        task={selectedTask}
        onUpdate={async () => {}}
      />
    </div>
  );
}