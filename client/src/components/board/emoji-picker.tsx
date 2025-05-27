import { useState } from 'react';
import EmojiPickerReact from 'emoji-picker-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SmilePlus } from 'lucide-react';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  currentEmoji?: string;
}

export function EmojiPicker({ onEmojiSelect, currentEmoji }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
        >
          {currentEmoji ? (
            <span className="text-lg">{currentEmoji}</span>
          ) : (
            <SmilePlus className="h-4 w-4" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <EmojiPickerReact
          onEmojiClick={(emojiData) => {
            onEmojiSelect(emojiData.emoji);
            setIsOpen(false);
          }}
          width="100%"
          height={400}
        />
      </PopoverContent>
    </Popover>
  );
}
