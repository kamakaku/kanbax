import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

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
          "folder relative overflow-hidden transition-all duration-300",
          archived ? "opacity-70" : "opacity-100", 
          className
        )}
        style={{
          position: 'relative',
        }}
        {...props}
      >
        {/* Folder with tab */}
        <div 
          className={cn(
            "absolute inset-0 rounded-t-md",
            archived ? "bg-gray-200" : "bg-primary/10"
          )}
          style={{
            height: '20px',
            borderTopLeftRadius: `${radius}px`,
            borderTopRightRadius: `${radius}px`,
          }}
        />
        <div
          className={cn(
            "relative pt-5 rounded-md border",
            archived ? "border-gray-300 bg-gray-100" : "border-primary/20 bg-white"
          )}
          style={{
            borderRadius: `${radius}px`,
            boxShadow: archived ? 'none' : '0 2px 4px rgba(0,0,0,0.05)'
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