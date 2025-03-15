import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { type Objective, type Project, type Team, type User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect, type Option } from "@/components/ui/multi-select";

const objectiveEditSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  description: z.string().optional(),
  projectId: z.string().optional(),
  teamId: z.string().optional(),
  userIds: z.array(z.string()),
  status: z.enum(["active", "completed", "archived"]).default("active"),
});

interface ObjectiveEditFormProps {
  objective: Objective;
  onSuccess?: () => void;
}

export function ObjectiveEditForm({ objective, onSuccess }: ObjectiveEditFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch available data for dropdowns
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const response = await fetch("/api/projects");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Projekte");
      }
      return response.json();
    }
  });

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    queryFn: async () => {
      const response = await fetch("/api/teams");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Teams");
      }
      return response.json();
    }
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Benutzer");
      }
      return response.json();
    }
  });

  const userOptions: Option[] = users.map(user => ({
    value: user.id.toString(),
    label: user.username
  }));

  const form = useForm<z.infer<typeof objectiveEditSchema>>({
    resolver: zodResolver(objectiveEditSchema),
    defaultValues: {
      title: objective.title,
      description: objective.description || "",
      projectId: objective.projectId?.toString(),
      teamId: objective.teamId?.toString(),
      userIds: objective.userIds?.map(id => id.toString()) || [],
      status: objective.status as "active" | "completed" | "archived",
    },
  });

  async function onSubmit(values: z.infer<typeof objectiveEditSchema>) {
    try {
      const payload = {
        title: values.title,
        description: values.description,
        projectId: values.projectId ? parseInt(values.projectId) : null,
        teamId: values.teamId ? parseInt(values.teamId) : null,
        userIds: values.userIds.map(id => parseInt(id)),
        status: values.status,
      };

      await apiRequest("PATCH", `/api/objectives/${objective.id}`, payload);

      await queryClient.invalidateQueries({ 
        queryKey: ["/api/objectives"]
      });

      toast({ title: "Objective erfolgreich aktualisiert" });
      onSuccess?.();
    } catch (error) {
      console.error("Error in objective update:", error);
      toast({
        title: "Fehler beim Aktualisieren des Objective",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Titel</FormLabel>
              <FormControl>
                <Input {...field} />
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
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Status auswählen" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="completed">Abgeschlossen</SelectItem>
                    <SelectItem value="archived">Archiviert</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="projectId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Projekt (optional)</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Projekt auswählen" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectGroup>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="teamId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team (optional)</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Team auswählen" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectGroup>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id.toString()}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="userIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Benutzer</FormLabel>
              <FormControl>
                <MultiSelect
                  options={userOptions}
                  selected={field.value}
                  onChange={field.onChange}
                  placeholder="Benutzer auswählen"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="submit">Objective aktualisieren</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}