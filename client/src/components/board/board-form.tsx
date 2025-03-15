import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBoardSchema, type InsertBoard, type Project } from "@shared/schema";
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
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface BoardFormProps {
  open: boolean;
  onClose: () => void;
  defaultValues?: Partial<InsertBoard>;
  onSubmit?: (data: InsertBoard) => Promise<void>;
}

export function BoardForm({ open, onClose, defaultValues, onSubmit }: BoardFormProps) {
  const { currentProject, setCurrentBoard } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const form = useForm<InsertBoard>({
    resolver: zodResolver(insertBoardSchema),
    defaultValues: defaultValues || {
      title: "",
      description: "",
      projectId: currentProject?.id || 0,
    },
  });

  const handleSubmit = async (data: InsertBoard) => {
    try {
      if (onSubmit) {
        await onSubmit(data);
      } else {
        const res = await fetch(`/api/projects/${data.projectId}/boards`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });

        if (!res.ok) {
          throw new Error("Failed to create board");
        }

        const newBoard = await res.json();
        queryClient.invalidateQueries({ queryKey: ["all-boards"] });
        
        //Invalidate queries for individual project boards
        const projectIds = (await fetch('/api/projects')).json().then(data => data.map(project => project.id));
        await Promise.all(projectIds.map(projectId => queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/boards`] })));
        toast({ title: "Board erfolgreich erstellt" });
        form.reset();
        onClose();
        setCurrentBoard(newBoard);
        setLocation(`/board`);
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Das Board konnte nicht erstellt werden",
        variant: "destructive",
      });
      console.error("Form submission error:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {defaultValues ? "Board bearbeiten" : "Neues Board erstellen"}
          </DialogTitle>
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
                    <Input placeholder="Mein Board" {...field} />
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
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Projekt</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    defaultValue={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Wählen Sie ein Projekt" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full">
              {defaultValues ? "Board aktualisieren" : "Board erstellen"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}