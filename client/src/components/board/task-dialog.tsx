import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/lib/store";

// Task Form Schema
const taskFormSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]),
  status: z.string().default("todo"),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

export function TaskDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { currentBoard } = useStore();
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

  // Zurücksetzen des Formulars, wenn der Dialog geöffnet wird
  useEffect(() => {
    if (open) {
      form.reset({
        title: "",
        description: "",
        priority: "medium",
        status: "todo"
      });
    }
  }, [open, form]);

  const createTask = useMutation({
    mutationFn: async (data: TaskFormValues) => {
      if (!currentBoard) {
        throw new Error("Kein Board ausgewählt");
      }

      // API-Request vorbereiten
      const taskData = {
        ...data,
        boardId: currentBoard.id,
        order: 0 // Standard-Reihenfolge für neue Aufgaben
      };

      const response = await fetch(`/api/boards/${currentBoard.id}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Fehler beim Erstellen der Aufgabe: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      // Cache aktualisieren und Dialog schließen
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard?.id, "tasks"],
      });
      onClose();
      toast({ title: "Aufgabe erfolgreich erstellt" });
    },
    onError: (error: Error) => {
      console.error("Fehler beim Erstellen der Aufgabe:", error);
      toast({
        title: "Fehler beim Erstellen der Aufgabe",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TaskFormValues) => {
    createTask.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Neue Aufgabe erstellen</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {currentBoard && (
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">Board:</span>
                <span className="text-sm">{currentBoard.title}</span>
              </div>
            )}

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titel</FormLabel>
                  <FormControl>
                    <Input placeholder="Aufgabentitel eingeben..." {...field} />
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
                      placeholder="Beschreiben Sie die Aufgabe..."
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

            <Button 
              type="submit" 
              className="w-full"
              disabled={createTask.isPending}
            >
              {createTask.isPending ? "Wird erstellt..." : "Aufgabe erstellen"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}