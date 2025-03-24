import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface FileCardProps extends HTMLAttributes<HTMLDivElement> {
  cutoutSize?: number;
  radius?: number;
  archived?: boolean;
}

const FileCard = forwardRef<HTMLDivElement, FileCardProps>(
  ({ className, children, cutoutSize = 30, radius = 10, archived = false, ...props }, ref) => {
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
          // Clip-path erstellt die Aussparung in der oberen rechten Ecke
          clipPath: `
            polygon(
              0% 0%,
              calc(100% - ${cutoutSize + radius}px) 0%,
              calc(100% - ${cutoutSize + radius}px) ${radius}px,
              calc(100% - ${radius}px) ${radius}px,
              calc(100% - ${radius}px) ${cutoutSize}px,
              100% ${cutoutSize}px,
              100% 100%,
              0% 100%
            )
          `
        }}
        {...props}
      >
        {/* Das ist ein dekorativer Kreis für die Tab-Aussparung */}
        <div 
          className={cn(
            "absolute w-6 h-6 border-r border-b transition-colors",
            archived ? "border-gray-300" : "border-primary/20"
          )}
          style={{
            right: 0,
            top: 0,
            borderBottomRightRadius: `${radius}px`,
            borderTopLeftRadius: `${radius}px`,
            width: `${cutoutSize}px`,
            height: `${cutoutSize}px`,
          }}
        />
        {children}
      </div>
    );
  }
);

FileCard.displayName = "FileCard";

export { FileCard };