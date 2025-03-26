import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { type Task } from "@shared/schema";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarIcon, PlusCircle, X, Tag, Pencil, User as UserIcon, Upload, ImageIcon, FileIcon, Paperclip } from "lucide-react";
import { CommentList } from "@/components/comments/comment-list";
import { CommentEditor } from "@/components/comments/comment-editor";
import classnames from 'classnames';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
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
import { format, startOfDay, endOfDay } from "date-fns";
import { de } from "date-fns/locale";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { User } from "@shared/schema";
import { DialogMultiSelect } from "@/components/ui/dialog-multi-select";

// Erweiterte Task-Schnittstelle für die Frontend-Anzeige (analog zu my-tasks.tsx)
interface TaskWithDetails extends Task {
  board?: {
    id: number;
    title: string;
    projectId?: number | null;
  } | null;
  column?: {
    id: number;
    title: string;
  } | null;
  project?: {
    id: number;
    title: string;
  } | null;
}

interface TaskDialogProps {
  task?: Task | TaskWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: (task: Task) => Promise<void>;
  mode?: "edit" | "details";
  initialColumnId?: number;
  personalTask?: boolean; // Prop für persönliche Aufgaben
  isPersonalTask?: boolean; // Alternative Benennung (für Konsistenz)
}

const taskFormSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  description: z.string().optional(),
  status: z.enum(["backlog", "todo", "in-progress", "review", "done"]),
  priority: z.enum(["low", "medium", "high"]),
  columnId: z.number().optional(), // Spalte ist jetzt optional
  boardId: z.number().optional(), // Board ist jetzt optional
  labels: z.array(z.string()).default([]),
  assignedUserIds: z.array(z.number()).default([]),
  dueDate: z.string().nullable(),
  archived: z.boolean().default(false),
  order: z.number().default(0),
});

