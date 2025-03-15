import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { type InsertOkrCycle } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const okrCycleFormSchema = z.object({
  quarter: z.string().min(1, "Quartal ist erforderlich"),
  year: z.string().min(1, "Jahr ist erforderlich"),
});

interface OkrCycleFormProps {
  onSuccess?: () => void;
}

export function OkrCycleForm({ onSuccess }: OkrCycleFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Generate a list of years (current year + 5 years)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => (currentYear + i).toString().slice(-2));

  const quarters = [
    { value: "Q1", label: "Q1 (Jan-Mär)" },
    { value: "Q2", label: "Q2 (Apr-Jun)" },
    { value: "Q3", label: "Q3 (Jul-Sep)" },
    { value: "Q4", label: "Q4 (Okt-Dez)" },
  ];

  const form = useForm<z.infer<typeof okrCycleFormSchema>>({
    resolver: zodResolver(okrCycleFormSchema),
    defaultValues: {
      quarter: "",
      year: new Date().getFullYear().toString().slice(-2),
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

  async function onSubmit(values: z.infer<typeof okrCycleFormSchema>) {
    try {
      const { startDate, endDate } = getDateRange(values.quarter, values.year);

      const payload: InsertOkrCycle = {
        title: `${values.quarter} ${values.year}`,
        startDate,
        endDate,
        status: "active",
      };

      console.log("Submitting OKR cycle:", payload);

      await apiRequest("POST", "/api/okr-cycles", payload);

      await queryClient.invalidateQueries({ 
        queryKey: ["/api/okr-cycles"]
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

        <DialogFooter>
          <Button type="submit">OKR-Zyklus erstellen</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}