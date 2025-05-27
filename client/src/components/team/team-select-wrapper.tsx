import { TeamSelect } from "./team-select";

interface TeamSelectWrapperProps {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  companyId?: number;
}

export function TeamSelectWrapper({ value, onChange, disabled, placeholder, companyId }: TeamSelectWrapperProps) {
  // Konvertiere string[] zu number[]
  const numericValue = value.map(v => parseInt(v, 10));
  
  // Konvertiere number[] zurück zu string[] beim Ändern
  const handleChange = (newValue: number[]) => {
    onChange(newValue.map(v => v.toString()));
  };
  
  return (
    <TeamSelect
      value={numericValue}
      onChange={handleChange}
      disabled={disabled}
      placeholder={placeholder}
      companyId={companyId}
    />
  );
}