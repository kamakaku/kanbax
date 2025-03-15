import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { type Objective, type OkrCycle } from "@shared/schema";
import { formatDate } from "@/lib/utils";

export function OkrTable() {
  // Fetch OKR cycles and objectives
  const { data: cycles = [], isLoading: isLoadingCycles } = useQuery<OkrCycle[]>({
    queryKey: ["/api/okr-cycles"],
    queryFn: async () => {
      const response = await fetch("/api/okr-cycles");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der OKR-Zyklen");
      }
      return response.json();
    },
  });

  const { data: objectives = [], isLoading: isLoadingObjectives } = useQuery<Objective[]>({
    queryKey: ["/api/objectives"],
    queryFn: async () => {
      const response = await fetch("/api/objectives");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Objectives");
      }
      return response.json();
    },
  });

  // Gruppiere Objectives nach Cycles
  const objectivesByCycle = cycles.map(cycle => ({
    cycle,
    objectives: objectives.filter(obj => obj.cycleId === cycle.id)
  }));

  if (isLoadingCycles || isLoadingObjectives) {
    return <div className="text-center py-8">Lade OKRs...</div>;
  }

  if (cycles.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Keine OKR-Zyklen gefunden.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {objectivesByCycle.map(({ cycle, objectives }) => (
        <div key={cycle.id} className="rounded-lg border shadow-sm">
          <div className="bg-muted/50 p-4 rounded-t-lg">
            <h3 className="text-lg font-semibold">{cycle.title}</h3>
            <p className="text-sm text-muted-foreground">
              {formatDate(new Date(cycle.startDate))} - {formatDate(new Date(cycle.endDate))}
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Objective</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead className="w-[200px]">Fortschritt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {objectives.map((objective) => {
                // Berechne den Fortschritt (Dummy-Wert, später durch echte Berechnung ersetzen)
                const progress = Math.floor(Math.random() * 100);

                return (
                  <TableRow key={objective.id}>
                    <TableCell className="font-medium">
                      {objective.title}
                    </TableCell>
                    <TableCell>{objective.description}</TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Progress value={progress} />
                        <p className="text-sm text-right text-muted-foreground">
                          {progress}%
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
}