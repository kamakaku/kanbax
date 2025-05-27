import { ChecklistItem, Task } from "@shared/schema";
import { useEffect, useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Plus } from "lucide-react";
import { useMutation, useQueryClient } from '@tanstack/react-query';


interface ChecklistCardProps {
  task: Task;
  onUpdate: (task: Task) => void;
}

export function ChecklistCard({ task, onUpdate }: ChecklistCardProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItemTitle, setNewItemTitle] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);

  // Lade Checklist-Items beim ersten Rendern
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await fetch(`/api/tasks/${task.id}/checklist`);
        if (response.ok) {
          const data = await response.json();
          setItems(data);
        }
      } catch (error) {
        console.error("Fehler beim Laden der Checkliste:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [task.id]);

  // Neues Item hinzufügen
  const handleAddItem = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!newItemTitle.trim()) return;

    try {
      const maxOrder = items.length > 0
        ? Math.max(...items.map(item => item.itemOrder || 0))
        : -1;

      // Optimistisches Update für die UI
      const newItem = {
        id: `temp-${Date.now()}`,
        taskId: task.id,
        title: newItemTitle.trim(),
        completed: false,
        itemOrder: maxOrder + 1
      };

      // Lokales State-Update
      setItems(prev => [...prev, newItem]);
      setNewItemTitle("");
      
      if (formRef.current) {
        formRef.current.reset();
      }

      // API-Anfrage
      const response = await apiRequest(
        "POST",
        `/api/tasks/${task.id}/checklist`,
        {
          title: newItemTitle.trim(),
          completed: false,
          itemOrder: maxOrder + 1
        }
      );

      if (!response.ok) throw new Error("Fehler beim Hinzufügen des Elements");

      // Lokale Checklist aktualisieren mit der Serverantwort
      const serverItem = await response.json();
      setItems(prev => prev.map(item => 
        item.id === newItem.id ? serverItem : item
      ));

      // Aktualisiere die übergeordnete Komponente ohne Dialog zu schließen
      if (onUpdate) {
        onUpdate({
          ...task,
          _hasChecklist: true
        });
      }
    } catch (error) {
      console.error("Fehler beim Hinzufügen:", error);
      // Fehlgeschlagenes Item entfernen
      setItems(prev => prev.filter(item => !item.id.toString().startsWith('temp-')));
      
      toast({
        title: "Fehler",
        description: "Der Checklistenpunkt konnte nicht hinzugefügt werden",
        variant: "destructive",
      });
    }
  };

  // Mutation für das Umschalten des Completed-Status
  const toggleItemMutation = useMutation({
    mutationFn: async (item: ChecklistItem) => {
      const response = await apiRequest(
        "PATCH",
        `/api/checklist/${item.id}`,
        {
          completed: !item.completed
        }
      );

      if (!response.ok) throw new Error("Fehler beim Aktualisieren des Elements");
      return response.json();
    },
    onSuccess: () => {
      try {
        queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task.id}/checklist`] });
      } catch (error) {
        console.error("Error invalidating queries:", error);
        toast({
          title: "Fehler",
          description: "Daten konnten nicht aktualisiert werden.",
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      console.error("Error in toggleItemMutation:", error);
      toast({
        title: "Fehler",
        description: "Der Status konnte nicht geändert werden",
        variant: "destructive",
      });
    }
  });

  // Handler für das Umschalten des Completed-Status mit optimistischem UI-Update
  const handleToggleItem = (item: ChecklistItem, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Optimistisches UI-Update (sofortige Anzeige)
    setItems(prevItems => 
      prevItems.map(i => 
        i.id === item.id ? { ...i, completed: !i.completed } : i
      )
    );
    
    // Server-Update im Hintergrund
    toggleItemMutation.mutate(item);
  };

  // Berechne den Fortschritt der Checkliste
  const completedCount = items.filter(item => item.completed).length;
  const percentage = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  if (loading) {
    return (
      <Card onMouseDown={(e) => e.stopPropagation()}>
        <CardContent className="pt-6" onClick={(e) => e.stopPropagation()}>
          <div className="text-sm font-medium mb-4">Checkliste</div>
          <p className="text-sm text-muted-foreground">Wird geladen...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card onMouseDown={(e) => e.stopPropagation()}>
      <CardContent className="pt-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium">Checkliste</div>
          {items.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {completedCount} von {items.length} erledigt ({percentage}%)
            </div>
          )}
        </div>

        {items.length > 0 && (
          <Progress value={percentage} className="h-2 mb-4" />
        )}

        <div className="space-y-2">
          {items.map((item: ChecklistItem) => (
            <div
              key={item.id}
              className="flex items-center gap-2 p-2 rounded hover:bg-secondary/30"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                className="checkbox"
                checked={item.completed}
                onChange={(e) => handleToggleItem(item, e)}
                onClick={(e) => e.stopPropagation()}
              />
              <span
                className={`text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}
                onClick={(e) => e.stopPropagation()}
              >
                {item.title}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <div className="flex gap-2">
            <form
              ref={formRef}
              className="flex gap-2 w-full"
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Ereignis vollständig abfangen
                if (e.nativeEvent) {
                  e.nativeEvent.stopImmediatePropagation();
                }
                handleAddItem(e);
                // Verhindern Sie jede weitere Verarbeitung
                return false;
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <Input
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                placeholder="Neuen Punkt hinzufügen..."
                className="text-sm"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              />
              <Button
                type="submit"
                size="icon"
                className="bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-sm transition-all duration-300 hover:shadow-md"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAddItem(e);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}