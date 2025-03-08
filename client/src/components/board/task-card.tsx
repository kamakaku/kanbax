import { type Task } from "@shared/schema";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Draggable } from "react-beautiful-dnd";

interface TaskCardProps {
  task: Task;
  index: number;
}

export function TaskCard({ task, index }: TaskCardProps) {
  return (
    <Draggable draggableId={task.id.toString()} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <Card className="mb-3">
            <CardHeader className="p-4 pb-2">
              <h3 className="text-sm font-medium">{task.title}</h3>
            </CardHeader>
            {task.description && (
              <CardContent className="p-4 pt-0">
                <p className="text-sm text-muted-foreground">{task.description}</p>
              </CardContent>
            )}
          </Card>
        </div>
      )}
    </Draggable>
  );
}
