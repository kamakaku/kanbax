import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { 
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Task } from "@shared/schema";

interface TaskDialogProps {
  task?: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: (task: Task) => Promise<void>;
  mode?: "edit" | "details";
  initialColumnId?: number;
  personalTask?: boolean;
  isPersonalTask?: boolean; 
}

export function TaskDialog({
  task,
  open,
  onOpenChange,
  onUpdate,
  mode = task ? "details" : "edit",
  initialColumnId,
  personalTask = false,
  isPersonalTask = personalTask,
}: TaskDialogProps) {
  const [isEditMode, setIsEditMode] = useState(mode === "edit");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-6">
        <DialogTitle>
          {task ? "Aufgabe Details" : "Neue Aufgabe"}
        </DialogTitle>
        
        <div className="py-4">
          <p>Dies ist eine vereinfachte Version des Task-Dialogs, bis wir das Problem mit dem originalen beheben.</p>
          {task && (
            <div className="mt-4">
              <h3 className="font-medium">{task.title}</h3>
              <p className="text-sm text-gray-500">{task.description}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}