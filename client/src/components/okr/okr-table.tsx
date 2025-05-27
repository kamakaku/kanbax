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
import { ChevronRight, ChevronDown, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function OkrTable() {
  const [, setLocation] = useLocation();
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

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

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/current-user"],
  });

  const currentUser = useAuth()?.user;

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
      keyResults,
      progress
    };
  });

  // Sortiere nach Titel
  const sortedObjectives = [...objectivesWithData].sort((a, b) => 
    a.title.localeCompare(b.title)
  );

  const toggleRow = (objectiveId: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(objectiveId)) {
        newSet.delete(objectiveId);
      } else {
        newSet.add(objectiveId);
      }
      return newSet;
    });
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[30px]"></TableHead>
          <TableHead>Titel</TableHead>
          <TableHead>Beschreibung</TableHead>
          <TableHead>Zyklus</TableHead>
          <TableHead className="w-[200px]">Fortschritt</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedObjectives.map((objective) => (
          <>
            <TableRow 
              key={objective.id} 
              className={cn(
                "h-12 hover:bg-muted/50",
                objective.progress === 100 && "bg-green-50 hover:bg-green-100"
              )}
            >
              <TableCell className="p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => toggleRow(objective.id)}
                >
                  {expandedRows.has(objective.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </TableCell>
              <TableCell 
                className="font-medium py-2 cursor-pointer"
                onClick={() => setLocation(`/all-okrs/${objective.id}`)}
              >
                <div className="flex items-center gap-2">
                  {objective.title}
                  {objective.progress === 100 && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                </div>
              </TableCell>
              <TableCell className="py-2">{objective.description || "-"}</TableCell>
              <TableCell className="py-2">
                {objective.cycle ? objective.cycle.title : "-"}
              </TableCell>
              <TableCell className="py-2">
                <div className="flex items-center gap-4">
                  <Progress 
                    value={objective.progress} 
                    className={cn(
                      "flex-1",
                      objective.progress === 100 && "bg-green-100 [&>[role=progressbar]]:bg-green-500"
                    )}
                  />
                  <span className="text-sm text-muted-foreground w-12 text-right">
                    {objective.progress}%
                  </span>
                </div>
              </TableCell>
            </TableRow>
            {expandedRows.has(objective.id) && objective.keyResults.map((kr) => (
              <TableRow 
                key={`kr-${kr.id}`} 
                className={cn(
                  "bg-muted/30",
                  (kr.currentValue || 0) === 100 && "bg-green-50"
                )}
              >
                <TableCell></TableCell>
                <TableCell colSpan={2} className="py-2">
                  <div className="pl-4">
                    <div className="font-medium flex items-center gap-2">
                      {kr.title}
                      {(kr.currentValue || 0) === 100 && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{kr.description}</div>
                  </div>
                </TableCell>
                <TableCell className="py-2">
                  <div className="text-sm">{kr.type}</div>
                </TableCell>
                <TableCell className="py-2">
                  <div className="flex items-center gap-4">
                    <Progress 
                      value={kr.currentValue || 0} 
                      className={cn(
                        "flex-1",
                        (kr.currentValue || 0) === 100 && "bg-green-100 [&>[role=progressbar]]:bg-green-500"
                      )}
                    />
                    <span className="text-sm text-muted-foreground w-12 text-right">
                      {kr.currentValue || 0}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </>
        ))}
      </TableBody>
    </Table>
  );
}