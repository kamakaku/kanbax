import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema, type InsertTask, type Project, type Board, type Task, type User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Clock, Paperclip, Plus, X } from "lucide-react";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { cn } from "@/lib/utils";
import { de } from 'date-fns/locale';
import { format } from "date-fns";
import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { TaskUserSelect, TaskTeamSelect } from "./task-select-components";

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (task: Task) => Promise<void>;
  projects: Project[];
  boards: Board[];
  existingTask?: Task | null;
  isPersonalTask?: boolean;
  initialColumnId?: number | null;
  mode?: 'edit' | 'details';
}

type TaskFormValues = {
  title: string;
  description: string;
  richDescription: string;
  status: "backlog" | "todo" | "in-progress" | "review" | "done";
  boardId: number;
  priority: "low" | "medium" | "high";
  labels: string[];
  columnId: number;
  order: number;
  startDate?: string | null;
  dueDate?: string | null;
  archived: boolean;
  assignedUserIds: number[];
  assignedTeamId?: number | null;
  checklist: string[];
  attachments: string[];
};

export function TaskForm({ 
  open, 
  onClose, 
  onSubmit, 
  projects, 
  boards, 
  existingTask, 
  isPersonalTask = false,
  initialColumnId,
  mode = 'edit'
}: TaskFormProps) {
  const [checklistItems, setChecklistItems] = useState<{text: string, checked: boolean}[]>(
    existingTask?.checklist 
      ? existingTask.checklist.map(item => {
          try {
            return typeof item === 'string' ? JSON.parse(item) : item;
          } catch {
            return { text: item, checked: false };
          }
        })
      : []
  );
  const [newChecklistItem, setNewChecklistItem] = useState("");
  
  // Fetch users for assignment before form initialization
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: open
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["/api/teams"],
    enabled: open
  });

  // Parse dates from ISO strings to Date objects
  const parseDate = (dateString: string | null | undefined) => {
    if (!dateString) return undefined;
    try {
      return new Date(dateString);
    } catch (e) {
      return undefined;
    }
  };

  const startDate = parseDate(existingTask?.startDate);
  const dueDate = parseDate(existingTask?.dueDate);

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: existingTask?.title || "",
      description: existingTask?.description || "",
      richDescription: existingTask?.richDescription || "",
      status: (existingTask?.status || "todo") as "backlog" | "todo" | "in-progress" | "review" | "done",
      boardId: existingTask?.boardId || (isPersonalTask ? undefined : undefined),
      priority: (existingTask?.priority || "medium") as "low" | "medium" | "high",
      labels: existingTask?.labels || [],
      columnId: existingTask?.columnId || initialColumnId || 0,
      order: existingTask?.order || 0,
      startDate: existingTask?.startDate || null,
      dueDate: existingTask?.dueDate || null,
      archived: existingTask?.archived || false,
      assignedUserIds: existingTask?.assignedUserIds || [],
      assignedTeamId: existingTask?.assignedTeamId || null,
      checklist: existingTask?.checklist || [],
      attachments: existingTask?.attachments || [],
    },
  });

  const handleSubmit = async (data: TaskFormValues) => {
    try {
      if (!data.title) {
        return;
      }

      // Serialize checklist items to strings
      const serializedChecklist = checklistItems.map(item => 
        JSON.stringify(item)
      );

      const taskData: any = {
        id: existingTask?.id || 0,
        title: data.title,
        description: data.description || "",
        richDescription: data.richDescription || "",
        status: data.status,
        order: existingTask?.order || 0,
        boardId: isPersonalTask ? null : (existingTask?.boardId || data.boardId),
        columnId: existingTask?.columnId || initialColumnId || 0,
        priority: data.priority,
        labels: data.labels || [],
        startDate: data.startDate || null,
        dueDate: data.dueDate || null,
        archived: existingTask?.archived || false,
        assignedUserIds: data.assignedUserIds || [],
        assignedTeamId: data.assignedTeamId || null,
        assignedAt: null,
        checklist: serializedChecklist,
        attachments: data.attachments || [],
        isPersonal: isPersonalTask,
      };

      if (onSubmit) {
        await onSubmit(taskData);
      }
      onClose();
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  const getChecklistProgress = () => {
    if (checklistItems.length === 0) return 0;
    const completedItems = checklistItems.filter(item => item.checked).length;
    return Math.round((completedItems / checklistItems.length) * 100);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Board selection - only show if not a personal task and creating new */}
        {!isPersonalTask && !existingTask && (
          <FormField
            control={form.control}
            name="boardId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Board</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(parseInt(value))}
                  value={field.value?.toString()}
                  disabled={!!existingTask}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Wählen Sie ein Board" />
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
        )}

        {/* Title field */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Titel</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Aufgabentitel" 
                  {...field} 
                  className="text-lg font-medium"
                  disabled={mode === 'details'}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Status and Priority in one row */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  value={field.value}
                  disabled={mode === 'details'}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Status auswählen" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="backlog">Backlog</SelectItem>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priorität</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  value={field.value}
                  disabled={mode === 'details'}
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
        </div>

        {/* Date fields in one row */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Startdatum</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        disabled={mode === 'details'}
                      >
                        {field.value ? (
                          format(new Date(field.value), "PPP", { locale: de })
                        ) : (
                          <span>Startdatum wählen</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value ? new Date(field.value) : undefined}
                      onSelect={(date) => 
                        field.onChange(date ? date.toISOString() : null)
                      }
                      locale={de}
                      initialFocus
                    />
                    {field.value && (
                      <div className="p-3 border-t border-border flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(field.value), "PPP", { locale: de })}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => field.onChange(null)}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Löschen
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

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
                          "pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        disabled={mode === 'details'}
                      >
                        {field.value ? (
                          format(new Date(field.value), "PPP", { locale: de })
                        ) : (
                          <span>Fälligkeitsdatum wählen</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value ? new Date(field.value) : undefined}
                      onSelect={(date) => 
                        field.onChange(date ? date.toISOString() : null)
                      }
                      locale={de}
                      initialFocus
                    />
                    {field.value && (
                      <div className="p-3 border-t border-border flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(field.value), "PPP", { locale: de })}
                        </span>
                        <Button
                          type="button"
                          variant="ghost" 
                          size="sm"
                          onClick={() => field.onChange(null)}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Löschen
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Assignees section */}
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="assignedUserIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Zugewiesene Benutzer</FormLabel>
                <FormControl>
                  <TaskUserSelect
                    selectedUserIds={field.value || []}
                    onUserSelectionChange={(users: number[]) => field.onChange(users)}
                    disabled={mode === 'details'}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="assignedTeamId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Zugewiesenes Team</FormLabel>
                <FormControl>
                  <TaskTeamSelect
                    selectedTeamId={field.value || undefined}
                    onTeamSelectionChange={(teamId: number | null) => field.onChange(teamId)}
                    disabled={mode === 'details'}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Labels field */}
        <FormField
          control={form.control}
          name="labels"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Labels (durch Komma getrennt)</FormLabel>
              <FormControl>
                <div className="space-y-2">
                  <Input
                    value={field.value?.join(", ") || ""}
                    onChange={(e) => {
                      const labels = e.target.value
                        .split(",")
                        .map((label) => label.trim())
                        .filter(Boolean);
                      field.onChange(labels);
                    }}
                    placeholder="bug, feature, UI"
                    disabled={mode === 'details'}
                    className="mb-2"
                  />
                  {field.value && field.value.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {field.value.map((label, i) => (
                        <Badge key={i} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {label}
                          {mode !== 'details' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 ml-1"
                              onClick={() => {
                                const newLabels = [...field.value];
                                newLabels.splice(i, 1);
                                field.onChange(newLabels);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description field */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Beschreibung</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Beschreiben Sie die Aufgabe..."
                  className="min-h-[100px]"
                  {...field}
                  disabled={mode === 'details'}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Rich Description - Optional */}
        <FormField
          control={form.control}
          name="richDescription"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Formatierte Beschreibung</FormLabel>
              <FormControl>
                <RichTextEditor
                  content={field.value || ''}
                  onChange={field.onChange}
                  editable={mode !== 'details'}
                  placeholder="Formatierte Beschreibung der Aufgabe..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Checklist section */}
        <div className="space-y-4">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-md font-medium">Checkliste</h3>
              <div className="text-sm text-muted-foreground">
                {checklistItems.filter(item => item.checked).length}/{checklistItems.length} abgeschlossen
              </div>
            </div>
            
            <Progress value={getChecklistProgress()} className="h-2 w-full" />
            
            {/* Checklist items */}
            <div className="space-y-2 mt-2">
              {checklistItems.map((item, index) => (
                <div key={index} className="flex items-center space-x-2 border rounded-md p-2">
                  <Checkbox 
                    id={`checklist-item-${index}`}
                    checked={item.checked}
                    onCheckedChange={(checked) => {
                      const newItems = [...checklistItems];
                      newItems[index] = { ...item, checked: !!checked };
                      setChecklistItems(newItems);
                      
                      // Update form value with serialized checklist
                      const serialized = newItems.map(item => JSON.stringify(item));
                      form.setValue('checklist', serialized);
                    }}
                    disabled={mode === 'details'}
                  />
                  <Input 
                    value={item.text}
                    onChange={(e) => {
                      const newItems = [...checklistItems];
                      newItems[index] = { ...item, text: e.target.value };
                      setChecklistItems(newItems);
                      
                      // Update form value with serialized checklist
                      const serialized = newItems.map(item => JSON.stringify(item));
                      form.setValue('checklist', serialized);
                    }}
                    className={cn(
                      "flex-1",
                      item.checked && "line-through text-muted-foreground"
                    )}
                    disabled={mode === 'details'}
                  />
                  {mode !== 'details' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newItems = [...checklistItems];
                        newItems.splice(index, 1);
                        setChecklistItems(newItems);
                        
                        // Update form value with serialized checklist
                        const serialized = newItems.map(item => JSON.stringify(item));
                        form.setValue('checklist', serialized);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            
            {/* Add new checklist item */}
            {mode !== 'details' && (
              <div className="flex items-center space-x-2 mt-2">
                <Input
                  placeholder="Neuer Checklistenpunkt..."
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newChecklistItem.trim()) {
                      e.preventDefault();
                      const newItems = [...checklistItems, { text: newChecklistItem, checked: false }];
                      setChecklistItems(newItems);
                      setNewChecklistItem("");
                      
                      // Update form value with serialized checklist
                      const serialized = newItems.map(item => JSON.stringify(item));
                      form.setValue('checklist', serialized);
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (newChecklistItem.trim()) {
                      const newItems = [...checklistItems, { text: newChecklistItem, checked: false }];
                      setChecklistItems(newItems);
                      setNewChecklistItem("");
                      
                      // Update form value with serialized checklist
                      const serialized = newItems.map(item => JSON.stringify(item));
                      form.setValue('checklist', serialized);
                    }
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Hinzufügen
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Attachments section - placeholder */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="attachments">
            <AccordionTrigger className="text-md font-medium">
              Anhänge
            </AccordionTrigger>
            <AccordionContent>
              <div className="py-2">
                {/* Placeholder for attachments - would implement real functionality here */}
                <div className="flex flex-col space-y-2">
                  {form.getValues('attachments')?.length ? (
                    form.getValues('attachments').map((attachment, i) => (
                      <div key={i} className="flex items-center space-x-2 border rounded-md p-2">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 text-sm truncate">{attachment}</span>
                        {mode !== 'details' && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const files = form.getValues('attachments').filter((_, idx) => idx !== i);
                              form.setValue('attachments', files);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground text-sm py-4">
                      Keine Anhänge vorhanden
                    </div>
                  )}
                  
                  {mode !== 'details' && (
                    <label htmlFor="file-upload" className="w-full cursor-pointer">
                      <input
                        id="file-upload"
                        type="file"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          
                          try {
                            const formData = new FormData();
                            formData.append('file', file);
                            formData.append('type', 'task');
                            if (existingTask?.id) {
                              formData.append('entityId', existingTask.id.toString());
                            }
                            
                            const response = await fetch('/api/upload', {
                              method: 'POST',
                              body: formData,
                              credentials: 'include',
                            });
                            
                            if (response.ok) {
                              const data = await response.json();
                              if (data.url) {
                                const currentAttachments = form.getValues('attachments') || [];
                                form.setValue('attachments', [...currentAttachments, data.url]);
                              }
                            } else {
                              console.error('Fehler beim Datei-Upload');
                            }
                          } catch (error) {
                            console.error('Fehler beim Upload:', error);
                          }
                          
                          // Reset input
                          e.target.value = '';
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full mt-2"
                      >
                        <Paperclip className="h-4 w-4 mr-2" />
                        Dateien anhängen
                      </Button>
                    </label>
                  )}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Bottom action bar */}
        <div className="flex justify-between pt-4 border-t mt-6">
          <Button 
            type="button" 
            variant="outline"
            onClick={onClose}
          >
            Abbrechen
          </Button>
          
          <Button 
            type="submit" 
            className="bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white"
            disabled={mode === 'details'}
          >
            {existingTask ? "Aufgabe aktualisieren" : "Aufgabe erstellen"}
          </Button>
        </div>
      </form>
    </Form>
  );
}