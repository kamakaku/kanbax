import { UserSelect as UserSelectBase } from "@/components/user/user-select";
import { TeamSelect } from "@/components/team/team-select";

interface CustomUserSelectProps {
  selectedUserIds: number[];
  onUserSelectionChange: (userIds: number[]) => void;
  disabled?: boolean;
}

export function TaskUserSelect({ selectedUserIds, onUserSelectionChange, disabled }: CustomUserSelectProps) {
  return (
    <UserSelectBase
      value={selectedUserIds.map(id => id.toString())}
      onChange={(value) => onUserSelectionChange(value.map(id => parseInt(id)))}
      disabled={disabled}
    />
  );
}

interface CustomTeamSelectProps {
  selectedTeamId?: number | null;
  onTeamSelectionChange: (teamId: number | null) => void;
  disabled?: boolean;
}

export function TaskTeamSelect({ selectedTeamId, onTeamSelectionChange, disabled }: CustomTeamSelectProps) {
  // TeamSelect erwartet number[], aber wir müssen mit einem einzelnen Wert oder null umgehen
  return (
    <TeamSelect
      value={selectedTeamId ? [selectedTeamId] : []}
      onChange={(value) => onTeamSelectionChange(value.length > 0 ? value[0] : null)}
      disabled={disabled}
      placeholder="Team auswählen"
    />
  );
}