export function TaskDialog({
  task,
  open,
  onOpenChange,
  onUpdate,
  mode = task ? "details" : "edit",
  initialColumnId,
  personalTask = false,
  isPersonalTask = personalTask, // Unterstützung für beide Props (isPersonalTask hat Vorrang)
}: TaskDialogProps) {
  console.log("TaskDialog geöffnet", { isPersonalTask, mode, initialColumnId });
  const [newLabel, setNewLabel] = useState("");
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [checklist, setChecklist] = useState<{ text: string; checked: boolean; }[]>([]);
  const [isEditMode, setIsEditMode] = useState(mode === "edit");
  const [richDescription, setRichDescription] = useState<string>(task?.richDescription || "");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadedAttachments, setUploadedAttachments] = useState<string[]>(task?.attachments ? 
    (Array.isArray(task.attachments) ? task.attachments : []) : []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { currentBoard } = useStore();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) {
        console.error("Failed to fetch users:", response.statusText);
        throw new Error("Fehler beim Laden der Benutzer");
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const form = useForm<z.infer<typeof taskFormSchema>>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      status: (task?.status || "todo") as "backlog" | "todo" | "in-progress" | "review" | "done",
      priority: (task?.priority || "medium") as "low" | "medium" | "high",
      columnId: task?.columnId || initialColumnId || 0,
      labels: task?.labels || [],
      assignedUserIds: task?.assignedUserIds || [],
      dueDate: task?.dueDate || null,
      archived: task?.archived || false,
      order: task?.order || 0,
    },
  });

  useEffect(() => {
    if (open) {
      setIsEditMode(mode === "edit");
      form.reset({
        title: task?.title || "",
        description: task?.description || "",
        status: (task?.status || "todo") as "backlog" | "todo" | "in-progress" | "review" | "done",
        priority: (task?.priority || "medium") as "low" | "medium" | "high",
        columnId: task?.columnId || initialColumnId || 0,
        labels: task?.labels || [],
        assignedUserIds: task?.assignedUserIds || [],
        dueDate: task?.dueDate || null,
        archived: task?.archived || false,
        order: task?.order || 0,
      });

      if (task?.checklist) {
        try {
          const parsedChecklist = task.checklist.map(item => {
            if (typeof item === 'string') {
              return JSON.parse(item);
            }
            return item;
          });
          setChecklist(parsedChecklist);
        } catch (error) {
          console.error('Error parsing checklist:', error);
          setChecklist([]);
        }
      } else {
        setChecklist([]);
      }
    }
  }, [open, task, mode, form, initialColumnId]);

  const handleAddLabel = () => {
    if (!newLabel.trim()) return;
    const currentLabels = form.getValues("labels");
    if (!currentLabels.includes(newLabel)) {
      form.setValue("labels", [...currentLabels, newLabel]);
    }
    setNewLabel("");
  };

  const removeLabel = (labelToRemove: string) => {
    const currentLabels = form.getValues("labels");
    form.setValue(
      "labels",
      currentLabels.filter(label => label !== labelToRemove)
    );
  };

  const saveChecklist = async (newChecklist: { text: string; checked: boolean; }[]) => {
    if (!task) return;

    const formattedChecklist = newChecklist.map(item => JSON.stringify(item));
    const updatedTask: Task = {
      ...task,
      checklist: formattedChecklist,
      richDescription: task.richDescription,
      attachments: task.attachments
    };

    try {
      await apiRequest("PATCH", `/api/tasks/${task.id}`, updatedTask);
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task.id}`] });
    } catch (error) {
      toast({
        title: "Fehler beim Speichern der Checkliste",
        variant: "destructive",
      });
    }
  };

  const toggleChecklistItem = async (index: number) => {
    const newChecklist = checklist.map((item, i) =>
      i === index ? { ...item, checked: !item.checked } : item
    );
    setChecklist(newChecklist);
    await saveChecklist(newChecklist);
  };

  const deleteChecklistItem = async (index: number) => {
    const newChecklist = checklist.filter((_, i) => i !== index);
    setChecklist(newChecklist);
    await saveChecklist(newChecklist);
  };

  const addChecklistItem = async () => {
    if (!newChecklistItem.trim()) return;
    const newChecklist = [...checklist, { text: newChecklistItem, checked: false }];
    setChecklist(newChecklist);
    setNewChecklistItem("");
    await saveChecklist(newChecklist);
  };

  const onSubmit = async (data: z.infer<typeof taskFormSchema>) => {
    // Ermittle ob Persönliche Aufgabe über Prop oder URL
    console.log("Submit form, isPersonalTask:", isPersonalTask, "pathname:", window.location.pathname);
    const isPersonalTaskSubmit = isPersonalTask || window.location.pathname.includes('/my-tasks');
    console.log("Task erstellen als persönliche Aufgabe:", isPersonalTaskSubmit);

    try {
      const formattedChecklist = checklist.map(item => JSON.stringify(item));

      // Adjust the due date to end of day in local timezone
      let adjustedDueDate = null;
      if (data.dueDate) {
        const date = new Date(data.dueDate);
        adjustedDueDate = endOfDay(date).toISOString();
      }
      
      // Verwende die Rich-Text-Beschreibung und Anhänge
      const finalAttachments = uploadedAttachments.length > 0 ? uploadedAttachments : null;

      if (task && onUpdate) {
        // Bestehende Aufgabe aktualisieren
        const updatedTask: Task = {
          ...task,
          ...data,
          dueDate: adjustedDueDate,
          richDescription: richDescription || task.richDescription,
          checklist: formattedChecklist,
          boardId: task.boardId, // Behalte das ursprüngliche Board bei
          attachments: finalAttachments || task.attachments
        };
        await onUpdate(updatedTask);

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["/api/boards"] }),
          queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
          queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task.id}`] }),
          queryClient.invalidateQueries({ queryKey: ["/api/users"] }),
          queryClient.invalidateQueries({ queryKey: ["/api/user/tasks/assigned"] }),
        ]);

        toast({ title: "Task erfolgreich aktualisiert" });
        setIsEditMode(false);
      } else {
        // Neue Aufgabe erstellen
        if (isPersonalTaskSubmit) {
          // Persönliche Aufgabe erstellen (ohne Board)
          console.log("Erstelle persönliche Aufgabe...");
          const taskData: Task = {
            id: 0,
            title: data.title,
            description: data.description || "",
            richDescription: richDescription || null,
            status: data.status,
            order: data.order,
            boardId: null as unknown as number, // Für persönliche Aufgaben ist boardId null
            columnId: null as unknown as number, // Für persönliche Aufgaben ist columnId null
            priority: data.priority,
            labels: data.labels,
            dueDate: adjustedDueDate,
            archived: false,
            assignedUserIds: data.assignedUserIds,
            assignedTeamId: null,
            assignedAt: null,
            checklist: formattedChecklist,
            attachments: finalAttachments
          };

          const personalResponse = await apiRequest(
            "POST",
            `/api/user/tasks`,
            taskData
          );
          
          if (!personalResponse) {
            throw new Error("Fehler beim Erstellen der persönlichen Aufgabe");
          }
        } else if (currentBoard?.id) {
          // Normale Aufgabe in einem Board erstellen
          console.log("Erstelle Board-Aufgabe für Board:", currentBoard.id);
          const taskData: Task = {
            id: 0,
            title: data.title,
            description: data.description || "",
            richDescription: richDescription || null,
            status: data.status,
            order: data.order,
            boardId: currentBoard.id,
            columnId: data.columnId || 0, // Fallback zu 0 wenn undefined
            priority: data.priority,
            labels: data.labels,
            dueDate: adjustedDueDate,
            archived: false,
            assignedUserIds: data.assignedUserIds,
            assignedTeamId: null,
            assignedAt: null,
            checklist: formattedChecklist,
            attachments: finalAttachments
          };

          const response = await apiRequest(
            "POST",
            `/api/boards/${currentBoard.id}/tasks`,
            taskData
          );
        } else {
          // Kein Board verfügbar und nicht im persönlichen Kontext - zeige Fehlermeldung
          toast({
            title: "Fehler",
            description: "Kein aktives Board ausgewählt",
            variant: "destructive",
          });
          return;
        }

        // Response-Prüfung wird in den jeweiligen Blöcken durchgeführt

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["/api/boards"] }),
          queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
          queryClient.invalidateQueries({ queryKey: ["/api/user/tasks/assigned"] }),
        ]);

        onOpenChange(false);
        toast({ title: "Aufgabe erfolgreich erstellt" });
      }
    } catch (error) {
      console.error("Form submission error:", error);
      toast({
        title: "Fehler beim Speichern",
        description: error instanceof Error ? error.message : "Die Aufgabe konnte nicht gespeichert werden",
        variant: "destructive",
      });
    }
  };

  const renderDetailView = () => {
    const priorityConfig = {
      high: {
        color: "text-red-600",
        bg: "bg-red-50",
        border: "border-red-200",
        label: "Hoch",
        dot: "bg-red-600"
      },
      medium: {
        color: "text-yellow-600",
        bg: "bg-yellow-50",
        border: "border-yellow-200",
        label: "Mittel",
        dot: "bg-yellow-600"
      },
      low: {
        color: "text-blue-600",
        bg: "bg-blue-50",
        border: "border-blue-200",
        label: "Niedrig",
        dot: "bg-blue-600"
      }
    };

    const statusLabels = {
      "backlog": "Backlog",
      "todo": "Zu erledigen",
      "in-progress": "In Bearbeitung",
      "review": "Überprüfung",
      "done": "Erledigt"
    };

    const priority = task?.priority ? priorityConfig[task.priority as keyof typeof priorityConfig] : priorityConfig.medium;
    const assignedUsers = users.filter(user => task?.assignedUserIds?.includes(user.id));
    const creator = users.find(user => user.id === task?.creatorId);
    const statusLabel = task?.status ? statusLabels[task.status as keyof typeof statusLabels] : "Unbekannt";
    const createdAtDate = task?.createdAt ? new Date(task.createdAt) : new Date();

    return (
      <div className="space-y-6">
        {/* Header mit Titel */}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">{task?.title}</h2>
          
          {/* Meta-Informationen in Grid-Layout */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {/* Labels */}
            {task?.labels && task.labels.length > 0 && (
              <>
                <div className="text-muted-foreground font-medium">Labels:</div>
                <div className="flex flex-wrap gap-1">
                  {task.labels.map((label, index) => (
                    <div
                      key={index}
                      className="px-1.5 py-0.5 bg-slate-100 rounded text-xs text-slate-700"
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </>
            )}
            
            {/* Erstellt */}
            <div className="text-muted-foreground font-medium">Erstellt:</div>
            <div>{format(createdAtDate, "PPP", { locale: de })}</div>
            
            {/* Deadline */}
            {task?.dueDate && (
              <>
                <div className="text-muted-foreground font-medium">Deadline:</div>
                <div className="flex items-center gap-1">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {format(new Date(task.dueDate), "PPP", { locale: de })}
                </div>
              </>
            )}
            
            {/* Ersteller */}
            {creator && (
              <>
                <div className="text-muted-foreground font-medium">Ersteller:</div>
                <div className="flex items-center gap-1">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={creator.avatarUrl || ""} />
                    <AvatarFallback>{creator.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span>{creator.username}</span>
                </div>
              </>
            )}
            
            {/* Zugewiesene Benutzer */}
            {assignedUsers.length > 0 && (
              <>
                <div className="text-muted-foreground font-medium">Zugewiesene Benutzer:</div>
                <div className="flex flex-wrap gap-1">
                  {assignedUsers.map((user) => (
                    <div key={user.id} className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded-full">
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={user.avatarUrl || ""} />
                        <AvatarFallback>{user.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs">{user.username}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            
            {/* Status */}
            <div className="text-muted-foreground font-medium">Status:</div>
            <div className="flex items-center">
              <div className={`px-2 py-0.5 rounded-full text-xs ${
                task?.status === "done" ? "bg-green-100 text-green-800" :
                task?.status === "in-progress" ? "bg-blue-100 text-blue-800" :
                task?.status === "review" ? "bg-purple-100 text-purple-800" :
                task?.status === "todo" ? "bg-orange-100 text-orange-800" :
                "bg-gray-100 text-gray-800"
              }`}>
                {statusLabel}
              </div>
            </div>
            
            {/* Priorität */}
            <div className="text-muted-foreground font-medium">Priorität:</div>
            <div className="flex items-center">
              <div className={classnames(
                "flex items-center gap-1 px-2 py-0.5 rounded-full",
                "border border-current/20",
                priority.color,
              )}>
                <div className={classnames("w-1.5 h-1.5 rounded-full", priority.dot)} />
                <span className="text-xs font-medium">{priority.label}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Trennlinie */}
        <div className="border-t border-slate-200"></div>
        
        {/* Beschreibung */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Beschreibung</div>
          {task?.description ? (
            <div className="text-sm whitespace-pre-wrap">{task.description}</div>
          ) : (
            <div className="text-sm text-muted-foreground italic">Keine Beschreibung vorhanden</div>
          )}
        </div>
        
        {/* Checkliste */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Checkliste</div>
          {checklist.length > 0 ? (
            <div className="space-y-2 border rounded-md p-2 bg-slate-50">
              {checklist.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2"
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => toggleChecklistItem(index)}
                    className="h-4 w-4"
                  />
                  <span className={item.checked ? "line-through text-muted-foreground" : ""}>
                    {item.text}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteChecklistItem(index)}
                    className="ml-auto text-destructive hover:text-destructive/80"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">Keine Checklistenitems vorhanden</div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="Neues Checklist-Element"
              value={newChecklistItem}
              onChange={(e) => setNewChecklistItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addChecklistItem();
                }
              }}
            />
            <Button type="button" onClick={addChecklistItem} size="sm">
              <PlusCircle className="h-4 w-4 mr-1" />
              Hinzufügen
            </Button>
          </div>
        </div>
        
        {/* Trennlinie */}
        <div className="border-t border-slate-200"></div>
        
        {/* Angehängte Dateien */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Dateien</div>
          {task?.attachments && task.attachments.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {task.attachments.map((url, index) => {
                const fileName = url.split('/').pop() || `Datei ${index + 1}`;
                const isImage = /\.(jpeg|jpg|gif|png|webp)$/i.test(url);
                
                return (
                  <div 
                    key={index} 
                    className="flex items-center gap-1.5 p-2 rounded-md bg-muted/50 border hover:bg-muted"
                  >
                    {isImage ? (
                      <ImageIcon className="h-4 w-4 text-blue-600" />
                    ) : (
                      <FileIcon className="h-4 w-4 text-blue-600" />
                    )}
                    <a 
                      href={url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline truncate max-w-[200px]"
                    >
                      {fileName}
                    </a>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">Keine Dateien angehängt</div>
          )}
        </div>
        
        {/* Kommentare */}
        {task && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-muted-foreground">Kommentare</div>
            <div className="border rounded-md p-3 bg-slate-50">
              <CommentList taskId={task.id} />
              <div className="mt-4 border-t pt-3">
                <CommentEditor
                  taskId={task.id}
                  onCommentAdded={() => {
                    queryClient.invalidateQueries({
                      queryKey: [`/api/tasks/${task.id}/comments`]
                    });
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <div className="px-6 pt-6 pb-2">
          <DialogTitle>
            {isEditMode ? (task ? "Aufgabe bearbeiten" : "Neue Aufgabe") : "Aufgabendetails"}
          </DialogTitle>
        </div>

        {isEditMode ? (
          <div className="flex flex-col h-full">
            <div className="px-6 overflow-y-auto pb-24" style={{ maxHeight: "calc(85vh - 120px)" }}>
              <Form {...form}>
                <form id="task-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Titel</FormLabel>
                        <FormControl>
                          <Input placeholder="Titel der Aufgabe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Beschreibung</FormLabel>
                        <FormControl>
                          <RichTextEditor
                            content={richDescription}
                            onChange={setRichDescription}
                            placeholder="Beschreiben Sie die Aufgabe detailliert"
                            uploadType="task"
                            entityId={task?.id}
                            onAttachmentUpload={(urls) => {
                              setUploadedAttachments(prev => [...prev, ...urls]);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Datei-Upload Bereich */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Dateien anhängen</label>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1"
                      >
                        <Paperclip className="h-4 w-4" />
                        <span>Hochladen</span>
                      </Button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        multiple
                        onChange={(e) => {
                          if (e.target.files?.length) {
                            const fileArray = Array.from(e.target.files);
                            setFiles(prev => [...prev, ...fileArray]);
                            
                            // Upload-Logik hier...
                            const formData = new FormData();
                            for (const file of fileArray) {
                              formData.append('files', file);
                            }
                            
                            // Bestimme die Upload-URL basierend auf dem Task-Kontext
                            const uploadEndpoint = task?.id 
                              ? `/api/tasks/${task.id}/attachments`
                              : '/api/attachments/temp';
                              
                            fetch(uploadEndpoint, {
                              method: 'POST',
                              body: formData
                            })
                            .then(res => res.json())
                            .then(data => {
                              if (data.urls && Array.isArray(data.urls)) {
                                setUploadedAttachments(prev => [...prev, ...data.urls]);
                                toast({
                                  title: "Dateien erfolgreich hochgeladen",
                                  description: `${data.urls.length} Datei(en) wurden erfolgreich hochgeladen.`
                                });
                              }
                            })
                            .catch(err => {
                              console.error("Fehler beim Hochladen:", err);
                              toast({
                                title: "Fehler beim Hochladen",
                                description: "Die Dateien konnten nicht hochgeladen werden.",
                                variant: "destructive"
                              });
                            });
                          }
                        }}
                      />
                    </div>
                    
                    {/* Anzeige der hochgeladenen Dateien */}
                    {uploadedAttachments.length > 0 && (
                      <div className="space-y-2 mt-2">
                        <div className="text-sm font-medium">Angehängte Dateien</div>
                        <div className="flex flex-wrap gap-2">
                          {uploadedAttachments.map((url, index) => {
                            const fileName = url.split('/').pop() || `Datei ${index + 1}`;
                            const isImage = /\.(jpeg|jpg|gif|png|webp)$/i.test(url);
                            
                            return (
                              <div 
                                key={index} 
                                className="flex items-center gap-1 p-1 rounded-md bg-muted/50 border"
                              >
                                {isImage ? (
                                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="text-xs truncate max-w-[120px]">{fileName}</span>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-5 w-5"
                                  onClick={() => {
                                    setUploadedAttachments(prev => 
                                      prev.filter((_, i) => i !== index)
                                    );
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                        <Select onValueChange={field.onChange} value={field.value}>
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

                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fälligkeitsdatum</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={`w-full pl-3 text-left font-normal ${
                                  !field.value && "text-muted-foreground"
                                }`}
                              >
                                {field.value ? (
                                  format(new Date(field.value), "PPP", { locale: de })
                                ) : (
                                  <span>Wählen Sie ein Datum</span>
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
                              disabled={(date) =>
                                date < new Date(new Date().setHours(0, 0, 0, 0))
                              }
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="labels"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Labels</FormLabel>
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            {field.value?.map((label, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-md"
                              >
                                <Tag className="h-3 w-3" />
                                <span className="text-sm">{label}</span>
                                <button
                                  type="button"
                                  onClick={() => removeLabel(label)}
                                  className="text-primary/50 hover:text-primary"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Neues Label"
                              value={newLabel}
                              onChange={(e) => setNewLabel(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAddLabel();
                                }
                              }}
                            />
                            <Button type="button" onClick={handleAddLabel} size="sm">
                              <Tag className="h-4 w-4 mr-1" />
                              Hinzufügen
                            </Button>
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />

                  {/* Zeige Benutzerauswahl nur für normale Aufgaben (nicht für persönliche) */}
                  {!isPersonalTask ? (
                    <FormField
                      control={form.control}
                      name="assignedUserIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zugewiesene Benutzer</FormLabel>
                          <FormControl>
                            {isLoadingUsers ? (
                              <div className="text-sm text-muted-foreground">
                                Lade Benutzer...
                              </div>
                            ) : users.length === 0 ? (
                              <div className="text-sm text-muted-foreground">
                                Keine Benutzer verfügbar
                              </div>
                            ) : (
                              <DialogMultiSelect
                                placeholder="Benutzer auswählen..."
                                options={users.map(user => ({
                                  value: user.id.toString(),
                                  label: user.username
                                }))}
                                selected={Array.isArray(field.value) ? field.value.map((id: number) => id.toString()) : []}
                                onChange={(values: string[]) => {
                                  const numberValues = values.map((v: string) => parseInt(v));
                                  field.onChange(numberValues);
                                }}
                              />
                            )}
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <div className="flex items-center p-2 bg-amber-50 text-amber-700 rounded-md border border-amber-200 mt-2 mb-4">
                      <UserIcon className="h-4 w-4 mr-2" />
                      <span className="text-sm">Persönliche Aufgabe - wird automatisch nur Ihnen zugewiesen</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <FormLabel>Checkliste</FormLabel>
                    <div className="space-y-2">
                      {checklist.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => toggleChecklistItem(index)}
                            className="h-4 w-4"
                          />
                          <span className={item.checked ? "line-through text-muted-foreground" : ""}>
                            {item.text}
                          </span>
                          <button
                            type="button"
                            onClick={() => deleteChecklistItem(index)}
                            className="ml-auto text-destructive hover:text-destructive/80"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Neues Checklist-Element"
                        value={newChecklistItem}
                        onChange={(e) => setNewChecklistItem(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addChecklistItem();
                          }
                        }}
                      />
                      <Button 
                        type="button" 
                        onClick={addChecklistItem} 
                        size="sm"
                        className="bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-sm transition-all duration-300 hover:shadow-md"
                      >
                        <PlusCircle className="h-4 w-4 mr-1" />
                        Hinzufügen
                      </Button>
                    </div>
                  </div>

                  {task && (
                    <div className="space-y-2">
                      <FormLabel>Kommentare</FormLabel>
                      <CommentList taskId={task.id} />
                      <CommentEditor taskId={task.id} onCommentAdded={() => {
                        queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task.id}/comments`] });
                      }} />
                    </div>
                  )}
                </form>
              </Form>
            </div>
            
            <div className="fixed bottom-0 w-full p-4 bg-background border-t border-border flex justify-end gap-2 rounded-b-lg">
              <Button form="task-form" type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button 
                form="task-form" 
                type="submit"
                className="bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-md transition-all duration-300 hover:shadow-lg"
              >
                {task ? "Speichern" : "Erstellen"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="px-6 overflow-y-auto pb-24" style={{ maxHeight: "calc(85vh - 120px)" }}>
              {renderDetailView()}
            </div>
            
            <div className="fixed bottom-0 w-full p-4 bg-background border-t border-border flex justify-end gap-2 rounded-b-lg">
              {task && (
                <Button
                  variant="outline"
                  onClick={() => setIsEditMode(true)}
                  className="gap-2"
                  size="sm"
                >
                  <Pencil className="h-4 w-4 mr-1.5" />
                  Bearbeiten
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                size="sm"
              >
                <X className="h-4 w-4 mr-1.5" />
                Schließen
              </Button>
              {task && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="border-amber-500 text-amber-600 hover:bg-amber-50"
                  onClick={async () => {
                    if (!task) return;
                    try {
                      const updatedTask: Task = {
                        ...task,
                        archived: !task.archived
                      };
                      
                      if (onUpdate) {
                        await onUpdate(updatedTask);
                        
                        toast({
                          title: updatedTask.archived 
                            ? "Aufgabe archiviert" 
                            : "Aufgabe wiederhergestellt",
                        });
                        
                        onOpenChange(false);
                      }
                    } catch (error) {
                      toast({
                        title: "Fehler",
                        description: "Die Aufgabe konnte nicht archiviert werden",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  {task.archived ? (
                    <>
                      <span className="mr-1.5">↩</span> 
                      Wiederherstellen
                    </>
                  ) : (
                    <>
                      <span className="mr-1.5">📦</span>
                      Archivieren
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}