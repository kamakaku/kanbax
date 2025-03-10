import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema, type InsertTask, type Task } from "@shared/schema";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/lib/store";

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (task: InsertTask) => void;
  columnId: number;
}

export function TaskForm({ open, onClose, onSubmit, columnId }: TaskFormProps) {
  const { currentBoard } = useStore();

  const form = useForm<InsertTask>({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "todo",
      order: 0,
      boardId: currentBoard?.id || 0,
      columnId: columnId,
      priority: "medium",
      labels: [],
    },
  });

  const handleSubmit = async (data: InsertTask) => {
    if (!currentBoard?.id) return;

    try {
      await onSubmit({
        ...data,
        boardId: currentBoard.id,
        columnId: columnId,
      });
      form.reset();
    } catch (error) {
      console.error("Task creation error:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neue Aufgabe erstellen</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titel</FormLabel>
                  <FormControl>
                    <Input placeholder="Neue Aufgabe" {...field} />
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

            <Button type="submit" className="w-full">
              Aufgabe erstellen
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}