import { useState } from "react";
import { type Task } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ChecklistCardProps {
  task: Task;
  onUpdate: (task: Task) => void;
}

export function ChecklistCard({ task, onUpdate }: ChecklistCardProps) {
  const [newItem, setNewItem] = useState("");
  const { toast } = useToast();

  const handleAddItem = async () => {
    if (!newItem.trim()) return;

    try {
      const updatedChecklist = [
        ...(task.checklist || []),
        { text: newItem.trim(), checked: false }
      ];

      const response = await apiRequest(
        "PATCH",
        `/api/tasks/${task.id}`,
        { checklist: updatedChecklist }
      );

      if (!response.ok) throw new Error("Failed to add checklist item");

      const updatedTask = await response.json();
      onUpdate(updatedTask);
      setNewItem("");
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Der Checklistenpunkt konnte nicht hinzugefügt werden",
        variant: "destructive",
      });
    }
  };

  const handleToggleItem = async (index: number) => {
    try {
      const updatedChecklist = task.checklist?.map((item, i) => 
        i === index ? { ...item, checked: !item.checked } : item
      ) || [];

      const response = await apiRequest(
        "PATCH",
        `/api/tasks/${task.id}`,
        { checklist: updatedChecklist }
      );

      if (!response.ok) throw new Error("Failed to update checklist item");

      const updatedTask = await response.json();
      onUpdate(updatedTask);
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Der Checklistenpunkt konnte nicht aktualisiert werden",
        variant: "destructive",
      });
    }
  };

  const progress = task.checklist?.length 
    ? (task.checklist.filter(item => item.checked).length / task.checklist.length) * 100 
    : 0;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium">Checkliste</div>
          {task.checklist && task.checklist.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {task.checklist.filter(item => item.checked).length} von {task.checklist.length}
            </div>
          )}
        </div>

        {task.checklist && task.checklist.length > 0 && (
          <Progress value={progress} className="mb-4" />
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            {task.checklist?.map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => handleToggleItem(index)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className={`text-sm flex-1 ${item.checked ? 'line-through text-muted-foreground' : ''}`}>
                  {item.text}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <form 
              className="flex gap-2 w-full" 
              onSubmit={(e) => {
                e.preventDefault();
                handleAddItem();
              }}
            >
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="Neuer Checklistenpunkt"
              />
              <Button type="submit" variant="outline" size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
