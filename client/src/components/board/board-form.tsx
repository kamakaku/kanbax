import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBoardSchema, type InsertBoard, type Project, type Team, type User } from "@shared/schema";
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
import { MultiSelect, type Option } from "@/components/ui/multi-select";
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

  // Fetch teams and users data
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    queryFn: async () => {
      const response = await fetch("/api/teams");
      if (!response.ok) throw new Error("Fehler beim Laden der Teams");
      return response.json();
    },
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error("Fehler beim Laden der Benutzer");
      return response.json();
    },
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const response = await fetch("/api/projects");
      if (!response.ok) throw new Error("Fehler beim Laden der Projekte");
      return response.json();
    },
  });

  // Prepare options for MultiSelect components
  const userOptions: Option[] = users.map(user => ({
    value: user.id.toString(),
    label: user.username
  }));

  const teamOptions: Option[] = teams.map(team => ({
    value: team.id.toString(),
    label: team.name
  }));

  console.log("Available user options:", userOptions);
  console.log("Available team options:", teamOptions);

  const form = useForm<InsertBoard>({
    resolver: zodResolver(insertBoardSchema),
    defaultValues: {
      title: defaultValues?.title || "",
      description: defaultValues?.description || null,
      project_id: defaultValues?.project_id || currentProject?.id || null,
      creator_id: user?.id, // Ensure we set creator_id from the authenticated user
      team_ids: defaultValues?.team_ids || [],
      assigned_user_ids: defaultValues?.assigned_user_ids || [],
      is_favorite: defaultValues?.is_favorite || false,
    },
  });

  console.log("Form default values:", form.getValues());

  const handleSubmit = async (data: InsertBoard) => {
    try {
      if (!user?.id) {
        toast({
          title: "Fehler",
          description: "Benutzer nicht authentifiziert",
          variant: "destructive",
        });
        return;
      }

      const formattedData = {
        ...data,
        creator_id: user.id, // Explicitly set creator_id
        team_ids: (data.team_ids || []).filter(Boolean).map(Number),
        assigned_user_ids: (data.assigned_user_ids || []).filter(Boolean).map(Number),
        is_favorite: Boolean(data.is_favorite),
      };

      console.log("Submitting board data:", formattedData);

      if (onSubmit) {
        await onSubmit(formattedData);
      } else {
        const response = await fetch('/api/boards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formattedData)
        });

        if (!response.ok) throw new Error('Failed to create board');

        const newBoard = await response.json();
        console.log("Created board:", newBoard);

        await queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
        if (currentProject?.id) {
          await queryClient.invalidateQueries({ queryKey: [`/api/projects/${currentProject.id}/boards`] });
        }

        toast({ title: "Board erfolgreich erstellt" });
        form.reset();
        onClose();
        setLocation(`/boards/${newBoard.id}`);
      }
    } catch (error) {
      console.error("Error creating board:", error);
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
            {/* Title field */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titel</FormLabel>
                  <FormControl>
                    <Input placeholder="Geben Sie einen Titel ein..." {...field} />
                  </FormControl>
                  {form.formState.errors.title && (
                    <FormMessage>{form.formState.errors.title.message}</FormMessage>
                  )}
                </FormItem>
              )}
            />

            {/* Description field */}
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
                  {form.formState.errors.description && (
                    <FormMessage>{form.formState.errors.description.message}</FormMessage>
                  )}
                </FormItem>
              )}
            />

            {/* Project selection */}
            <FormField
              control={form.control}
              name="project_id"
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
                  {form.formState.errors.project_id && (
                    <FormMessage>{form.formState.errors.project_id.message}</FormMessage>
                  )}
                </FormItem>
              )}
            />

            {/* Team selection */}
            <FormField
              control={form.control}
              name="team_ids"
              render={({ field }) => {
                console.log("Team field value:", field.value);
                return (
                  <FormItem>
                    <FormLabel>Teams zuweisen</FormLabel>
                    <FormControl>
                      <MultiSelect
                        placeholder="Teams auswählen..."
                        options={teamOptions}
                        selected={Array.isArray(field.value) ? field.value.map(String) : []}
                        onChange={(values) => {
                          console.log("Selected team values:", values);
                          const numberValues = values.map(v => parseInt(v));
                          console.log("Converted team values:", numberValues);
                          field.onChange(numberValues);
                        }}
                      />
                    </FormControl>
                    {form.formState.errors.team_ids?.message && (
                      <FormMessage>{form.formState.errors.team_ids.message}</FormMessage>
                    )}
                  </FormItem>
                );
              }}
            />

            {/* User selection */}
            <FormField
              control={form.control}
              name="assigned_user_ids"
              render={({ field }) => {
                console.log("User field value:", field.value);
                return (
                  <FormItem>
                    <FormLabel>Benutzer zuweisen</FormLabel>
                    <FormControl>
                      <MultiSelect
                        placeholder="Benutzer auswählen..."
                        options={userOptions}
                        selected={Array.isArray(field.value) ? field.value.map(String) : []}
                        onChange={(values) => {
                          console.log("Selected user values:", values);
                          const numberValues = values.map(v => parseInt(v));
                          console.log("Converted user values:", numberValues);
                          field.onChange(numberValues);
                        }}
                      />
                    </FormControl>
                    {form.formState.errors.assigned_user_ids?.message && (
                      <FormMessage>{form.formState.errors.assigned_user_ids.message}</FormMessage>
                    )}
                  </FormItem>
                );
              }}
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