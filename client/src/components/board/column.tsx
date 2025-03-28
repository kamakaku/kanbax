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
  showArchivedTasks?: boolean;
  onClick?: (task: Task) => void;
}

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  backlog: { 
    bg: "from-slate-50 to-white",
    text: "text-slate-700",
    border: "border-slate-200"
  },
  todo: { 
    bg: "from-blue-50 to-white",
    text: "text-blue-700",
    border: "border-blue-200"
  },
  "in-progress": { 
    bg: "from-amber-50 to-white",
    text: "text-amber-700",
    border: "border-amber-200"
  },
  review: { 
    bg: "from-purple-50 to-white",
    text: "text-purple-700",
    border: "border-purple-200"
  },
  done: { 
    bg: "from-green-50 to-white",
    text: "text-green-700",
    border: "border-green-200"
  }
};

const getColumnStyle = (columnId: string | number) => {
  const id = columnId.toString().toLowerCase();
  return statusColors[id] || statusColors.backlog;
};

export function Column({ column, tasks, onUpdate, showArchivedTasks = false, onClick }: ColumnProps) {
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | undefined>(undefined);

  // Die Filterung erfolgt jetzt in der übergeordneten Komponente
  const filteredTasks = tasks;

  const columnStyle = getColumnStyle(column.id);
  const displayTitle = column.title || "Untitled";

  return (
    <div className={`
      min-w-[280px] max-w-[280px] 
      backdrop-blur-sm 
      rounded-xl 
      border ${columnStyle.border}
      bg-gradient-to-b ${columnStyle.bg}
      shadow-lg
      relative
      overflow-hidden
    `}>
      <div className="relative p-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${columnStyle.text.replace("text-", "bg-")}`} />
            <h3 className={`font-medium text-sm ${columnStyle.text}`}>{displayTitle}</h3>
            <div className={`
              px-1.5 rounded text-xs ${columnStyle.text} 
              bg-white backdrop-blur-sm 
              border ${columnStyle.border}
            `}>
              {filteredTasks.length}
            </div>
          </div>
          <Button
            size="sm"
            className="h-6 px-2 py-1 bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-sm transition-all duration-300 hover:shadow-md"
            onClick={() => {
              setSelectedTask(undefined);
              setIsTaskDialogOpen(true);
            }}
          >
            <Plus className="h-3 w-3 mr-1" />
            <span className="text-xs">Neu</span>
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
              max-h-[calc(100vh-13rem)]
              overflow-y-auto
              transition-colors 
              flex flex-col gap-3 
              w-full
              ${snapshot.isDraggingOver ? "bg-slate-100/50 border-2 border-dashed border-slate-300" : ""}
            `}
          >
            {filteredTasks.map((task, index) => (
              <TaskComponent
                key={task.id}
                task={task}
                index={index}
                onClick={(task) => {
                  if (onClick) {
                    onClick(task);
                  } else {
                    setSelectedTask(task);
                    setIsTaskDialogOpen(true);
                  }
                }}
                onUpdate={onUpdate}
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