import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { type InsertOkrCycle } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { DialogFooter } from "@/components/ui/dialog";

const okrCycleFormSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  startDate: z.string().min(1, "Startdatum ist erforderlich"),
  endDate: z.string().min(1, "Enddatum ist erforderlich"),
});

interface OkrCycleFormProps {
  projectId: number;
  onSuccess?: () => void;
}

export function OkrCycleForm({ projectId, onSuccess }: OkrCycleFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof okrCycleFormSchema>>({
    resolver: zodResolver(okrCycleFormSchema),
    defaultValues: {
      title: "",
      startDate: "",
      endDate: "",
    },
  });

  async function onSubmit(values: z.infer<typeof okrCycleFormSchema>) {
    try {
      const payload: InsertOkrCycle = {
        ...values,
        projectId,
        status: "active",
      };

      await apiRequest("POST", `/api/projects/${projectId}/okr-cycles`, payload);
      
      await queryClient.invalidateQueries({ 
        queryKey: [`/api/projects/${projectId}/okr-cycles`] 
      });

      toast({ title: "OKR-Zyklus erfolgreich erstellt" });
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error("Fehler beim Erstellen des OKR-Zyklus:", error);
      toast({
        title: "Fehler beim Erstellen des OKR-Zyklus",
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
                <Input placeholder="Q1 2024" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="startDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Startdatum</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="endDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Enddatum</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="submit">OKR-Zyklus erstellen</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
