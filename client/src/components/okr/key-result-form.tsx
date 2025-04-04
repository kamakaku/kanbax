import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { type KeyResult, type Project, type Team, type User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
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
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect, type Option } from "@/components/ui/multi-select";
import { apiRequest } from "@/lib/queryClient";
import { MinusCircle, PlusCircle } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";

// Sicherstellen, dass wir alle Feldtypen korrekt abbilden
const keyResultSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  description: z.string().optional().nullable(),
  targetValue: z.number().min(0, "Zielwert muss größer als 0 sein"),
  currentValue: z.number().min(0).optional().nullable(),
  type: z.string().default("percentage"), // Flexibler mit string statt enum
  status: z.string().default("active"), // Flexibler mit string statt enum
  projectId: z.string().optional(),
  teamId: z.string().optional(),
  userIds: z.array(z.string()).default([]),
  taskId: z.string().optional(),
  checklistItems: z.array(z.object({
    title: z.string(),
    completed: z.boolean().default(false)
  })).optional(),
});

type KeyResultFormData = z.infer<typeof keyResultSchema>;

// Erweitere die KeyResult-Schnittstelle für unseren speziellen Anwendungsfall
interface ExtendedKeyResult extends KeyResult {
  projectId?: number | null;
  teamId?: number | null;
  userIds?: number[] | null;
  taskId?: number | null;
}

interface KeyResultFormProps {
  objectiveId: number;
  keyResult?: ExtendedKeyResult;
  onSuccess?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyResultForm({ objectiveId, keyResult, onSuccess, open, onOpenChange }: KeyResultFormProps) {
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

  // Safer defaultValues-Behandlung mit expliziten Eigenschaften
  const form = useForm<KeyResultFormData>({
    resolver: zodResolver(keyResultSchema),
    defaultValues: keyResult ? {
      title: keyResult.title,
      description: keyResult.description,
      targetValue: keyResult.targetValue,
      currentValue: keyResult.currentValue,
      type: keyResult.type,
      status: keyResult.status,
      // Explizite Typumwandlung für optionale Eigenschaften
      projectId: (keyResult as ExtendedKeyResult).projectId?.toString(),
      teamId: (keyResult as ExtendedKeyResult).teamId?.toString(),
      userIds: (keyResult as ExtendedKeyResult).userIds?.map((id: number) => id.toString()) || [],
      taskId: (keyResult as ExtendedKeyResult).taskId?.toString(),
      checklistItems: keyResult.checklistItems?.map(item => 
        typeof item === 'string' ? JSON.parse(item) : item
      ) || [],
    } : {
      title: "",
      description: "",
      targetValue: 100,
      currentValue: 0,
      type: "percentage",
      status: "active",
      projectId: undefined,
      teamId: undefined,
      userIds: [],
      taskId: undefined,
      checklistItems: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "checklistItems",
  });

  const mutation = useMutation({
    mutationFn: async (data: KeyResultFormData) => {
      const endpoint = keyResult 
        ? `/api/key-results/${keyResult.id}`
        : `/api/objectives/${objectiveId}/key-results`;

      const method = keyResult ? "PATCH" : "POST";

      const payload = {
        ...data,
        objectiveId,
        projectId: data.projectId ? parseInt(data.projectId) : null,
        teamId: data.teamId ? parseInt(data.teamId) : null,
        userIds: data.userIds.map((id: string) => parseInt(id)),
        taskId: data.taskId ? parseInt(data.taskId) : null
      };

      // Die apiRequest Funktion aus queryClient.ts wirft bereits einen Fehler, wenn die Antwort nicht ok ist
      // und gibt das JSON-Ergebnis direkt zurück
      return await apiRequest<KeyResult>(method, endpoint, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/objectives", objectiveId, "key-results"],
      });
      toast({ title: `Key Result erfolgreich ${keyResult ? 'aktualisiert' : 'erstellt'}` });
      form.reset();
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      console.error("Key result mutation error:", error);
      toast({
        title: `Fehler beim ${keyResult ? 'Aktualisieren' : 'Erstellen'} des Key Results`,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] flex flex-col p-0 sm:rounded-lg overflow-hidden">
        <div className="px-6 pt-6 pb-2">
          <DialogTitle>
            {keyResult ? "Key Result bearbeiten" : "Neues Key Result erstellen"}
          </DialogTitle>
        </div>
        
        <div className="px-6 pb-6 overflow-y-auto" style={{ maxHeight: "calc(85vh - 10rem)" }}>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
              className="space-y-4"
            >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titel</FormLabel>
                  <FormControl>
                    <Input placeholder="Key Result Titel" {...field} />
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
                      placeholder="Beschreiben Sie das Key Result..."
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
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Typ</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Wählen Sie einen Typ" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="percentage">Prozentual</SelectItem>
                      <SelectItem value="checkbox">Checkbox</SelectItem>
                      <SelectItem value="progress">Fortschritt</SelectItem>
                      <SelectItem value="checklist">Checkliste</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Wählen Sie einen Status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Aktiv</SelectItem>
                      <SelectItem value="completed">Abgeschlossen</SelectItem>
                      <SelectItem value="archived">Archiviert</SelectItem>
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
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id.toString()}>
                          {team.name}
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

            <FormField
              control={form.control}
              name="targetValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zielwert</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("type") === "checklist" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <FormLabel>Checklisten-Items</FormLabel>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-sm transition-all duration-300 hover:shadow-md"
                    onClick={() => append({ title: "", completed: false })}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Item hinzufügen
                  </Button>
                </div>
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <FormField
                      control={form.control}
                      name={`checklistItems.${index}.title`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input placeholder="Item Beschreibung" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                    >
                      <MinusCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

  
          </form>
          </Form>
        </div>
        
        <div className="border-t px-6 py-4 bg-background flex items-center justify-end gap-2 w-full sm:rounded-b-lg">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
          <Button
            type="submit"
            disabled={mutation.isPending}
            className="bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-md transition-all duration-300 hover:shadow-lg"
            onClick={form.handleSubmit((data) => mutation.mutate(data))}
          >
            {mutation.isPending
              ? keyResult ? "Wird aktualisiert..." : "Wird erstellt..."
              : keyResult ? "Key Result aktualisieren" : "Key Result erstellen"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}