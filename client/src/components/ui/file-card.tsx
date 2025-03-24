import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface FileCardProps extends HTMLAttributes<HTMLDivElement> {
  cutoutSize?: number;
  radius?: number;
  archived?: boolean;
}

const FileCard = forwardRef<HTMLDivElement, FileCardProps>(
  ({ className, children, cutoutSize = 22, radius = 8, archived = false, ...props }, ref) => {
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
        }}
        {...props}
      >
        {/* Gefaltete Ecke in der oberen rechten Ecke wie im Sidebar-Icon */}
        <div 
          className={cn(
            "absolute top-0 right-0 w-0 h-0 transition-colors",
            archived ? "border-gray-300" : "border-primary/20"
          )}
          style={{
            borderStyle: 'solid',
            borderWidth: `0 ${cutoutSize}px ${cutoutSize}px 0`,
            borderColor: 'transparent',
            borderRightColor: archived ? '#f5f5f5' : '#f0f9ff',
          }}
        />
        <div
          className={cn(
            "absolute transition-colors",
            archived ? "border-gray-300" : "border-primary/10"
          )}
          style={{
            top: 0,
            right: 0,
            width: `${cutoutSize}px`,
            height: `${cutoutSize}px`,
            borderBottom: `1px solid ${archived ? '#e5e7eb' : '#e6f1fc'}`,
            borderLeft: `1px solid ${archived ? '#e5e7eb' : '#e6f1fc'}`,
            borderBottomLeftRadius: `${radius}px`,
            transform: 'rotate(-90deg) translate(-100%, 0)',
            transformOrigin: 'top left',
          }}
        />
        {children}
      </div>
    );
  }
);

FileCard.displayName = "FileCard";

export { FileCard };