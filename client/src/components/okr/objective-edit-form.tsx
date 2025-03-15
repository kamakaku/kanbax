import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { type Objective, type User, type Team, type Project, type OkrCycle } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const objectiveEditSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  description: z.string().optional(),
  status: z.enum(["active", "completed", "archived"]).default("active"),
  projectId: z.string().optional(),
  cycleId: z.string().optional(),
  teamId: z.string().optional(),
  userId: z.string().optional(),
});

interface ObjectiveEditFormProps {
  objective: Objective;
  onSuccess?: () => void;
}

export function ObjectiveEditForm({ objective, onSuccess }: ObjectiveEditFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch necessary data for dropdowns
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error("Fehler beim Laden der Benutzer");
      return response.json();
    },
  });

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
      if (!response.ok) throw new Error("Fehler beim Laden der Projekte");
      return response.json();
    },
  });

  const { data: cycles = [] } = useQuery<OkrCycle[]>({
    queryKey: ["/api/okr-cycles"],
    queryFn: async () => {
      const response = await fetch("/api/okr-cycles");
      if (!response.ok) throw new Error("Fehler beim Laden der OKR-Zyklen");
      return response.json();
    },
  });

  const form = useForm<z.infer<typeof objectiveEditSchema>>({
    resolver: zodResolver(objectiveEditSchema),
    defaultValues: {
      title: objective.title,
      description: objective.description || "",
      status: objective.status as "active" | "completed" | "archived",
      projectId: objective.projectId?.toString(),
      cycleId: objective.cycleId?.toString(),
      teamId: objective.teamId?.toString(),
      userId: objective.userId?.toString(),
    },
  });

  async function onSubmit(values: z.infer<typeof objectiveEditSchema>) {
    try {
      const payload = {
        ...values,
        projectId: values.projectId ? parseInt(values.projectId) : undefined,
        cycleId: values.cycleId ? parseInt(values.cycleId) : undefined,
        teamId: values.teamId ? parseInt(values.teamId) : undefined,
        userId: values.userId ? parseInt(values.userId) : undefined,
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
          name="cycleId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>OKR-Zyklus</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Zyklus auswählen" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectGroup>
                    {cycles.map((cycle) => (
                      <SelectItem key={cycle.id} value={cycle.id.toString()}>
                        {cycle.title}
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
          name="projectId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Projekt</FormLabel>
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
              <FormLabel>Team</FormLabel>
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
          name="userId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Verantwortlich</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Benutzer auswählen" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectGroup>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.username}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
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