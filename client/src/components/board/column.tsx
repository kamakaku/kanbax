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
    bg: "from-slate-800/40 to-slate-900/40",
    text: "text-slate-200",
    border: "border-slate-700/20"
  },
  todo: { 
    bg: "from-blue-800/40 to-blue-900/40",
    text: "text-blue-200",
    border: "border-blue-700/20"
  },
  "in-progress": { 
    bg: "from-amber-800/40 to-amber-900/40",
    text: "text-amber-200",
    border: "border-amber-700/20"
  },
  review: { 
    bg: "from-purple-800/40 to-purple-900/40",
    text: "text-purple-200",
    border: "border-purple-700/20"
  },
  done: { 
    bg: "from-green-800/40 to-green-900/40",
    text: "text-green-200",
    border: "border-green-700/20"
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
      backdrop-blur-lg 
      rounded-xl 
      border ${columnStyle.border}
      bg-gradient-to-b ${columnStyle.bg}
      shadow-[0_8px_32px_0_rgba(0,0,0,0.2)]
      relative
      overflow-hidden
    `}>
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 backdrop-blur-[10px] pointer-events-none" />

      <div className="relative p-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${columnStyle.text.replace("text-", "bg-")}`} />
            <h3 className={`font-medium text-sm ${columnStyle.text}`}>{displayTitle}</h3>
            <div className={`
              px-1.5 rounded text-xs ${columnStyle.text} 
              bg-white/5 backdrop-blur-sm 
              border ${columnStyle.border}
            `}>
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
            className={`
              relative p-3 
              min-h-[150px] 
              transition-colors 
              flex flex-col gap-3 
              ${snapshot.isDraggingOver ? "bg-white/5" : ""}
            `}
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