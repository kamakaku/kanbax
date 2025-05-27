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
import { DialogMultiSelect, type Option } from "@/components/ui/dialog-multi-select";
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
  
  // Prüfe, ob der Benutzer Teams und Benutzer zuweisen darf
  const canAssignTeamsAndUsers = user?.subscriptionTier && 
    !['free', 'freelancer'].includes(user.subscriptionTier.toLowerCase());

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
      creator_id: defaultValues?.creator_id || user?.id || 0,
      team_ids: defaultValues?.team_ids || [],
      assigned_user_ids: defaultValues?.assigned_user_ids || [],
      is_favorite: defaultValues?.is_favorite || false,
    },
  });

  console.log("Form default values:", form.getValues());

  const handleSubmit = async (data: InsertBoard) => {
    try {
      console.log("Raw form data:", data);

      // Ensure arrays are properly formatted
      const formattedData = {
        ...data,
        creator_id: user?.id || 0,
        team_ids: (data.team_ids || []).filter(Boolean).map(Number),
        assigned_user_ids: (data.assigned_user_ids || []).filter(Boolean).map(Number),
        is_favorite: Boolean(data.is_favorite),
      };

      console.log("Formatted data to submit:", formattedData);

      if (onSubmit) {
        await onSubmit(formattedData);

        // Da wir beim Aktualisieren eines Boards sind, aktualisieren wir den Cache manuell
        if (defaultValues && 'id' in defaultValues && defaultValues.id) {
          const boardId = defaultValues.id;
          console.log("Invalidating queries for board update:", boardId);
          // Aktualisiere alle relevanten Caches
          await queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
          await queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
          await queryClient.invalidateQueries({ queryKey: ["/api/activity"] });

          // Wenn das Board einem Projekt zugeordnet ist, aktualisiere auch die Projekt-Boards
          if (formattedData.project_id) {
            await queryClient.invalidateQueries({ 
              queryKey: [`/api/projects/${formattedData.project_id}/boards`] 
            });
          }

          // Zeige eine Erfolgsmeldung
          toast({ title: "Board erfolgreich aktualisiert" });
        }

        onClose();
      } else {
        // Hier erstellen wir ein neues Board
        const response = await fetch('/api/boards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formattedData)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to create board: ${errorText}`);
        }

        const newBoard = await response.json();
        console.log("Created board:", newBoard);

        // Aktualisiere Caches
        await queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
        if (currentProject?.id) {
          await queryClient.invalidateQueries({ queryKey: [`/api/projects/${currentProject.id}/boards`] });
        }

        toast({ title: "Board erfolgreich erstellt" });
        form.reset();
        onClose();
        setLocation(`/boards/${newBoard.id}`);
      }
    } catch (error) {
      console.error("Error saving board:", error);
      toast({
        title: "Fehler beim Speichern des Boards",
        description: error instanceof Error ? error.message : "Bitte versuchen Sie es erneut",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-0">
        <div className="p-6 pb-0">
          <DialogTitle>{defaultValues ? "Board bearbeiten" : "Neues Board erstellen"}</DialogTitle>
        </div>

        <div className="overflow-y-auto px-6 pb-0 pt-2" style={{ maxHeight: "calc(85vh - 160px)" }}>
          <Form {...form}>
            <form id="board-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
                      <FormLabel>
                        Teams zuweisen
                        {!canAssignTeamsAndUsers && (
                          <span className="ml-2 text-xs text-amber-500 font-normal">
                            (Premium-Funktion)
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <DialogMultiSelect
                          placeholder={canAssignTeamsAndUsers 
                            ? "Teams auswählen..." 
                            : "Nur mit Premium-Abonnement verfügbar"}
                          options={teamOptions}
                          selected={Array.isArray(field.value) ? field.value.map(String) : []}
                          onChange={(values) => {
                            console.log("Selected team values:", values);
                            const numberValues = values.map(v => parseInt(v));
                            console.log("Converted team values:", numberValues);
                            field.onChange(numberValues);
                          }}
                          disabled={!canAssignTeamsAndUsers}
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
                      <FormLabel>
                        Benutzer zuweisen
                        {!canAssignTeamsAndUsers && (
                          <span className="ml-2 text-xs text-amber-500 font-normal">
                            (Premium-Funktion)
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <DialogMultiSelect
                          placeholder={canAssignTeamsAndUsers 
                            ? "Benutzer auswählen..." 
                            : "Nur mit Premium-Abonnement verfügbar"}
                          options={userOptions}
                          selected={Array.isArray(field.value) ? field.value.map(String) : []}
                          onChange={(values) => {
                            console.log("Selected user values:", values);
                            const numberValues = values.map(v => parseInt(v));
                            console.log("Converted user values:", numberValues);
                            field.onChange(numberValues);
                          }}
                          disabled={!canAssignTeamsAndUsers}
                        />
                      </FormControl>
                      {form.formState.errors.assigned_user_ids?.message && (
                        <FormMessage>{form.formState.errors.assigned_user_ids.message}</FormMessage>
                      )}
                    </FormItem>
                  );
                }}
              />
            </form>
          </Form>
        </div>

        <div className="p-6 border-t flex flex-row justify-end gap-2">
          <Button 
            variant="outline" 
            onClick={onClose}
          >
            Abbrechen
          </Button>
          <Button
            type="submit"
            form="board-form"
            className="bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-md transition-all duration-300 hover:shadow-lg"
          >
            {defaultValues ? "Board aktualisieren" : "Board erstellen"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}