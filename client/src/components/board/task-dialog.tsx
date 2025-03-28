import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { type Task } from "@shared/schema";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, CalendarIcon, X, ArchiveIcon, CheckSquare, FileText, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

// Interface erweitern, um persönliche Aufgaben zu unterstützen
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
  mode = "details",
  initialColumnId,
  personalTask = false,
  isPersonalTask = personalTask,
}: TaskDialogProps) {
  const [isEditMode, setIsEditMode] = useState(mode === "edit");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form schema for task validation
  const formSchema = z.object({
    title: z.string().min(1, { message: "Titel ist erforderlich" }),
    description: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    dueDate: z.date().optional().nullable(),
    assignedUserIds: z.array(z.number()).optional(),
    labels: z.array(z.string()).optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      status: task?.status || "todo",
      priority: task?.priority || "medium",
      dueDate: task?.dueDate ? new Date(task.dueDate) : null,
      assignedUserIds: task?.assignedUserIds || [],
      labels: task?.labels || [],
    },
  });

  // Laden der verfügbaren Benutzer
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  // Mutation für Tasks
  const updateTask = useMutation({
    mutationFn: async (updatedTask: Task): Promise<any> => {
      if (!task) return null;
      
      const response = await apiRequest<any>(
        "PATCH",
        `/api/tasks/${task.id}`,
        updatedTask
      );
      
      if (!response.ok) {
        throw new Error("Fehler beim Aktualisieren des Tasks");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = Array.isArray(query.queryKey) ? query.queryKey[0] : query.queryKey;
          return (
            queryKey === "/api/boards" ||
            queryKey === "/api/tasks" ||
            queryKey === "/api/user/tasks/assigned" ||
            (task && queryKey.toString().startsWith(`/api/tasks/${task.id}`))
          );
        }
      });
      
      toast({ title: "Aufgabe erfolgreich aktualisiert" });
      setIsEditMode(false);
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Aktualisieren",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  // Mutation für das Erstellen neuer Tasks
  const createTask = useMutation({
    mutationFn: async (newTask: any): Promise<any> => {
      const endpoint = isPersonalTask
        ? "/api/user/tasks"
        : `/api/boards/${newTask.boardId}/tasks`;

      const response = await apiRequest<any>("POST", endpoint, newTask);
      
      if (!response.ok) {
        throw new Error("Fehler beim Erstellen des Tasks");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = Array.isArray(query.queryKey) ? query.queryKey[0] : query.queryKey;
          return (
            queryKey === "/api/boards" ||
            queryKey === "/api/tasks" ||
            queryKey === "/api/user/tasks/assigned" ||
            (initialColumnId && typeof initialColumnId === 'number' && 
             queryKey.toString().includes(`/api/boards/${initialColumnId}`))
          );
        }
      });
      
      toast({ title: "Aufgabe erfolgreich erstellt" });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Erstellen",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (data: z.infer<typeof formSchema>) => {
    // Bereite die Daten für die Übermittlung vor
    const taskData = {
      ...data,
      ...(task ? {} : { 
        boardId: isPersonalTask ? null : initialColumnId, 
        columnId: isPersonalTask ? null : initialColumnId 
      }),
      // Für bestehende Tasks
      ...(task ? { id: task.id, boardId: task.boardId } : {}),
    };

    try {
      if (task) {
        // Aktualisiere existierenden Task
        if (onUpdate) {
          await onUpdate(taskData as Task);
        } else {
          await updateTask.mutateAsync(taskData as Task);
        }
      } else {
        // Erstelle neuen Task
        await createTask.mutateAsync(taskData);
      }
    } catch (error) {
      console.error("Fehler beim Speichern:", error);
    }
  };

  // Prioritäten-Optionen
  const priorityOptions = [
    { value: "low", label: "Niedrig", color: "bg-green-500" },
    { value: "medium", label: "Mittel", color: "bg-yellow-500" },
    { value: "high", label: "Hoch", color: "bg-red-500" },
  ];

  // Zustand für die Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState('');
  
  // Zustand für die Checkliste
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [checkedItems, setCheckedItems] = useState<{[key: number]: boolean}>({});
  
  // Checklist Funktionen
  const handleAddChecklistItem = () => {
    if (newChecklistItem.trim()) {
      const updatedItems = [...checklistItems, newChecklistItem.trim()];
      setChecklistItems(updatedItems);
      setNewChecklistItem('');
      
      // Wenn im Task-Bearbeitungsmodus, direkt in Form übernehmen
      if (task) {
        const updatedTask = { 
          ...task, 
          checklist: updatedItems 
        };
        updateTask.mutate(updatedTask as Task);
      }
    }
  };
  
  const handleRemoveChecklistItem = (index: number) => {
    const updatedItems = checklistItems.filter((_, i) => i !== index);
    setChecklistItems(updatedItems);
    
    // Entferne auch den checked-Status für dieses Item
    const updatedCheckedItems = { ...checkedItems };
    delete updatedCheckedItems[index];
    setCheckedItems(updatedCheckedItems);
    
    // Wenn im Task-Bearbeitungsmodus, direkt in Form übernehmen
    if (task) {
      const updatedTask = { 
        ...task, 
        checklist: updatedItems 
      };
      updateTask.mutate(updatedTask as Task);
    }
  };
  
  const toggleChecklistItem = (index: number) => {
    const updatedCheckedItems = { 
      ...checkedItems, 
      [index]: !checkedItems[index] 
    };
    setCheckedItems(updatedCheckedItems);
  };
  
  // Initialisiere Checklist-Items aus Task beim Laden
  React.useEffect(() => {
    if (task?.checklist && Array.isArray(task.checklist)) {
      setChecklistItems(task.checklist);
    }
  }, [task]);
  
  // Öffne Lightbox für Dateivorschau
  const openLightbox = (url: string) => {
    setLightboxImage(url);
    setLightboxOpen(true);
  };

  // Rendere den Dialog mit neuem Layout gemäß Anforderungen
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl overflow-y-auto max-h-[90vh] p-0">
        {/* Top-Bar: Links->Titel/Rechts->X-Icon (schließen) */}
        <div className="flex items-center justify-between p-4 border-b">
          {isEditMode ? (
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem className="flex-1 m-0">
                  <FormControl>
                    <Input {...field} className="text-lg font-semibold" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <DialogTitle className="m-0 text-lg">
              {form.getValues().title}
            </DialogTitle>
          )}
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onOpenChange(false)} 
            className="rounded-full h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-3"
            >
              {/* Beschreibung */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-start gap-2">
                      <FormLabel className="text-base font-medium whitespace-nowrap pt-1">Beschreibung:</FormLabel>
                      {isEditMode ? (
                        <FormControl>
                          <Textarea
                            {...field}
                            className="min-h-[80px] resize-y flex-1"
                          />
                        </FormControl>
                      ) : (
                        <div className="text-sm flex-1 whitespace-pre-wrap">
                          {field.value || "Keine Beschreibung"}
                        </div>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Die nächsten Felder in einer kompakteren Ansicht */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 gap-y-1 mt-2">
                {/* Priority */}
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormLabel className="text-base font-medium m-0 w-20">Prio:</FormLabel>
                      <FormControl>
                        {isEditMode ? (
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Wähle eine Priorität" />
                            </SelectTrigger>
                            <SelectContent>
                              {priorityOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  <div className="flex items-center">
                                    <div
                                      className={`w-3 h-3 rounded-full mr-2 ${option.color}`}
                                    />
                                    <span>{option.label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex items-center">
                            {field.value && (
                              <>
                                <div
                                  className={`w-3 h-3 rounded-full mr-2 ${
                                    priorityOptions.find(
                                      (option) => option.value === field.value
                                    )?.color || "bg-gray-400"
                                  }`}
                                />
                                <span>
                                  {
                                    priorityOptions.find(
                                      (option) => option.value === field.value
                                    )?.label || field.value
                                  }
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Fälligkeitsdatum */}
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormLabel className="text-base font-medium m-0 w-20">Deadline:</FormLabel>
                      <FormControl>
                        {isEditMode ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-[180px] justify-start text-left font-normal"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? (
                                  format(field.value, "PPP", { locale: de })
                                ) : (
                                  <span>Wähle ein Datum</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={field.value || undefined}
                                onSelect={field.onChange}
                                initialFocus
                                locale={de}
                              />
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <div>
                            {field.value
                              ? format(field.value, "PPP", { locale: de })
                              : "Kein Fälligkeitsdatum gesetzt"}
                          </div>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Benutzer - Überlappende Avatare */}
                <FormField
                  control={form.control}
                  name="assignedUserIds"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormLabel className="text-base font-medium m-0 w-20">Benutzer:</FormLabel>
                      <FormControl>
                        {isEditMode ? (
                          <Select
                            value={field.value && Array.isArray(field.value) && field.value.length > 0 ? field.value[0].toString() : ""}
                            onValueChange={(value) => field.onChange(value ? [parseInt(value)] : [])}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Benutzer auswählen" />
                            </SelectTrigger>
                            <SelectContent>
                              {users.map((user: any) => (
                                <SelectItem key={user.id} value={user.id.toString()}>
                                  {user.username}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex -space-x-2">
                            {/* Creator mit blauem Rand - Fallback auf Board-Creator oder ersten User */}
                            <Avatar className="h-8 w-8 border-2 border-blue-500">
                              <AvatarImage src={users[0]?.avatarUrl} />
                              <AvatarFallback>
                                {users[0]?.username.substring(0, 2).toUpperCase() || 'CR'}
                              </AvatarFallback>
                            </Avatar>
                            
                            {/* Zugewiesene Benutzer mit weißem Rand */}
                            {field.value && Array.isArray(field.value) && field.value.length > 0 && field.value.map((userId) => {
                              const user = users.find((u: any) => u.id === userId);
                              return user ? (
                                <Avatar key={userId} className="h-8 w-8 border-2 border-white">
                                  <AvatarImage src={user.avatarUrl} />
                                  <AvatarFallback>
                                    {user.username.substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              ) : null;
                            })}
                          </div>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Labels */}
                <FormField
                  control={form.control}
                  name="labels"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormLabel className="text-base font-medium m-0 w-20">Labels:</FormLabel>
                      <FormControl>
                        {isEditMode ? (
                          <div className="flex flex-wrap gap-2">
                            {field.value && field.value.map((label) => (
                              <Badge key={label} variant="outline" className="px-2 py-1">
                                {label}
                                <button
                                  type="button"
                                  className="ml-1 text-gray-500 hover:text-gray-700"
                                  onClick={() => {
                                    field.onChange(field.value?.filter((l) => l !== label) || []);
                                  }}
                                >
                                  ×
                                </button>
                              </Badge>
                            ))}
                            <div className="flex items-center">
                              <Input
                                placeholder="Neues Label hinzufügen"
                                className="w-full max-w-[180px]"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const input = e.currentTarget;
                                    const value = input.value.trim();
                                    if (value && !field.value?.includes(value)) {
                                      field.onChange([...(field.value || []), value]);
                                      input.value = '';
                                    }
                                  }
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {field.value && Array.isArray(field.value) && field.value.length > 0 ? (
                              field.value.map((label) => (
                                <Badge key={label} variant="outline" className="px-2 py-1">
                                  {label}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-gray-500">Keine Labels</span>
                            )}
                          </div>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Trennlinie vor Dateien */}
              <Separator className="my-4" />
              
              {/* Dateien-Sektion mit Miniaturansichten und Lightbox */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-slate-500" />
                    <h3 className="text-base font-medium">Dateien</h3>
                  </div>
                  
                  {isEditMode && (
                    <Button variant="outline" size="sm" type="button">
                      <span className="text-sm">Datei hinzufügen</span>
                    </Button>
                  )}
                </div>
                
                {task?.attachments && Array.isArray(task.attachments) && task.attachments.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {task.attachments.map((attachment, index) => {
                      const fileName = attachment.split('/').pop() || '';
                      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
                      
                      return (
                        <div 
                          key={index} 
                          className="border rounded-md p-2 overflow-hidden bg-slate-50 relative group"
                        >
                          {isImage ? (
                            <div 
                              className="cursor-pointer relative h-24 flex items-center justify-center bg-gray-100 rounded overflow-hidden"
                              onClick={() => openLightbox(attachment)}
                            >
                              <img 
                                src={attachment} 
                                alt={fileName} 
                                className="object-cover h-full w-full"
                              />
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <div className="text-white text-sm font-medium bg-black bg-opacity-50 px-2 py-1 rounded">
                                  Vergrößern
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 h-24 justify-center">
                              <FileText className="h-10 w-10 text-blue-500" />
                            </div>
                          )}
                          
                          <div className="mt-2 flex items-center justify-between text-sm">
                            <span className="truncate max-w-[80%]" title={fileName}>
                              {fileName}
                            </span>
                            <a 
                              href={attachment} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:text-blue-700"
                              onClick={(e) => isImage && (e.preventDefault(), openLightbox(attachment))}
                            >
                              Öffnen
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Keine Dateien angehängt</p>
                )}
              </div>
              
              {/* Lightbox für Bilder */}
              {lightboxOpen && (
                <div 
                  className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4"
                  onClick={() => setLightboxOpen(false)}
                >
                  <div className="relative max-w-4xl max-h-[90vh]">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setLightboxOpen(false)} 
                      className="absolute top-2 right-2 bg-black bg-opacity-50 text-white rounded-full"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                    <img 
                      src={lightboxImage} 
                      alt="Vergrößerte Ansicht"
                      className="max-h-[85vh] max-w-full object-contain"
                    />
                  </div>
                </div>
              )}
              
              {/* Trennlinie vor Checkliste */}
              <Separator className="my-4" />
              
              {/* Checkliste-Sektion mit bearbeitbaren Elementen */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-5 w-5 text-slate-500" />
                    <h3 className="text-base font-medium">Checkliste</h3>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {checklistItems.length > 0 ? (
                    checklistItems.map((item, index) => (
                      <div key={index} className="flex items-start gap-2 group">
                        <div 
                          className={`w-5 h-5 mt-0.5 border rounded flex items-center justify-center cursor-pointer
                                    ${checkedItems[index] ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white'}`}
                          onClick={() => toggleChecklistItem(index)}
                        >
                          {checkedItems[index] && <span className="text-xs">✓</span>}
                        </div>
                        <span className={`text-sm flex-1 ${checkedItems[index] ? 'line-through text-gray-500' : ''}`}>
                          {item}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-6 w-6 rounded-full"
                          onClick={() => handleRemoveChecklistItem(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">Keine Checklisten-Elemente</p>
                  )}
                </div>
                
                {/* Eingabefeld für neue Checklisten-Elemente */}
                <div className="flex gap-2 mt-2 items-center">
                  <Input
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    placeholder="Neues Element hinzufügen..."
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddChecklistItem();
                      }
                    }}
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleAddChecklistItem}
                    className="whitespace-nowrap"
                  >
                    Hinzufügen
                  </Button>
                </div>
              </div>
              
              {/* Trennlinie vor Kommentaren */}
              <Separator className="my-4" />
              
              {/* Kommentare-Sektion */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-slate-500" />
                  <h3 className="text-base font-medium">Kommentare</h3>
                </div>
                
                <p className="text-sm text-gray-500">Keine Kommentare</p>
              </div>
            </form>
          </Form>
        </div>
        
        {/* Bottom-Bar: Links->Archivieren / Rechts-> Bearbeiten, Schließen */}
        <div className="flex items-center justify-between p-4 border-t">
          <div>
            {!isEditMode && task && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-slate-600 hover:text-red-600 flex items-center gap-1"
              >
                <ArchiveIcon className="h-4 w-4" />
                {(task as any).archived ? "Wiederherstellen" : "Archivieren"}
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            {isEditMode ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (task) {
                      setIsEditMode(false);
                      form.reset();
                    } else {
                      onOpenChange(false);
                    }
                  }}
                >
                  Abbrechen
                </Button>
                <Button 
                  onClick={form.handleSubmit(handleSubmit)}
                  disabled={createTask.isPending || updateTask.isPending}
                >
                  {createTask.isPending || updateTask.isPending ? "Speichern..." : "Speichern"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  onClick={() => setIsEditMode(true)}
                  className="flex items-center gap-1"
                >
                  <Pencil className="h-4 w-4" />
                  Bearbeiten
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Schließen
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}