
import { useState } from "react";
import { Draggable, Droppable } from "react-beautiful-dnd";
import { MoreVertical, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskCard } from "./task-card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskForm } from "./task-form";
import { ColumnDeleteDialog } from "./column-delete-dialog";
import { ColumnForm } from "./column-form";
import { type Column as ColumnType, type Task } from "@shared/schema";

type ColumnProps = {
  column: ColumnType;
  tasks: Task[];
  index: number;
  boardId: number;
  onDeleteColumn: (columnId: number) => void;
  onEditColumn: (column: ColumnType) => void;
};

export function Column({ 
  column, 
  tasks, 
  index, 
  boardId, 
  onDeleteColumn, 
  onEditColumn 
}: ColumnProps) {
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);

  if (!column) {
    return null;
  }

  // Ensure column has a status property and it's a string
  const safeStatus = column.status ? column.status.toString() : 'default';
  
  return (
    <Draggable draggableId={`column-${column.id}`} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className="mb-4 min-w-[300px] max-w-[300px] flex-shrink-0"
        >
          <Card className="h-full">
            <CardHeader
              {...provided.dragHandleProps}
              className="flex flex-row items-center justify-between p-3"
            >
              <CardTitle className="text-sm font-medium">{column.title}</CardTitle>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-muted-foreground">
                  {tasks ? tasks.length : 0} tasks
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setShowEditForm(true)}>
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col p-2">
              <Droppable droppableId={safeStatus} type="task">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="flex flex-1 flex-col gap-2 min-h-[200px]"
                  >
                    {tasks && tasks.map((task, idx) => (
                      <TaskCard key={task.id} task={task} index={idx} />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
              <Button
                onClick={() => setShowTaskForm(true)}
                variant="ghost"
                size="sm"
                className="mt-2 justify-start text-xs text-muted-foreground"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add task
              </Button>
            </CardContent>
          </Card>

          <TaskForm
            open={showTaskForm}
            onClose={() => setShowTaskForm(false)}
            boardId={boardId}
            columnId={column.id}
            status={safeStatus}
          />

          <ColumnDeleteDialog
            open={showDeleteDialog}
            onClose={() => setShowDeleteDialog(false)}
            onConfirm={() => {
              onDeleteColumn(column.id);
              setShowDeleteDialog(false);
            }}
          />

          <ColumnForm
            open={showEditForm}
            onClose={() => setShowEditForm(false)}
            existingColumn={column}
            onSubmit={(updatedColumn) => {
              onEditColumn(updatedColumn);
              setShowEditForm(false);
            }}
          />
        </div>
      )}
    </Draggable>
  );
}
