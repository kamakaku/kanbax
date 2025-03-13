import { useState } from "react";
import { type Task } from "@shared/schema";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Droppable } from "react-beautiful-dnd";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { Task as TaskComponent } from "./task";
import { TaskDialog } from "./task-dialog";

interface ColumnProps {
  column: {
    id: string | number;
    title?: string;
  };
  tasks: Task[];
  isAllTasksView?: boolean;
  onUpdate?: (task: Task) => Promise<void>;
  onDelete?: (taskId: number) => Promise<void>;
}

const statusColors: Record<string, { bg: string, border: string, text: string }> = {
  'backlog': { 
    bg: 'bg-slate-50',
    border: 'border-slate-100',
    text: 'text-slate-600'
  },
  'todo': { 
    bg: 'bg-blue-50',
    border: 'border-blue-100',
    text: 'text-blue-600'
  },
  'in-progress': { 
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    text: 'text-amber-600'
  },
  'review': { 
    bg: 'bg-purple-50',
    border: 'border-purple-100',
    text: 'text-purple-600'
  },
  'done': { 
    bg: 'bg-green-50',
    border: 'border-green-100',
    text: 'text-green-600'
  }
};

const statusLabels: Record<string, string> = {
  'backlog': 'Backlog',
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'review': 'Review',
  'done': 'Done'
};

export function Column({ column, tasks = [], isAllTasksView = false, onUpdate, onDelete }: ColumnProps) {
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null); // Initialize to null
  const { currentBoard } = useStore();
  const queryClient = useQueryClient();

  const columnId = typeof column.id === 'string' ? column.id.toLowerCase() : 'backlog';
  const columnStyle = statusColors[columnId] || statusColors.backlog;
  const displayTitle = typeof column.title === 'string' ? 
    (statusLabels[column.title.toLowerCase()] || column.title) : 
    'Untitled';

  const handleTaskUpdate = async (task: Task) => {
    if (onUpdate) {
      await onUpdate(task);
    }
    queryClient.invalidateQueries({ queryKey: ["/api/boards", currentBoard?.id, "tasks"] });
  };

  return (
    <Card className={`min-w-[260px] max-w-[260px] h-fit ${columnStyle.bg} border-0 shadow-none`}>
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${columnStyle.text.replace('text-', 'bg-')}`} />
            <h3 className={`font-medium text-sm ${columnStyle.text}`}>
              {displayTitle}
            </h3>
            <div className={`px-1.5 rounded text-xs ${columnStyle.text} ${columnStyle.bg} border ${columnStyle.border}`}>
              {tasks.length}
            </div>
          </div>
          {!isAllTasksView && (
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 hover:bg-white/50 ${columnStyle.text}`}
              onClick={() => {
                // Neuen Task für diese Spalte erstellen
                setSelectedTask({
                  id: 0, // Temporäre ID
                  title: "",
                  description: "",
                  status: column.title?.toLowerCase() || "todo",
                  boardId: currentBoard?.id || 0,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                });
                setIsTaskDialogOpen(true);
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-2">
        <Droppable droppableId={column.title || ""} type="TASK">
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className={`flex flex-col gap-2 min-h-[50px] transition-colors rounded-lg p-1 ${
                snapshot.isDraggingOver ? 'bg-white/50' : ''
              }`}
            >
              {tasks.map((task, index) => (
                <TaskComponent 
                  key={task.id} 
                  task={task} 
                  index={index}
                  showBoardTitle={isAllTasksView}
                  onUpdate={handleTaskUpdate}
                  onDelete={onDelete}
                  onClick={(clickedTask) => {
                    setSelectedTask(clickedTask);
                    setIsTaskDialogOpen(true);
                  }}
                />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </CardContent>

      <TaskDialog
        task={selectedTask}
        open={isTaskDialogOpen}
        onClose={() => {
          setIsTaskDialogOpen(false);
          setSelectedTask(null);
        }}
        onUpdate={async (updatedTask) => {
          try {
            if (updatedTask.id) {
              await handleTaskUpdate(updatedTask);
              // Aktualisiere selectedTask mit den neuesten Daten
              setSelectedTask(updatedTask);
            } else {
              // Logik für neue Tasks
              const response = await apiRequest(
                "POST", 
                `/api/boards/${currentBoard?.id}/tasks`, 
                updatedTask
              );

              if (!response.ok) throw new Error("Fehler beim Erstellen der Aufgabe");

              const newTask = await response.json();
              queryClient.invalidateQueries({ queryKey: ["/api/boards", currentBoard?.id, "tasks"] });

              // Dialog nicht schließen
              setSelectedTask(newTask);
            }
          } catch (error) {
            console.error("Fehler beim Aktualisieren/Erstellen der Aufgabe:", error);
            toast({
              title: "Fehler",
              description: "Die Aufgabe konnte nicht gespeichert werden",
              variant: "destructive",
            });
          }
        }}
      />
    </Card>
  );
}
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { PlusCircle } from 'lucide-react';
import { Droppable } from 'react-beautiful-dnd';
import Task from './task';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

interface ColumnProps {
  id: string;
  title: string;
  description?: string;
  index: number;
  tasks: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
  onAddTask: (columnId: string, task: { title: string; description?: string }) => void;
}

const Column: React.FC<ColumnProps> = ({ id, title, description, tasks, onAddTask }) => {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [taskBeingEdited, setTaskBeingEdited] = useState<string | null>(null);
  
  const { register, handleSubmit, formState: { errors }, reset } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: ''
    }
  });
  
  const onSubmit = (data: TaskFormValues) => {
    onAddTask(id, {
      title: data.title,
      description: data.description
    });
    reset();
    setIsAddingTask(false);
  };

  return (
    <Card className="w-[300px] mx-2 h-full flex flex-col">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <Droppable droppableId={id}>
        {(provided) => (
          <CardContent 
            className="flex-grow overflow-y-auto"
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {tasks.map((task, index) => (
              <Task 
                key={task.id}
                id={task.id}
                title={task.title}
                description={task.description}
                index={index}
                onEdit={() => setTaskBeingEdited(task.id)}
              />
            ))}
            {provided.placeholder}
          </CardContent>
        )}
      </Droppable>
      <CardFooter className="border-t p-2">
        <Button
          variant="ghost"
          className="w-full justify-start pl-2"
          onClick={() => setIsAddingTask(true)}
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          Add task
        </Button>
      </CardFooter>

      <Dialog open={isAddingTask} onOpenChange={setIsAddingTask}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add new task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Enter task title"
                  {...register('title')}
                />
                {errors.title && (
                  <p className="text-sm text-red-500">{errors.title.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter task description"
                  {...register('description')}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="submit">Create task</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {taskBeingEdited && (
        <Dialog 
          open={!!taskBeingEdited} 
          onOpenChange={(open) => {
            if (!open) setTaskBeingEdited(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit task</DialogTitle>
            </DialogHeader>
            {/* Edit form would go here */}
            <p>Edit functionality to be implemented</p>
            <DialogFooter>
              <Button onClick={() => setTaskBeingEdited(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};

export default Column;
