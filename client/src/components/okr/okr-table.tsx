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

  if (isLoadingCycles || isLoadingObjectives) {
    return <div className="text-center py-8">Lade OKRs...</div>;
  }

  // Kombiniere Objectives mit ihren Zyklen
  const objectivesWithCycles = objectives.map(objective => ({
    ...objective,
    cycle: cycles.find(cycle => cycle.id === objective.cycleId)
  }));

  // Sortiere nach Titel
  const sortedObjectives = [...objectivesWithCycles].sort((a, b) => 
    a.title.localeCompare(b.title)
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Titel</TableHead>
          <TableHead>Beschreibung</TableHead>
          <TableHead>Zyklus</TableHead>
          <TableHead className="w-[200px]">Fortschritt</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedObjectives.map((objective) => {
          // Berechne den Fortschritt (Dummy-Wert, später durch echte Berechnung ersetzen)
          const progress = Math.floor(Math.random() * 100);

          return (
            <TableRow key={objective.id}>
              <TableCell className="font-medium">
                {objective.title}
              </TableCell>
              <TableCell>{objective.description || "-"}</TableCell>
              <TableCell>
                {objective.cycle ? (
                  <div className="text-sm">
                    <div>{objective.cycle.title}</div>
                    <div className="text-muted-foreground">
                      {formatDate(new Date(objective.cycle.startDate))} - {formatDate(new Date(objective.cycle.endDate))}
                    </div>
                  </div>
                ) : "-"}
              </TableCell>
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
  );
}