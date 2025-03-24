import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Layers } from "lucide-react";

export interface FileCardProps extends HTMLAttributes<HTMLDivElement> {
  cutoutSize?: number;
  radius?: number;
  archived?: boolean;
}

const FileCard = forwardRef<HTMLDivElement, FileCardProps>(
  ({ className, children, cutoutSize = 40, radius = 8, archived = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "project-card relative overflow-hidden transition-all duration-300",
          archived ? "opacity-80" : "opacity-100", 
          className
        )}
        style={{
          position: 'relative',
        }}
        {...props}
      >
        {/* Projekt-Container mit Stacked-Look */}
        <div 
          className={cn(
            "absolute top-0 left-0 right-0 h-full rounded-lg transform rotate-1 -z-10",
            archived ? "bg-gray-200" : "bg-primary/5"
          )}
          style={{
            borderRadius: `${radius}px`,
          }}
        />
        <div 
          className={cn(
            "absolute top-0 left-0 right-0 h-full rounded-lg transform -rotate-1 -z-10",
            archived ? "bg-gray-300" : "bg-primary/10"
          )}
          style={{
            borderRadius: `${radius}px`,
          }}
        />
        
        {/* Icon für gestapelte Projekt-Elemente */}
        <div className="absolute -top-2 -right-2 z-10">
          <div className={cn(
            "rounded-full p-1.5",
            archived ? "bg-gray-300" : "bg-primary/20"
          )}>
            <Layers className={cn(
              "h-4 w-4",
              archived ? "text-gray-500" : "text-primary"
            )} />
          </div>
        </div>
        
        {/* Hauptprojekt-Container */}
        <div
          className={cn(
            "relative rounded-lg border transform transition-all shadow-sm",
            archived 
              ? "border-gray-300 bg-gray-100" 
              : "border-primary/20 bg-white hover:shadow-md hover:-translate-y-0.5"
          )}
          style={{
            borderRadius: `${radius}px`,
          }}
        >
          {children}
        </div>
      </div>
    );
  }
);

FileCard.displayName = "FileCard";

export { FileCard };