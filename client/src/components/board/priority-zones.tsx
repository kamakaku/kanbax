import { Task } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

  const handlePriorityChange = async (newPriority: string) => {
    if (newPriority === task.priority) return;

    try {
      const res = await apiRequest("PATCH", `/api/tasks/${task.id}`, {
        priority: newPriority
      });

      if (!res.ok) {
        throw new Error("Failed to update task priority");
      }

      const updatedTask = await res.json();

      // Invalidiere alle relevanten Queries
      await queryClient.invalidateQueries({ queryKey: ["all-tasks"] });

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
    <div className="space-y-4">
      {priorityZones.map((zone) => (
        <div key={zone.id} className="flex items-center gap-4">
          <div className={`w-3 h-3 rounded-full ${zone.color}`} />
          <Button
            variant={task.priority === zone.id ? "default" : "outline"}
            className={cn(
              "w-full justify-start",
              task.priority === zone.id && "bg-primary/10 hover:bg-primary/20"
            )}
            onClick={() => handlePriorityChange(zone.id)}
          >
            {zone.label}
            {task.priority === zone.id && " (Aktuell)"}
          </Button>
        </div>
      ))}
    </div>
  );
}