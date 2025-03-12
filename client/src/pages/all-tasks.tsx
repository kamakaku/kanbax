import { useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "react-beautiful-dnd";
import { Task } from "@shared/schema";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { TaskDialog } from "@/components/board/task-dialog";
import { useToast } from "@/hooks/use-toast";

const defaultColumns = [
  { id: "backlog", title: "Backlog" },
  { id: "todo", title: "To Do" },
  { id: "in-progress", title: "In Progress" },
  { id: "review", title: "Review" },
  { id: "done", title: "Done" }
];

// Hilfsfunktion zur Berechnung der neuen Reihenfolge
function calculateNewOrder(tasks: Task[], sourceIndex: number, destinationIndex: number): number {
  if (tasks.length === 0) return 0;
  if (tasks.length === 1) return 1000;

  // Sortiere Tasks nach order
  const sortedTasks = [...tasks].sort((a, b) => a.order - b.order);

  if (destinationIndex === 0) {
    // Am Anfang einfügen
    return sortedTasks[0].order - 1000;
  }

  if (destinationIndex >= tasks.length) {
    // Am Ende einfügen
    return sortedTasks[sortedTasks.length - 1].order + 1000;
  }

  // Zwischen zwei Tasks einfügen
  const prevOrder = sortedTasks[destinationIndex - 1].order;
  const nextOrder = sortedTasks[destinationIndex].order;
  return prevOrder + (nextOrder - prevOrder) / 2;
}

export default function AllTasks() {
  console.log("AllTasks component mounting...");

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: tasks = [] } = useQuery({
    queryKey: ["all-tasks"],
    queryFn: async () => {
      console.log("Fetching all tasks...");
      const res = await apiRequest("GET", "/api/tasks");
      if (!res.ok) throw new Error("Failed to fetch tasks");
      const data = await res.json();
      console.log("Fetched tasks:", data.length);
      return data;
    }
  });

  // Filter tasks based on search
  const filteredTasks = tasks.filter((task) =>
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  console.log("Rendering AllTasks with:", {
    totalTasks: tasks.length,
    filteredTasks: filteredTasks.length
  });

  const handleDragEnd = async (result: DropResult) => {
    console.log("Drag end event:", result);

    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    const taskId = parseInt(draggableId);

    try {
      // Hole alle Tasks in der Zielspalte für die Neuordnung
      const tasksInColumn = tasks
        .filter(t => t.status === destination.droppableId)
        .sort((a, b) => a.order - b.order);

      // Berechne die neue Order
      const newOrder = calculateNewOrder(
        tasksInColumn.filter(t => t.id !== taskId), // Exclude the dragged task
        source.index,
        destination.index
      );

      console.log("Updating task position:", {
        taskId,
        source,
        destination,
        newOrder
      });

      // Update der verschobenen Task
      const task = tasks.find(t => t.id === taskId);
      if (!task) {
        console.error("Task not found:", taskId);
        return;
      }

      const res = await apiRequest("PATCH", `/api/tasks/${taskId}`, {
        status: destination.droppableId,
        order: newOrder,
        boardId: task.boardId
      });

      if (!res.ok) {
        throw new Error("Failed to update task order");
      }

      console.log("Task update successful");
      await queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      toast({ title: "Aufgabenreihenfolge aktualisiert" });
    } catch (error) {
      console.error("Task update error:", error);
      toast({
        title: "Fehler",
        description: "Die Reihenfolge konnte nicht aktualisiert werden",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Alle Aufgaben</h1>
        <Input
          type="search"
          placeholder="Aufgaben suchen..."
          className="max-w-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {defaultColumns.map((column) => (
            <div key={column.id} className="bg-card rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-4">{column.title}</h2>
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`space-y-2 min-h-[100px] rounded-lg transition-colors ${
                      snapshot.isDraggingOver ? "bg-muted/50" : ""
                    }`}
                  >
                    {filteredTasks
                      .filter((task) => task.status === column.id)
                      .sort((a, b) => a.order - b.order)
                      .map((task, index) => (
                        <Draggable
                          key={task.id}
                          draggableId={task.id.toString()}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`bg-background border rounded-lg p-3 cursor-move ${
                                snapshot.isDragging ? "shadow-lg border-primary" : ""
                              }`}
                              onClick={() => setSelectedTask(task)}
                            >
                              <h3 className="font-medium">{task.title}</h3>
                            </div>
                          )}
                        </Draggable>
                      ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      {selectedTask && (
        <TaskDialog
          task={selectedTask}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={async (updatedTask) => {
            const res = await apiRequest(
              "PATCH",
              `/api/tasks/${updatedTask.id}`,
              updatedTask
            );

            if (!res.ok) {
              throw new Error("Failed to update task");
            }

            queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
            toast({ title: "Aufgabe erfolgreich aktualisiert" });
          }}
          onDelete={async (taskId) => {
            const res = await apiRequest(
              "DELETE",
              `/api/tasks/${taskId}`
            );

            if (!res.ok) {
              throw new Error("Failed to delete task");
            }

            queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
            setSelectedTask(null);
            toast({ title: "Aufgabe erfolgreich gelöscht" });
          }}
        />
      )}
    </div>
  );
}