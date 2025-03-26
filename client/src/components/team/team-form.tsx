import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type InsertTeam, insertTeamSchema } from "@shared/schema";
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
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { DialogMultiSelect, type Option } from "@/components/ui/dialog-multi-select";
import { type User } from "@shared/schema";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-store";

interface TeamFormProps {
  open: boolean;
  onClose: () => void;
  defaultValues?: Partial<InsertTeam>;
  onSubmit?: (data: InsertTeam) => Promise<void>;
}

export function TeamForm({ open, onClose, defaultValues, onSubmit }: TeamFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch available users
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

  const form = useForm<InsertTeam>({
    resolver: zodResolver(insertTeamSchema),
    defaultValues: {
      name: "",
      description: "",
      member_ids: [], // Umbenannt von memberIds zu member_ids
      companyId: user?.companyId || 0, 
      creatorId: user?.id || 0,
    },
  });

  // Reset form when defaultValues change
  useEffect(() => {
    if (defaultValues) {
      form.reset({
        name: defaultValues.name,
        description: defaultValues.description,
        member_ids: defaultValues.member_ids, // Umbenannt von memberIds zu member_ids
        companyId: defaultValues.companyId || user?.companyId || 0,
        creatorId: defaultValues.creatorId || user?.id || 0,
      });
    } else {
      form.reset({
        name: "",
        description: "",
        member_ids: [], // Umbenannt von memberIds zu member_ids
        companyId: user?.companyId || 0,
        creatorId: user?.id || 0,
      });
    }
  }, [defaultValues, form.reset, user]);

  const handleSubmit = async (data: InsertTeam) => {
    try {
      console.log("Submitting team data:", JSON.stringify(data, null, 2));

      // Sicherstellen, dass creatorId und companyId gesetzt sind
      const teamData = {
        ...data,
        creatorId: data.creatorId || user?.id || 0,
        companyId: data.companyId || user?.companyId || 0,
        // Umbenannt von memberIds zu member_ids, aber strings als strings lassen
        member_ids: data.member_ids || [] 
      };
      
      console.log("Prepared team data:", JSON.stringify(teamData, null, 2));

      if (onSubmit) {
        await onSubmit(teamData);
      } else {
        const res = await fetch('/api/teams', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(teamData)
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || "Failed to create team");
        }

        await queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
        toast({ title: "Team erfolgreich erstellt" });
        form.reset();
        onClose();
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Das Team konnte nicht erstellt werden",
        variant: "destructive",
      });
      console.error("Form submission error:", error);
    }
  };

  // Finde den Creator-Namen, wenn das Team bearbeitet wird
  const getCreatorName = () => {
    if (!defaultValues?.creatorId) return user?.username || "Unbekannt";
    
    const creator = users.find(u => u.id === defaultValues.creatorId);
    return creator?.username || user?.username || "Unbekannt";
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-0">
        <div className="p-6 pb-0">
          <DialogTitle>
            {defaultValues ? "Team bearbeiten" : "Neues Team erstellen"}
          </DialogTitle>
          {defaultValues && (
            <div className="text-sm text-muted-foreground mt-1">
              Erstellt von <span className="font-medium">{getCreatorName()}</span>
              {defaultValues.creatorId === user?.id && " (Sie)"}
            </div>
          )}
        </div>
        
        <div className="overflow-y-auto px-6 pb-0 pt-2" style={{ maxHeight: "calc(85vh - 160px)" }}>
          <Form {...form}>
            <form id="team-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Entwicklungsteam" {...field} />
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
                        placeholder="Beschreiben Sie das Team..."
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
                name="member_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Team-Mitglieder</FormLabel>
                    <FormControl>
                      <DialogMultiSelect
                        options={userOptions}
                        selected={field.value || []}
                        onChange={field.onChange}
                        placeholder="Mitglieder auswählen"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
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
            form="team-form"
            className="bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-md transition-all duration-300 hover:shadow-lg"
          >
            {defaultValues ? "Team aktualisieren" : "Team erstellen"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}