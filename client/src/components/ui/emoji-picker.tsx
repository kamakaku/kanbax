import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Smile } from "lucide-react";

interface EmojiPickerProps {
  value?: string;
  onChange: (emoji: string) => void;
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="w-10 h-10"
        >
          {value ? (
            <span className="text-xl">{value}</span>
          ) : (
            <Smile className="h-4 w-4" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Picker
          data={data}
          onEmojiSelect={(emoji: any) => onChange(emoji.native)}
          theme="light"
        />
      </PopoverContent>
    </Popover>
  );
}
