import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useContext, useEffect, useState } from "react";
import { Board, Task, User, insertTaskSchema } from "@shared/schema";
import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { BoardContext } from "@/context/board-context";
import { apiRequest } from "@/lib/api-request";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle, DialogContent } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
  onUpdate?: (task: Task) => Promise<void>;
  task?: Task | null;
}

export function TaskDialog({ open, onClose, onUpdate, task }: TaskDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentBoard } = useContext(BoardContext);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const isEditMode = !!task;

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) {
        throw new Error("Failed to fetch users");
      }
      return res.json();
    },
    enabled: open,
  });

  const { data: boards = [] } = useQuery<Board[]>({
    queryKey: ["/api/boards"],
    queryFn: async () => {
      const res = await fetch("/api/boards");
      if (!res.ok) {
        throw new Error("Failed to fetch boards");
      }
      return res.json();
    },
    enabled: open,
  });

  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/boards", currentBoard?.id, "tasks"],
    queryFn: async () => {
      if (!currentBoard?.id) return [];
      const res = await fetch(`/api/boards/${currentBoard.id}/tasks`);
      if (!res.ok) {
        throw new Error("Failed to fetch tasks");
      }
      return res.json();
    },
    enabled: !!currentBoard?.id && open,
  });

  const availableLabels = Array.from(
    new Set(allTasks.flatMap((t) => t.labels || []))
  );

  const form = useForm({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      boardId: currentBoard?.id || 0,
      columnId: 0,
      order: 0,
      labels: [],
      dueDate: null,
    },
  });

  useEffect(() => {
    if (isEditMode && task && open) {
      // If editing an existing task
      form.reset({
        title: task.title,
        description: task.description || "",
        status: task.status,
        priority: task.priority,
        boardId: task.boardId,
        columnId: task.columnId,
        order: task.order,
        dueDate: task.dueDate,
        labels: task.labels || [],
      });
      setSelectedUserIds(task.assignedUserIds || []);
      setSelectedLabels(task.labels || []);
    } else if (open && currentBoard) {
      // If creating a new task
      form.reset({
        title: "",
        description: "",
        status: "todo",
        priority: "medium",
        boardId: currentBoard.id,
        columnId: 0,
        order: 0,
        dueDate: null,
        labels: [],
      });
      setSelectedUserIds([]);
      setSelectedLabels([]);
    }
  }, [task, open, form, currentBoard, isEditMode]);

  const handleSubmit = async (values: any) => {
    try {
      const boardId = values.boardId || currentBoard?.id;
      if (!boardId) {
        throw new Error("Board ID is required");
      }

      const method = isEditMode ? "PATCH" : "POST";
      const endpoint = isEditMode ? `/api/tasks/${task.id}` : `/api/boards/${boardId}/tasks`;

      const payload = {
        ...values,
        boardId,
        labels: selectedLabels,
        assignedUserIds: selectedUserIds,
      };

      const response = await apiRequest(method, endpoint, payload);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to save task");
      }

      const updatedTask = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/boards", currentBoard?.id, "tasks"] });

      if (onUpdate) {
        await onUpdate(updatedTask);
      }

      toast({
        title: isEditMode ? "Aufgabe aktualisiert" : "Aufgabe erstellt",
        description: isEditMode ? "Die Aufgabe wurde erfolgreich aktualisiert." : "Die Aufgabe wurde erfolgreich erstellt."
      });

      onClose();
    } catch (error: any) {
      console.error("Task save error:", error);
      toast({
        title: "Fehler",
        description: error.message || "Die Aufgabe konnte nicht gespeichert werden",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Aufgabe bearbeiten" : "Neue Aufgabe erstellen"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Title Field */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titel</FormLabel>
                  <FormControl>
                    <Input placeholder="Aufgabentitel eingeben" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description Field */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschreibung</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Beschreibung eingeben..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Board Field */}
            <FormField
              control={form.control}
              name="boardId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Board</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    value={field.value?.toString()}
                    disabled={isEditMode}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Board auswählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {boards.map((board) => (
                        <SelectItem key={board.id} value={board.id.toString()}>
                          {board.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status Field */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Status auswählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="backlog">Backlog</SelectItem>
                      <SelectItem value="todo">Zu erledigen</SelectItem>
                      <SelectItem value="in-progress">In Bearbeitung</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                      <SelectItem value="done">Erledigt</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Priority Field */}
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priorität</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Priorität auswählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Niedrig</SelectItem>
                      <SelectItem value="medium">Mittel</SelectItem>
                      <SelectItem value="high">Hoch</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Labels Field */}
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="labels">Labels</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="justify-between w-full">
                    Labels auswählen
                    <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>Verfügbare Labels</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {availableLabels.map((label) => (
                    <DropdownMenuCheckboxItem
                      key={label}
                      checked={selectedLabels.includes(label)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedLabels([...selectedLabels, label]);
                        } else {
                          setSelectedLabels(
                            selectedLabels.filter((l) => l !== label)
                          );
                        }
                      }}
                    >
                      {label}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <div className="p-2">
                    <Input
                      placeholder="Neues Label hinzufügen"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const value = e.currentTarget.value.trim();
                          if (value && !selectedLabels.includes(value)) {
                            setSelectedLabels([...selectedLabels, value]);
                            e.currentTarget.value = "";
                          }
                        }
                      }}
                    />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              {selectedLabels.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedLabels.map((label) => (
                    <Badge
                      key={label}
                      variant="secondary"
                      className="px-2 py-0.5 text-xs"
                    >
                      {label}
                      <button
                        type="button"
                        className="ml-1 text-xs"
                        onClick={() => {
                          setSelectedLabels(
                            selectedLabels.filter((l) => l !== label)
                          );
                        }}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Due Date Field */}
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fälligkeitsdatum</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(new Date(field.value), "PPP")
                          ) : (
                            <span>Datum auswählen</span>
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? new Date(field.value) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            field.onChange(date.toISOString().split('T')[0]);
                          } else {
                            field.onChange(null);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Assigned Users Field */}
            <div className="space-y-1.5">
              <Label>Benutzer zuweisen</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="justify-between w-full"
                  >
                    {selectedUserIds.length > 0
                      ? `${selectedUserIds.length} Benutzer zugewiesen`
                      : "Benutzer zuweisen"}
                    <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-full">
                  <Command>
                    <CommandInput placeholder="Benutzer suchen..." />
                    <CommandEmpty>Keine Benutzer gefunden.</CommandEmpty>
                    <CommandGroup>
                      {users.map((user) => (
                        <CommandItem
                          key={user.id}
                          value={user.username}
                          onSelect={() => {
                            const isSelected = selectedUserIds.includes(user.id);
                            if (isSelected) {
                              setSelectedUserIds(
                                selectedUserIds.filter((id) => id !== user.id)
                              );
                            } else {
                              setSelectedUserIds([...selectedUserIds, user.id]);
                            }
                          }}
                        >
                          <CheckIcon
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedUserIds.includes(user.id)
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {user.username}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedUserIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedUserIds.map((userId) => {
                    const user = users.find((u) => u.id === userId);
                    return (
                      <Badge
                        key={userId}
                        variant="secondary"
                        className="px-2 py-0.5 text-xs"
                      >
                        {user?.username || `Benutzer #${userId}`}
                        <button
                          type="button"
                          className="ml-1 text-xs"
                          onClick={() => {
                            setSelectedUserIds(
                              selectedUserIds.filter((id) => id !== userId)
                            );
                          }}
                        >
                          ×
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

            <Button type="submit" className="w-full">
              {isEditMode ? "Aufgabe aktualisieren" : "Aufgabe erstellen"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}