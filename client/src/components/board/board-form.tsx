import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBoardSchema, type InsertBoard, type Project, type Team } from "@shared/schema";
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
import { useAuth } from "@/lib/auth-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface BoardFormProps {
  open: boolean;
  onClose: () => void;
  defaultValues?: Partial<InsertBoard>;
  onSubmit?: (data: InsertBoard) => Promise<void>;
}

export function BoardForm({ open, onClose, defaultValues, onSubmit }: BoardFormProps) {
  const { currentProject } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    queryFn: async () => {
      const response = await fetch("/api/teams");
      if (!response.ok) throw new Error("Fehler beim Laden der Teams");
      return response.json();
    },
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const response = await fetch("/api/projects");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Projekte");
      }
      return response.json();
    },
  });

  const form = useForm<InsertBoard>({
    resolver: zodResolver(insertBoardSchema),
    defaultValues: {
      title: defaultValues?.title || "",
      description: defaultValues?.description || "",
      projectId: defaultValues?.projectId || currentProject?.id,
      creatorId: user?.id,
      teamIds: defaultValues?.teamIds || [],
    },
  });

  const handleSubmit = async (data: InsertBoard) => {
    try {
      if (onSubmit) {
        await onSubmit(data);
      } else {
        const response = await fetch('/api/boards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            creatorId: user?.id,
          })
        });

        if (!response.ok) throw new Error('Failed to create board');

        const newBoard = await response.json();
        queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
        if (currentProject?.id) {
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${currentProject.id}/boards`] });
        }

        toast({ title: "Board erfolgreich erstellt" });
        form.reset();
        onClose();
        setLocation(`/boards/${newBoard.id}`);
      }
    } catch (error) {
      console.error("Error creating/updating board:", error);
      toast({
        title: "Fehler beim Speichern des Boards",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{defaultValues ? "Board bearbeiten" : "Neues Board erstellen"}</DialogTitle>
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
                    <Input placeholder="Geben Sie einen Titel ein..." {...field} />
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
                  <FormLabel>Projekt (Optional)</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === "0" ? null : parseInt(value))}
                    defaultValue={field.value?.toString() || "0"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Wählen Sie ein Projekt (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="0">Kein Projekt</SelectItem>
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

            <FormField
              control={form.control}
              name="teamIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teams zuweisen</FormLabel>
                  <FormControl>
                    <MultiSelect
                      placeholder="Teams auswählen..."
                      selected={field.value.map(String)}
                      options={teams.map(team => ({
                        value: String(team.id),
                        label: team.name
                      }))}
                      onChange={(values) => field.onChange(values.map(Number))}
                    />
                  </FormControl>
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