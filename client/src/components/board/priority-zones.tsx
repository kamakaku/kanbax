import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import { Task } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface PriorityZonesProps {
  task: Task;
  onUpdate?: (updatedTask: Task) => void;
}

const priorityZones = [
  { id: "high", label: "Hoch", color: "bg-red-500" },
  { id: "medium", label: "Mittel", color: "bg-yellow-500" },
  { id: "low", label: "Niedrig", color: "bg-blue-500" }
];

export function PriorityZones({ task, onUpdate }: PriorityZonesProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handlePriorityDrop = async (result: any) => {
    if (!result.destination) return;

    const newPriority = result.destination.droppableId;
    if (newPriority === task.priority) return;

    try {
      const res = await apiRequest("PATCH", `/api/tasks/${task.id}`, {
        priority: newPriority
      });

      if (!res.ok) {
        throw new Error("Failed to update task priority");
      }

      const updatedTask = await res.json();

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["all-tasks"] }),
        queryClient.invalidateQueries({ 
          queryKey: [`/api/boards/${task.boardId}/tasks`] 
        })
      ]);

      if (onUpdate) {
        await onUpdate(updatedTask);
      }

      toast({ title: "Priorität erfolgreich aktualisiert" });
    } catch (error) {
      console.error("Priority update error:", error);
      toast({
        title: "Fehler",
        description: "Die Priorität konnte nicht aktualisiert werden",
        variant: "destructive",
      });
    }
  };

  return (
    <DragDropContext onDragEnd={handlePriorityDrop}>
      <div className="space-y-4">
        {priorityZones.map((zone) => (
          <Droppable key={zone.id} droppableId={zone.id}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  snapshot.isDraggingOver 
                    ? "border-primary bg-primary/5" 
                    : "border-dashed border-muted hover:border-primary/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${zone.color}`} />
                  <span className="font-medium">{zone.label}</span>
                </div>
                {zone.id === task.priority && (
                  <Draggable
                    draggableId={task.id.toString()}
                    index={0}
                  >
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className="mt-2 p-3 rounded-lg border border-primary bg-primary/10 cursor-move"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${zone.color}`} />
                          <span className="font-medium">Aktuelle Aufgabe</span>
                        </div>
                      </div>
                    )}
                  </Draggable>
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
}