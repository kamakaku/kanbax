import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface FileCardProps extends HTMLAttributes<HTMLDivElement> {
  cutoutSize?: number;
  radius?: number;
  archived?: boolean;
}

const FileCard = forwardRef<HTMLDivElement, FileCardProps>(
  ({ className, children, cutoutSize = 25, radius = 8, archived = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden border transition-all duration-300",
          archived ? "border-gray-200 bg-gray-50/50" : "border-primary/10 hover:border-primary/20",
          className
        )}
        style={{
          borderRadius: `${radius}px`,
          position: 'relative'
        }}
        {...props}
      >
        {/* Dokument-Ecke nach CodePen-Beispiel */}
        <div 
          className={cn(
            "absolute top-0 right-0 w-0 h-0 z-10",
            archived ? "text-gray-100" : "text-primary/5"
          )}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 0,
            height: 0,
            borderStyle: 'solid',
            borderWidth: `0 ${cutoutSize}px ${cutoutSize}px 0`,
            borderColor: 'transparent',
            borderRightColor: 'currentColor'
          }}
        />
        <div
          className={cn(
            "absolute z-20",
            archived ? "text-gray-300" : "text-primary/20"
          )}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 0,
            height: 0,
            borderStyle: 'solid',
            borderWidth: `0 ${cutoutSize}px ${cutoutSize}px 0`,
            borderColor: 'transparent',
            borderRightColor: 'white'
          }}
        />
        {children}
      </div>
    );
  }
);

FileCard.displayName = "FileCard";

export { FileCard };