import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { type InsertObjective, type Project, type Team, type User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";

const objectiveFormSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  description: z.string().optional(),
  quarter: z.string().min(1, "Quartal ist erforderlich"),
  year: z.string().min(1, "Jahr ist erforderlich"),
  projectId: z.string().optional(),
  teamId: z.string().optional(),
  userId: z.string().optional(),
  status: z.enum(["active", "completed", "archived"]).default("active"),
});

interface ObjectiveFormProps {
  onSuccess?: () => void;
}

export function ObjectiveForm({ onSuccess }: ObjectiveFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Generate a list of years (current year + 5 years)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => (currentYear + i).toString().slice(-2));

  const quarters = [
    { value: "Q1", label: "Q1 (Jan-Mär)" },
    { value: "Q2", label: "Q2 (Apr-Jun)" },
    { value: "Q3", label: "Q3 (Jul-Sep)" },
    { value: "Q4", label: "Q4 (Okt-Dez)" },
  ];

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

  const form = useForm<z.infer<typeof objectiveFormSchema>>({
    resolver: zodResolver(objectiveFormSchema),
    defaultValues: {
      title: "",
      description: "",
      quarter: "",
      year: new Date().getFullYear().toString().slice(-2),
      projectId: undefined,
      teamId: undefined,
      userId: undefined,
      status: "active",
    },
  });

  const getDateRange = (quarter: string, year: string) => {
    const fullYear = `20${year}`;
    switch (quarter) {
      case "Q1":
        return { startDate: `${fullYear}-01-01`, endDate: `${fullYear}-03-31` };
      case "Q2":
        return { startDate: `${fullYear}-04-01`, endDate: `${fullYear}-06-30` };
      case "Q3":
        return { startDate: `${fullYear}-07-01`, endDate: `${fullYear}-09-30` };
      case "Q4":
        return { startDate: `${fullYear}-10-01`, endDate: `${fullYear}-12-31` };
      default:
        throw new Error("Invalid quarter");
    }
  };

  async function onSubmit(values: z.infer<typeof objectiveFormSchema>) {
    try {
      // Erstelle einen neuen OKR-Zyklus
      const { startDate, endDate } = getDateRange(values.quarter, values.year);
      const newCyclePayload = {
        title: `${values.quarter} ${values.year}`,
        startDate,
        endDate,
        status: "active" as const,
      };

      console.log("Creating cycle with payload:", newCyclePayload);

      try {
        const newCycle = await apiRequest<{ id: number }>("POST", "/api/okr-cycles", newCyclePayload);
        console.log("Server response for cycle:", newCycle);

        if (!newCycle || typeof newCycle.id !== 'number') {
          console.error("Invalid cycle response:", newCycle);
          throw new Error("Ungültige Antwort vom Server beim Erstellen des OKR-Zyklus");
        }

        // Erstelle das Objective mit dem neuen Zyklus
        const payload: InsertObjective = {
          title: values.title,
          description: values.description,
          status: values.status,
          projectId: values.projectId ? parseInt(values.projectId) : undefined,
          cycleId: newCycle.id,
          teamId: values.teamId ? parseInt(values.teamId) : undefined,
          userId: values.userId ? parseInt(values.userId) : undefined,
        };

        console.log("Creating objective with payload:", payload);

        const newObjective = await apiRequest<{ id: number }>("POST", "/api/objectives", payload);

        await queryClient.invalidateQueries({ 
          queryKey: ["/api/objectives"]
        });
        await queryClient.invalidateQueries({ 
          queryKey: ["/api/okr-cycles"]
        });

        toast({ title: "Objective erfolgreich erstellt" });
        form.reset();
        onSuccess?.();

        // Redirect to the new objective's detail page
        setLocation(`/all-okrs/${newObjective.id}`);

      } catch (error) {
        console.error("Error in cycle creation:", error);
        toast({
          title: "Fehler beim Erstellen des OKR-Zyklus",
          description: error instanceof Error ? error.message : "Unbekannter Fehler",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error in form submission:", error);
      toast({
        title: "Fehler beim Erstellen des Objective",
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
                <Input placeholder="Umsatz um 20% steigern" {...field} />
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
                  placeholder="Beschreiben Sie das Ziel und den gewünschten Outcome" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="quarter"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quartal</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Quartal auswählen" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectGroup>
                      {quarters.map((quarter) => (
                        <SelectItem key={quarter.value} value={quarter.value}>
                          {quarter.label}
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
            name="year"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Jahr</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Jahr auswählen" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectGroup>
                      {years.map((year) => (
                        <SelectItem key={year} value={year}>
                          20{year}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
          name="userId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Benutzer (optional)</FormLabel>
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
          <Button type="submit">Objective erstellen</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}