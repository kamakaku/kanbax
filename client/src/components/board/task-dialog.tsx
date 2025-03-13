
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { useForm } from "react-hook-form";
import { z } from "zod";

// Definiere das Schema für das Formular
const taskFormSchema = z.object({
  title: z.string().min(1, { message: "Der Titel ist erforderlich" }),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]),
  status: z.string()
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

export function TaskDialog() {
  // Hole das aktuelle Board aus dem Store
  const { currentBoard } = useStore();
  const boardId = currentBoard?.id;
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      status: "todo"
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskFormValues) => {
      if (!boardId) {
        throw new Error("Kein Board ausgewählt");
      }
      
      const response = await apiRequest(
        "POST", 
        `/api/boards/${boardId}/tasks`, 
        data
      );
      
      if (!response.ok) {
        throw new Error("Failed to create task");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      toast({
        title: "Aufgabe erstellt",
        description: "Die Aufgabe wurde erfolgreich erstellt.",
      });
      form.reset();
    },
    onError: (error) => {
      console.error("Fehler beim Erstellen der Aufgabe:", error);
      toast({
        title: "Fehler",
        description: "Die Aufgabe konnte nicht erstellt werden. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TaskFormValues) => {
    // Füge zusätzliche Daten hinzu
    const taskData = {
      ...data,
      boardId: boardId,
      columnId: 1, // Standard-Spalte (todo)
      order: 0, // Die Order wird vom Backend basierend auf der Anzahl der Tasks bestimmt
    };
    
    console.log(taskData);
    createTaskMutation.mutate(data);
  };

  return (
    <Dialog>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Neue Aufgabe erstellen</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titel</FormLabel>
                  <FormControl>
                    <Input placeholder="Titel der Aufgabe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschreibung</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Beschreiben Sie die Aufgabe"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priorität</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Priorität auswählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Niedrig</SelectItem>
                      <SelectItem value="medium">Mittel</SelectItem>
                      <SelectItem value="high">Hoch</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">Aufgabe erstellen</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
