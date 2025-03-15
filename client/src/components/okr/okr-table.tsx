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
import { type Objective, type OkrCycle, type KeyResult } from "@shared/schema";
import { useLocation } from "wouter";

export function OkrTable() {
  const [, setLocation] = useLocation();

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

  // Fetch key results for all objectives
  const { data: allKeyResults = [], isLoading: isLoadingKeyResults } = useQuery<KeyResult[]>({
    queryKey: ["/api/key-results"],
    queryFn: async () => {
      const response = await fetch("/api/key-results");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Key Results");
      }
      return response.json();
    },
  });

  if (isLoadingCycles || isLoadingObjectives || isLoadingKeyResults) {
    return <div className="text-center py-8">Lade OKRs...</div>;
  }

  // Kombiniere Objectives mit ihren Zyklen und Key Results
  const objectivesWithData = objectives.map(objective => {
    const cycle = cycles.find(cycle => cycle.id === objective.cycleId);
    const keyResults = allKeyResults.filter(kr => kr.objectiveId === objective.id);

    // Berechne den Gesamtfortschritt aus den Key Results
    const progress = keyResults.length > 0
      ? Math.round(keyResults.reduce((sum, kr) => sum + (kr.currentValue || 0), 0) / keyResults.length)
      : 0;

    return {
      ...objective,
      cycle,
      progress
    };
  });

  // Sortiere nach Titel
  const sortedObjectives = [...objectivesWithData].sort((a, b) => 
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
        {sortedObjectives.map((objective) => (
          <TableRow 
            key={objective.id} 
            className="h-12 cursor-pointer hover:bg-muted/50"
            onClick={() => setLocation(`/okr/${objective.id}`)}
          >
            <TableCell className="font-medium py-2">
              {objective.title}
            </TableCell>
            <TableCell className="py-2">{objective.description || "-"}</TableCell>
            <TableCell className="py-2">
              {objective.cycle ? objective.cycle.title : "-"}
            </TableCell>
            <TableCell className="py-2">
              <div className="flex items-center gap-4">
                <Progress value={objective.progress} className="flex-1" />
                <span className="text-sm text-muted-foreground w-12 text-right">
                  {objective.progress}%
                </span>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}