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
  onUpdate: (task: Task) => Promise<void>;
}

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  backlog: { 
    bg: "bg-slate-900/20",
    text: "text-slate-200",
    border: "border-slate-700/30"
  },
  todo: { 
    bg: "bg-blue-900/20",
    text: "text-blue-200",
    border: "border-blue-700/30"
  },
  "in-progress": { 
    bg: "bg-amber-900/20",
    text: "text-amber-200",
    border: "border-amber-700/30"
  },
  review: { 
    bg: "bg-purple-900/20",
    text: "text-purple-200",
    border: "border-purple-700/30"
  },
  done: { 
    bg: "bg-green-900/20",
    text: "text-green-200",
    border: "border-green-700/30"
  }
};

const getColumnStyle = (columnId: string | number) => {
  const id = columnId.toString().toLowerCase();
  return statusColors[id] || statusColors.backlog;
};

export function Column({ column, tasks, onUpdate }: ColumnProps) {
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const columnStyle = getColumnStyle(column.id);
  const displayTitle = column.title || "Untitled";

  return (
    <div className={`
      min-w-[280px] max-w-[280px] 
      backdrop-blur-xl 
      ${columnStyle.bg} 
      ${columnStyle.border} 
      rounded-xl border 
      bg-gradient-to-b from-white/5 to-transparent
      shadow-[0_8px_32px_0_rgba(0,0,0,0.1)]
    `}>
      <div className="p-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${columnStyle.text.replace("text-", "bg-")}`} />
            <h3 className={`font-medium text-sm ${columnStyle.text}`}>{displayTitle}</h3>
            <div className={`px-1.5 rounded text-xs ${columnStyle.text} bg-white/5 border ${columnStyle.border}`}>
              {tasks.length}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={`h-6 w-6 hover:bg-white/5 ${columnStyle.text}`}
            onClick={() => {
              setSelectedTask(null);
              setIsTaskDialogOpen(true);
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <Droppable droppableId={column.id.toString()}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`p-3 min-h-[150px] transition-colors flex flex-col gap-3 ${
              snapshot.isDraggingOver ? "bg-white/5" : ""
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
        onUpdate={onUpdate}
      />
    </div>
  );
}