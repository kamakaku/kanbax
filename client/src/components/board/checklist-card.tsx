
import { ChecklistItem, Task } from "@shared/schema";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Plus } from "lucide-react";

interface ChecklistCardProps {
  task: Task;
  onUpdate: (task: Task) => void;
}

export function ChecklistCard({ task, onUpdate }: ChecklistCardProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItemTitle, setNewItemTitle] = useState("");
  const { toast } = useToast();

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
  const handleAddItem = async (e: React.FormEvent) => {
    // Verhindern der Standardaktion des Formulars (wie z.B. ein Neuladen der Seite)
    e.preventDefault();
    
    if (!newItemTitle.trim()) return;

    try {
      // Bestimme die nächste Reihenfolge
      const maxOrder = items.length > 0 
        ? Math.max(...items.map(item => item.itemOrder)) 
        : -1;

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

      const newItem = await response.json();
      setItems(prev => [...prev, newItem]);
      setNewItemTitle("");
      
      // Aktualisiere die übergeordnete Komponente
      onUpdate({
        ...task,
        // Aktualisiere die Task mit der Information, dass es Checklist-Items gibt
        _hasChecklist: true
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Der Checklistenpunkt konnte nicht hinzugefügt werden",
        variant: "destructive",
      });
    }
  };

  // Item als erledigt/nicht erledigt markieren
  const handleToggleItem = async (item: ChecklistItem) => {
    try {
      const response = await apiRequest(
        "PATCH",
        `/api/checklist/${item.id}`,
        { 
          completed: !item.completed 
        }
      );

      if (!response.ok) throw new Error("Fehler beim Aktualisieren des Elements");

      const updatedItem = await response.json();
      
      setItems(prev => 
        prev.map(i => i.id === updatedItem.id ? updatedItem : i)
      );
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Der Checklistenpunkt konnte nicht aktualisiert werden",
        variant: "destructive",
      });
    }
  };

  // Berechne den Fortschritt der Checkliste
  const completedCount = items.filter(item => item.completed).length;
  const progress = items.length ? (completedCount / items.length) * 100 : 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm font-medium mb-4">Checkliste wird geladen...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium">Checkliste</div>
          {items.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {completedCount} von {items.length}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <Progress value={progress} className="mb-4" />
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => handleToggleItem(item)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className={`text-sm flex-1 ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                  {item.title}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <form 
              className="flex gap-2 w-full" 
              onSubmit={handleAddItem}
            >
              <Input
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
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
