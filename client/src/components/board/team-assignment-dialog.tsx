import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Team } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

interface TeamAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: number;
  currentTeams: {
    id: number;
    name: string;
    role: string;
  }[];
  allTeams: Team[];
}

export function TeamAssignmentDialog({
  open,
  onOpenChange,
  boardId,
  currentTeams,
  allTeams,
}: TeamAssignmentDialogProps) {
  const { toast } = useToast();
  const [selectedTeams, setSelectedTeams] = useState<number[]>(
    currentTeams.map(team => team.id)
  );

  const updateTeams = useMutation({
    mutationFn: async (teamIds: number[]) => {
      return await apiRequest("PATCH", `/api/boards/${boardId}/teams`, { teamIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
      toast({ title: "Teams erfolgreich aktualisiert" });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Aktualisieren der Teams",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTeamToggle = (teamId: number) => {
    setSelectedTeams(prev =>
      prev.includes(teamId)
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const handleSave = () => {
    updateTeams.mutate(selectedTeams);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Teams zuweisen</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-4">
            {allTeams.map((team) => (
              <div key={team.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`team-${team.id}`}
                  checked={selectedTeams.includes(team.id)}
                  onCheckedChange={() => handleTeamToggle(team.id)}
                />
                <label
                  htmlFor={`team-${team.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {team.name}
                </label>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={updateTeams.isPending}>
            {updateTeams.isPending ? "Speichert..." : "Speichern"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
