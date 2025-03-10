import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBoardSchema, type InsertBoard } from "@shared/schema";
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
import { useToast } from "@/hooks/use-toast";

interface BoardFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: InsertBoard) => void;
}

export function BoardForm({ open, onClose, onSubmit }: BoardFormProps) {
  const { currentProject } = useStore();
  const { toast } = useToast();

  const form = useForm<InsertBoard>({
    resolver: zodResolver(insertBoardSchema),
    defaultValues: {
      title: "",
      description: "",
      projectId: currentProject?.id || 0,
    },
  });

  const handleSubmit = async (data: InsertBoard) => {
    if (!currentProject?.id) {
      toast({
        title: "Fehler",
        description: "Kein Projekt ausgewählt",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("Submitting board data:", {
        ...data,
        projectId: currentProject.id,
      });
      await onSubmit({
        ...data,
        projectId: currentProject.id,
      });
      form.reset();
    } catch (error) {
      console.error("Form submission error:", error);
      toast({
        title: "Fehler",
        description: "Das Board konnte nicht erstellt werden",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Neues Board erstellen</DialogTitle>
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
                    <Input placeholder="Mein neues Board" {...field} />
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
                      placeholder="Beschreiben Sie Ihr Board..." 
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full">
              Board erstellen
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}