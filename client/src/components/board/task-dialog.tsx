
import { useState } from "react";
import { useParams } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnId: number;
  columnName?: string;
}

export function TaskDialog({ open, onOpenChange, columnId, columnName }: TaskDialogProps) {
  const { id: boardId } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Verwende lokale State-Variablen statt React Hook Form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest.post(`/api/boards/${boardId}/tasks`, data);
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Aufgabe erstellt",
        description: "Die Aufgabe wurde erfolgreich erstellt",
      });
      queryClient.invalidateQueries({ queryKey: ["board", parseInt(boardId)] });
      onOpenChange(false);
      // Zurücksetzen der Formularfelder
      setTitle("");
      setDescription("");
      setPriority("medium");
      setIsSubmitting(false);
    },
    onError: (error) => {
      console.error("Fehler beim Erstellen der Aufgabe:", error);
      toast({
        title: "Fehler beim Erstellen der Aufgabe",
        description: "Beim Erstellen der Aufgabe ist ein Fehler aufgetreten",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Einfache manuelle Validierung
    if (!title.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Titel ein",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    const taskData = {
      title,
      description,
      priority,
      status: "todo",
      order: 0, // Wird serverseitig behandelt
      boardId: parseInt(boardId),
      columnId: columnId,
    };
    
    console.log("Sende Aufgabe:", taskData);
    createTaskMutation.mutate(taskData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Neue Aufgabe in {columnName || "Spalte"}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titel</Label>
            <Input 
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titel der Aufgabe" 
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Beschreibung</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beschreibung der Aufgabe"
              className="resize-none"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="priority">Priorität</Label>
            <Select
              value={priority}
              onValueChange={setPriority}
            >
              <SelectTrigger>
                <SelectValue placeholder="Priorität wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Niedrig</SelectItem>
                <SelectItem value="medium">Mittel</SelectItem>
                <SelectItem value="high">Hoch</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Erstelle..." : "Aufgabe erstellen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
