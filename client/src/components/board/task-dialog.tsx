import { useState, useEffect, useRef, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { type Task, type UpdateTask } from "@shared/schema";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/lib/store";
import { getErrorMessage } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarIcon, PlusCircle, X, Tag, Pencil, User as UserIcon, Upload, ImageIcon, FileIcon, FileText, Paperclip, Archive, RotateCcw } from "lucide-react";
import { CommentList } from "@/components/comments/comment-list";
import { CommentEditor } from "@/components/comments/comment-editor";
import classnames from 'classnames';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor, AttachmentThumbnail } from "@/components/ui/rich-text-editor";
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
  isPersonal?: boolean; // Flag für persönliche Aufgaben ohne Board-ID
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

interface LabelSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
}

const defaultLabels = [
  "Wichtig", "Dringend", "Dokumentation", "Design", "Entwicklung",
  "Feedback", "Bug", "Feature", "Verbesserung", "Recherche", "Meeting",
  "Planung", "Review", "Test", "UX", "Vorarbeit", "Zuarbeit"
];

const LabelSelect = ({ value, onChange }: LabelSelectProps) => {
  const { currentBoard } = useStore();
  const [customLabel, setCustomLabel] = useState("");

  // Hole alle Tasks für das aktuelle Board
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/boards", currentBoard?.id, "tasks"],
    enabled: !!currentBoard?.id
  });

  // Extrahiere alle einzigartigen Labels aus den Tasks
  const existingLabels = useMemo(() => {
    const labelSet = new Set<string>();

    // Labels aus Tasks sammeln
    tasks.forEach(task => {
      if (task.labels && Array.isArray(task.labels)) {
        task.labels.forEach(label => {
          if (label && typeof label === 'string' && label.trim() !== '') {
            labelSet.add(label);
          }
        });
      }
    });

    // Standard-Labels hinzufügen
    defaultLabels.forEach(label => labelSet.add(label));

    // Als sortiertes Array zurückgeben
    return Array.from(labelSet).sort();
  }, [tasks]);

  // Bereite die Optionen für DialogMultiSelect vor
  const labelOptions = useMemo(() => {
    return existingLabels.map(label => ({
      value: label,
      label: label
    }));
  }, [existingLabels]);

  // Funktion zum Hinzufügen eines benutzerdefinierten Labels
  const handleAddCustomLabel = () => {
    if (customLabel.trim() && !value.includes(customLabel.trim())) {
      const newValue = [...value, customLabel.trim()];
      onChange(newValue);
      setCustomLabel("");
    }
  };

  return (
    <div className="space-y-2">
      {/* MultiSelect für vorhandene Labels */}
      <DialogMultiSelect
        options={labelOptions}
        selected={value}
        onChange={onChange}
        placeholder="Labels auswählen..."
      />
      
      {/* Input für benutzerdefinierte Labels */}
      <div className="flex gap-2">
        <Input 
          placeholder="Neues Label erstellen..."
          value={customLabel}
          onChange={(e) => setCustomLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddCustomLabel();
            }
          }}
        />
        <Button 
          type="button" 
          variant="outline" 
          size="icon"
          onClick={handleAddCustomLabel}
          disabled={!customLabel.trim()}
        >
          <PlusCircle className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Anzeige der aktuell ausgewählten Labels */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {value.map(label => (
            <div 
              key={label}
              className="bg-slate-100 text-xs px-2 py-1 rounded-full flex items-center gap-1"
            >
              <span>{label}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter(l => l !== label))}
                className="hover:text-rose-500 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};



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
  const [uploadedAttachments, setUploadedAttachments] = useState<string[]>([]);
  const [selectedAttachment, setSelectedAttachment] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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
      columnId: (task?.columnId && task.columnId > 0) ? task.columnId : (initialColumnId && initialColumnId > 0) ? initialColumnId : 1,
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

      // Reset form values
      form.reset({
        title: task?.title || "",
        description: task?.description || "",
        status: (task?.status || "todo") as "backlog" | "todo" | "in-progress" | "review" | "done",
        priority: (task?.priority || "medium") as "low" | "medium" | "high",
        columnId: (task?.columnId && task.columnId > 0) ? task.columnId : (initialColumnId && initialColumnId > 0) ? initialColumnId : 1,
        labels: task?.labels || [],
        assignedUserIds: task?.assignedUserIds || [],
        dueDate: task?.dueDate || null,
        archived: task?.archived || false,
        order: task?.order || 0,
      });

      // Aktualisiere uploadedAttachments mit den Anhängen aus der Aufgabe
      if (task?.attachments && Array.isArray(task.attachments)) {
        console.log("Setze Anhänge aus Task:", task.attachments);
        setUploadedAttachments(task.attachments);
      } else {
        setUploadedAttachments([]);
      }

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
            columnId: data.columnId && data.columnId > 0 ? data.columnId : 1, // Fallback zu 1 (erste Spalte) wenn undefined oder 0
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

  // Stelle sicher, dass uploadedAttachments die Anhänge aus dem Task enthält
  useEffect(() => {
    if (task?.attachments && Array.isArray(task.attachments) && task.attachments.length > 0) {
      console.log("Aktualisiere Anhänge in der Detailansicht:", task.attachments);
      setUploadedAttachments(task.attachments);
    }
  }, [task?.attachments]);

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
    // Find the creator (updated to use creator_id if available)
    const creator = users.find(user => user.id === (task as any)?.creator_id);
    const statusLabel = task?.status ? statusLabels[task.status as keyof typeof statusLabels] : "Unbekannt";
    const createdAtDate = task?.createdAt ? new Date(task.createdAt) : new Date();

    return (
      <div className="space-y-6">
        {/* Header mit Titel */}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">{task?.title}</h2>

          {/* Meta-Informationen in table-Layout */}
          <div className="text-sm">
            <table className="w-full">
              <tbody>
                {/* Labels */}
                {task?.labels && task.labels.length > 0 && (
                  <tr>
                    <td className="text-muted-foreground font-medium pr-2 py-0.5 align-top w-1/5">Labels:</td>
                    <td className="py-0.5">
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
                    </td>
                  </tr>
                )}

                {/* Erstellt */}
                <tr>
                  <td className="text-muted-foreground font-medium pr-2 py-0.5 w-1/5">Erstellt:</td>
                  <td className="py-0.5">{format(createdAtDate, "PPP", { locale: de })}</td>
                </tr>

                {/* Deadline */}
                {task?.dueDate && (
                  <tr>
                    <td className="text-muted-foreground font-medium pr-2 py-0.5 w-1/5">Deadline:</td>
                    <td className="py-0.5">
                      {format(new Date(task.dueDate), "PPP", { locale: de })}
                    </td>
                  </tr>
                )}

                {/* Ersteller */}
                {creator && (
                  <tr>
                    <td className="text-muted-foreground font-medium pr-2 py-0.5 w-1/5">Ersteller:</td>
                    <td className="py-0.5">
                      <div className="flex items-center gap-1">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={creator.avatarUrl || ""} />
                          <AvatarFallback>{creator.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span>{creator.username}</span>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Benutzer */}
                {assignedUsers.length > 0 && (
                  <tr>
                    <td className="text-muted-foreground font-medium pr-2 py-0.5 align-top w-1/5">Benutzer:</td>
                    <td className="py-0.5">
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
                    </td>
                  </tr>
                )}

                {/* Status */}
                <tr>
                  <td className="text-muted-foreground font-medium pr-2 py-0.5 w-1/5">Status:</td>
                  <td className="py-0.5">
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
                  </td>
                </tr>

                {/* Priorität */}
                <tr>
                  <td className="text-muted-foreground font-medium pr-2 py-0.5 w-1/5">Priorität:</td>
                  <td className="py-0.5">
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
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Trennlinie */}
        <div className="border-t border-slate-200"></div>

        {/* Beschreibung */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Beschreibung</div>
          {task?.richDescription ? (
              <div className="text-sm" dangerouslySetInnerHTML={{ __html: task.richDescription }} />
            ) : task?.description ? (
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
          {/* Prüfe ob Anhänge im Task oder im State vorhanden sind */}
          {((task?.attachments && task.attachments.length > 0) || uploadedAttachments.length > 0) ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {/* Verwende entweder die Anhänge aus dem State oder aus dem Task-Objekt */}
              {(uploadedAttachments.length > 0 ? uploadedAttachments : task?.attachments || []).map((url, index) => {
                const fileName = url.split('/').pop() || `Datei ${index + 1}`;
                const fileUrl = url.startsWith('/') ? window.location.origin + url : url;
                const isPdf = /\.pdf$/i.test(url);
                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                const isDoc = /\.(doc|docx)$/i.test(url);
                const isExcel = /\.(xls|xlsx|csv)$/i.test(url);

                return (
                  <div key={index} className="relative border rounded-md overflow-hidden">
                    <div className={`flex items-center p-2 ${
                      isPdf ? 'bg-red-50' : 
                      isImage ? 'bg-blue-50' : 
                      isDoc ? 'bg-indigo-50' : 
                      isExcel ? 'bg-green-50' : 
                      'bg-gray-50'
                    }`}>
                      {isPdf ? (
                        <FileText className="h-5 w-5 text-red-500 mr-2" />
                      ) : isImage ? (
                        <img src={fileUrl} alt={fileName} className="h-5 w-5 object-cover rounded mr-2" />
                      ) : isDoc ? (
                        <FileText className="h-5 w-5 text-indigo-500 mr-2" />
                      ) : isExcel ? (
                        <FileText className="h-5 w-5 text-green-500 mr-2" />
                      ) : (
                        <FileIcon className="h-5 w-5 text-gray-500 mr-2" />
                      )}
                      <span className={`text-sm font-medium ${
                        isPdf ? 'text-red-800' : 
                        isImage ? 'text-blue-800' : 
                        isDoc ? 'text-indigo-800' : 
                        isExcel ? 'text-green-800' : 
                        'text-gray-800'
                      }`}>{fileName}</span>

                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="ml-auto h-6 w-6 rounded-full hover:bg-red-100 hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation(); // Verhindere Bubbling zum Parent

                          // Entferne den Anhang aus dem lokalen State
                          const newAttachments = uploadedAttachments.filter((_, i) => i !== index);
                          setUploadedAttachments(newAttachments);

                          // Aktualisiere auch die Aufgabe, falls nötig
                          if (task?.id && onUpdate && typeof onUpdate === 'function') {
                            try {
                              const updatedTask = {
                                ...task,
                                attachments: newAttachments
                              };

                              // Führe onUpdate aus und behandle es als Promise
                              Promise.resolve(onUpdate(updatedTask as Task))
                                .then(() => {
                                  console.log("Anhang erfolgreich entfernt");

                                  // Manuell den QueryClient invalidieren für alle wichtigen TaskCard-Queries
                                  if (queryClient) {
                                    queryClient.invalidateQueries({ 
                                      queryKey: ["/api/boards"] 
                                    });
                                    queryClient.invalidateQueries({ 
                                      queryKey: ["/api/tasks"] 
                                    });

                                    // Prüfe ob boardId existiert und invalidiere spezifische Board-Tasks
                                    if (task.boardId) {
                                      queryClient.invalidateQueries({ 
                                        queryKey: ["/api/boards", task.boardId, "tasks"] 
                                      });
                                    }

                                    // Invalidiere die spezifische Task
                                    queryClient.invalidateQueries({ 
                                      queryKey: [`/api/tasks/${task.id}`] 
                                    });
                                  }
                                })
                                .catch((err) => {
                                  console.error("Fehler beim Entfernen des Anhangs:", err);
                                });
                            } catch (err) {
                              console.error("Fehler beim Aktualisieren der Aufgabe:", err);
                            }
                          }
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {isImage && (
                      <div className="p-3 bg-gray-50">
                        <a 
                          href={fileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.preventDefault();
                            window.open(fileUrl, '_blank', 'noopener,noreferrer');
                          }}
                          className="block"
                        >
                          <img 
                            src={fileUrl} 
                            alt={fileName} 
                            className="w-full h-32 object-contain bg-white p-2 border border-dashed rounded" 
                          />
                        </a>
                      </div>
                    )}

                    {!isImage && (
                      <div className="p-3 bg-gray-50">
                        <a 
                          href={fileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.preventDefault();
                            setSelectedAttachment(url);
                            window.open(fileUrl, '_blank', 'noopener,noreferrer');
                          }}
                          className="flex items-center justify-center p-4 border border-dashed rounded bg-white"
                        >
                          <div className="flex flex-col items-center">
                            {isPdf ? (
                              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-red-500 mb-2">
                                <path d="M7 18H17V16H7V18Z" fill="currentColor" />
                                <path d="M17 14H7V12H17V14Z" fill="currentColor" />
                                <path d="M7 10H11V8H7V10Z" fill="currentColor" />
                                <path fillRule="evenodd" clipRule="evenodd" d="M6 2C4.34315 2 3 3.34315 3 5V19C3 20.6569 4.34315 22 6 22H18C19.6569 22 21 20.6569 21 19V9C21 5.13401 17.866 2 14 2H6ZM6 4H13V9H19V19C19 19.5523 18.5523 20 18 20H6C5.44772 20 5 19.5523 5 19V5C5 4.44772 5.44772 4 6 4ZM15 4.10002C16.6113 4.4271 17.9413 5.52906 18.584 7H15V4.10002Z" fill="currentColor" />
                              </svg>
                            ) : isDoc ? (
                              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-indigo-500 mb-2">
                                <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M9 15H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M9 18H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M16 13H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            ) : isExcel ? (
                              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-green-500 mb-2">
                                <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M8 13H9V17H8V13Z" fill="currentColor"/>
                                <path d="M11 13H12V17H11V13Z" fill="currentColor"/>
                                <path d="M14 13H15V17H14V13Z" fill="currentColor"/>
                              </svg>
                            ) : (
                              <FileIcon className="h-12 w-12 text-gray-400 mb-2" />
                            )}
                            <span className="text-sm text-gray-600">{isPdf ? "PDF öffnen" : "Datei öffnen"}</span>
                          </div>
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">Keine Dateien angehängt</div>
          )}

          {/* Attachment Lightbox Dialog */}
          <Dialog open={!!selectedAttachment} onOpenChange={(open) => !open && setSelectedAttachment(null)}>
            <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-lg">
              <div className="relative bg-black/10 flex items-center justify-center">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSelectedAttachment(null)}
                  className="absolute top-2 right-2 z-10 bg-black/20 hover:bg-black/30 text-white"
                >
                  <X className="h-4 w-4" />
                </Button>

                {selectedAttachment && (
                  <>
                    {/\.(jpeg|jpg|gif|png|webp)$/i.test(selectedAttachment) ? (
                      // Bild Vorschau
                      <div className="w-full h-full flex items-center justify-center p-4">
                        <img 
                          src={selectedAttachment} 
                          alt="Vorschau" 
                          className="max-h-[70vh] max-w-full object-contain"
                        />
                      </div>
                    ) : /\.pdf$/i.test(selectedAttachment) ? (
                      // PDF Vorschau
                      <div className="w-full h-[70vh] bg-white">
                        <iframe 
                          src={selectedAttachment} 
                          title="PDF Vorschau" 
                          className="w-full h-full"
                        />
                      </div>
                    ) : (
                      // Andere Dateitypen
                      <div className="p-8 flex flex-col items-center justify-center">
                        <FileIcon className="h-16 w-16 text-blue-600 mb-4" />
                        <p className="text-lg font-medium mb-4">
                          {selectedAttachment.split('/').pop()}
                        </p>
                        <a 
                          href={selectedAttachment} 
                          download
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                        >
                          <Paperclip className="h-4 w-4" />
                          Herunterladen
                        </a>
                      </div>
                    )}
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
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
      <DialogContent className="max-w-3xl p-0">
        <div className="px-6 pt-6 pb-2">
          <DialogTitle>
            {isEditMode ? (task ? "Aufgabe bearbeiten" : "Neue Aufgabe") : ""}
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
                              console.log("Rich-Text-Editor hat Anhänge hochgeladen:", urls);
                              setUploadedAttachments(prev => {
                                const newAttachments = [...prev, ...urls];
                                console.log("Neue Anhangsliste in Task-Dialog:", newAttachments);

                                // Task sofort mit neuen Anhängen aktualisieren, wenn möglich
                                if (task && onUpdate && typeof onUpdate === 'function') {
                                  try {
                                    const updatedTask = {
                                      ...task,
                                      attachments: newAttachments
                                    };
                                    console.log("Sofortige Task-Aktualisierung mit neuen Anhängen", updatedTask);

                                    // Führe onUpdate aus und fange Promise korrekt ab oder behandle es als normalen Funktionsaufruf
                                    const result = onUpdate(updatedTask as Task);
                                    if (result && typeof result.then === 'function') {
                                      result
                                        .then(() => console.log("Task mit neuen Anhängen aktualisiert"))
                                        .catch(err => console.error("Fehler beim Aktualisieren des Tasks mit Anhängen:", err));
                                    } else {
                                      console.log("Task-Aktualisierung aufgerufen (keine Promise-Rückgabe)");
                                    }
                                  } catch (error) {
                                    console.error("Fehler bei der Task-Aktualisierung:", error);
                                  }
                                }

                                return newAttachments;
                              });
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Datei-Upload Bereich */}
                  <div className="space-y-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Dateien anhängen</label>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1"
                          disabled={uploading}
                        >
                          {uploading ? (
                            <>
                              <span className="animate-pulse">Lädt...</span>
                            </>
                          ) : (
                            <>
                              <Paperclip className="h-4 w-4" />
                              <span>Hochladen</span>
                            </>
                          )}
                        </Button>
                      </div>

                      {uploading && (
                        <div className="w-full">
                          <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all duration-300 ease-in-out" 
                              style={{ width: `${uploadProgress}%` }}
                            ></div>
                          </div>
                          <div className="text-xs text-center mt-1 text-muted-foreground">
                            {uploadProgress === 100 ? 'Verarbeite...' : `${uploadProgress}% hochgeladen`}
                          </div>
                        </div>
                      )}
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        multiple
                        onChange={(e) => {
                          if (e.target.files?.length) {
                            const fileArray = Array.from(e.target.files);
                            setFiles(prev => [...prev, ...fileArray]);

                            // Upload gestartet
                            setUploading(true);
                            setUploadProgress(0);

                            // Upload-Logik hier...
                            const formData = new FormData();

                            // Wir verwenden den allgemeinen Upload-Endpunkt mit Typ 'task'
                            for (const file of fileArray) {
                              formData.append('file', file);
                            }

                            // Füge Metadaten hinzu
                            formData.append('type', 'task');
                            if (task?.id) {
                              formData.append('entityId', task.id.toString());
                            }

                            // Simuliere Fortschrittsanzeige mit zufälligem Maximalwert
                            const simulateProgress = () => {
                              let progress = 0;
                              // Zufälliger Maximalwert zwischen 90% und 98%
                              const maxProgress = 90 + Math.floor(Math.random() * 9);
                              console.log(`Maximaler Fortschritt für diesen Upload: ${maxProgress}%`);

                              const interval = setInterval(() => {
                                progress += Math.random() * 10;
                                if (progress > maxProgress) {
                                  progress = maxProgress; // Cap bei maxProgress, 100% erst bei Fertigstellung
                                  clearInterval(interval);
                                }
                                setUploadProgress(Math.min(Math.round(progress), maxProgress));
                              }, 300);
                              return interval;
                            };

                            const progressInterval = simulateProgress();

                            fetch('/api/upload', {
                              method: 'POST',
                              body: formData,
                              credentials: 'include' // Wichtig für die Session-Authentifizierung
                            })
                            .then(res => {
                              clearInterval(progressInterval);
                              setUploadProgress(100); // Auf 100% setzen, wenn Antwort zurückkommt

                              if (!res.ok) {
                                throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
                              }
                              return res.json();
                            })
                            .then((data) => {
                              if (data.url) {
                                // Einzelne Datei-URL vom Server
                                const newAttachments = [...uploadedAttachments, data.url];
                                setUploadedAttachments(newAttachments);

                                // Aktualisiere die Aufgabe sofort, falls eine existiert
                                if (task?.id && onUpdate && typeof onUpdate === 'function') {
                                  console.log("Upload erfolgreich, aktualisiere Task mit neuem Anhang:", data.url);
                                  console.log("Aktuelle Anhänge:", uploadedAttachments);
                                  console.log("Neue Anhänge:", newAttachments);

                                  const updatedTask = {
                                    ...task,
                                    attachments: newAttachments
                                  };

                                  try {
                                    // Führe onUpdate aus und behandle es als Promise
                                    Promise.resolve(onUpdate(updatedTask as Task))
                                      .then(() => {
                                        console.log("Aufgabe mit neuem Anhang aktualisiert:", newAttachments);

                                        // Manuell den QueryClient invalidieren für alle wichtigen TaskCard-Queries
                                        if (queryClient) {
                                          queryClient.invalidateQueries({ 
                                            queryKey: ["/api/boards"] 
                                          });
                                          queryClient.invalidateQueries({ 
                                            queryKey: ["/api/tasks"] 
                                          });

                                          // Prüfe ob boardId existiert und invalidiere spezifische Board-Tasks
                                          if (task.boardId) {
                                            queryClient.invalidateQueries({ 
                                              queryKey: ["/api/boards", task.boardId, "tasks"] 
                                            });
                                          }

                                          // Invalidiere die spezifische Task
                                          queryClient.invalidateQueries({ 
                                            queryKey: [`/api/tasks/${task.id}`] 
                                          });
                                        }
                                      })
                                      .catch(updateError => {
                                        console.error("Fehler beim Aktualisieren der Aufgabe mit Anhang:", updateError);
                                      });
                                  } catch (err) {
                                    console.error("Fehler beim Aktualisieren der Aufgabe:", err);
                                  }
                                }

                                toast({
                                  title: "Datei erfolgreich hochgeladen",
                                  description: `${data.originalname || 'Datei'} wurde hochgeladen.`
                                });
                              } else if (data.urls && Array.isArray(data.urls)) {
                                // Mehrere Datei-URLs
                                const newAttachments = [...uploadedAttachments, ...data.urls];
                                setUploadedAttachments(newAttachments);

                                // Aktualisiere die Aufgabe sofort, falls eine existiert
                                if (task?.id && onUpdate && typeof onUpdate === 'function') {
                                  console.log("Mehrere Dateien hochgeladen, aktualisiere Task mit neuen Anhängen:", data.urls);
                                  console.log("Aktuelle Anhänge:", uploadedAttachments);
                                  console.log("Neue Anhänge:", newAttachments);

                                  const updatedTask = {
                                    ...task,
                                    attachments: newAttachments
                                  };

                                  try {
                                    // Führe onUpdate aus und behandle es als Promise
                                    Promise.resolve(onUpdate(updatedTask as Task))
                                      .then(() => {
                                        console.log("Aufgabe mit neuen Anhängen aktualisiert:", newAttachments);

                                        // Manuell den QueryClient invalidieren für alle wichtigen TaskCard-Queries
                                        if (queryClient) {
                                          queryClient.invalidateQueries({ 
                                            queryKey: ["/api/boards"] 
                                          });
                                          queryClient.invalidateQueries({ 
                                            queryKey: ["/api/tasks"] 
                                          });

                                          // Prüfe ob boardId existiert und invalidiere spezifische Board-Tasks
                                          if (task.boardId) {
                                            queryClient.invalidateQueries({ 
                                              queryKey: ["/api/boards", task.boardId, "tasks"] 
                                            });
                                          }

                                          // Invalidiere die spezifische Task
                                          queryClient.invalidateQueries({ 
                                            queryKey: [`/api/tasks/${task.id}`] 
                                          });
                                        }
                                      })
                                      .catch(updateError => {
                                        console.error("Fehler beim Aktualisieren der Aufgabe mit Anhängen:", updateError);
                                      });
                                  } catch (err) {
                                    console.error("Fehler beim Aktualisieren der Aufgabe:", err);
                                  }
                                }

                                toast({
                                  title: "Dateien erfolgreich hochgeladen",
                                  description: `${data.urls.length} Datei(en) wurden erfolgreich hochgeladen.`
                                });
                              }

                              // Upload abgeschlossen, Status zurücksetzen
                              setUploading(false);
                            })
                            .catch(err => {
                              console.error("Fehler beim Hochladen:", err);
                              let errorMsg = "Die Dateien konnten nicht hochgeladen werden.";

                              if (err.message && err.message.includes('HTTP error 401')) {
                                errorMsg = "Bitte melden Sie sich an, um Dateien hochzuladen.";
                              } else if (err.message && err.message.includes('HTTP error 413')) {
                                errorMsg = "Die Datei ist zu groß. Maximale Größe überschritten.";
                              }

                              // Auch bei Fehler Upload-Status zurücksetzen
                              setUploading(false);

                              toast({
                                title: "Fehler beim Hochladen",
                                description: errorMsg,
                                variant: "destructive"
                              });
                            });
                          }
                        }}
                      />
                    </div>

                    {/* Anzeige der hochgeladenen Dateien im Stil der Kommentare */}
                    {uploadedAttachments.length > 0 && (
                      <div className="space-y-2 mt-2">
                        <div className="text-sm font-medium">Angehängte Dateien ({uploadedAttachments.length})</div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {uploadedAttachments.map((url, index) => {
                            console.log("Rendering attachment:", url);
                            const fileName = url.split('/').pop() || 'Datei';
                            const fileUrl = url.startsWith('/') ? window.location.origin + url : url;
                            const isPdf = /\.pdf$/i.test(url);
                            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                            const isDoc = /\.(doc|docx)$/i.test(url);
                            const isExcel = /\.(xls|xlsx|csv)$/i.test(url);

                            return (
                              <div key={index} className="relative border rounded-md overflow-hidden">
                                <div className={`flex items-center p-2 ${
                                  isPdf ? 'bg-red-50' : 
                                  isImage ? 'bg-blue-50' : 
                                  isDoc ? 'bg-indigo-50' : 
                                  isExcel ? 'bg-green-50' : 
                                  'bg-gray-50'
                                }`}>
                                  {isPdf ? (
                                    <FileText className="h-5 w-5 text-red-500 mr-2" />
                                  ) : isImage ? (
                                    <img src={fileUrl} alt={fileName} className="h-5 w-5 object-cover rounded mr-2" />
                                  ) : isDoc ? (
                                    <FileText className="h-5 w-5 text-indigo-500 mr-2" />
                                  ) : isExcel ? (
                                    <FileText className="h-5 w-5 text-green-500 mr-2" />
                                  ) : (
                                    <FileIcon className="h-5 w-5 text-gray-500 mr-2" />
                                  )}
                                  <span className={`text-sm font-medium ${
                                    isPdf ? 'text-red-800' : 
                                    isImage ? 'text-blue-800' : 
                                    isDoc ? 'text-indigo-800' : 
                                    isExcel ? 'text-green-800' : 
                                    'text-gray-800'
                                  }`}>{fileName}</span>

                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="ml-auto h-6 w-6 rounded-full hover:bg-red-100 hover:text-red-600"
                                    onClick={() => {
                                      // Entferne den Anhang aus dem lokalen State
                                      const newAttachments = uploadedAttachments.filter((_, i) => i !== index);
                                      setUploadedAttachments(newAttachments);

                                      // Aktualisiere auch die Aufgabe, falls nötig
                                      if (task?.id && onUpdate && typeof onUpdate === 'function') {
                                        try {
                                          const updatedTask = {
                                            ...task,
                                            attachments: newAttachments
                                          };

                                          // Führe onUpdate aus und behandle es als Promise
                                          Promise.resolve(onUpdate(updatedTask as Task))
                                            .then(() => {
                                              console.log("Anhang erfolgreich entfernt");

                                              // Manuell den QueryClient invalidieren für alle wichtigen TaskCard-Queries
                                              if (queryClient) {
                                                queryClient.invalidateQueries({ 
                                                  queryKey: ["/api/boards"] 
                                                });
                                                queryClient.invalidateQueries({ 
                                                  queryKey: ["/api/tasks"] 
                                                });

                                                // Prüfe ob boardId existiert und invalidiere spezifische Board-Tasks
                                                if (task.boardId) {
                                                  queryClient.invalidateQueries({ 
                                                    queryKey: ["/api/boards", task.boardId, "tasks"] 
                                                  });
                                                }

                                                // Invalidiere die spezifische Task
                                                queryClient.invalidateQueries({ 
                                                  queryKey: [`/api/tasks/${task.id}`] 
                                                });
                                              }
                                            })
                                            .catch((err) => {
                                              console.error("Fehler beim Entfernen des Anhangs:", err);
                                            });
                                        } catch (err) {
                                          console.error("Fehler beim Aktualisieren der Aufgabe:", err);
                                        }
                                      }
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>

                                {isImage && (
                                  <div className="p-3 bg-gray-50">
                                    <a 
                                      href={fileUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        window.open(fileUrl, '_blank', 'noopener,noreferrer');
                                      }}
                                      className="block"
                                    >
                                      <img 
                                        src={fileUrl} 
                                        alt={fileName} 
                                        className="w-full h-32 object-contain bg-white p-2 border border-dashed rounded" 
                                      />
                                    </a>
                                  </div>
                                )}

                                {!isImage && (
                                  <div className="p-3 bg-gray-50">
                                    <a 
                                      href={fileUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        window.open(fileUrl, '_blank', 'noopener,noreferrer');
                                      }}
                                      className="flex items-center justify-center p-4 border border-dashed rounded bg-white"
                                    >
                                      <div className="flex flex-col items-center">
                                        {isPdf ? (
                                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-red-500 mb-2">
                                            <path d="M7 18H17V16H7V18Z" fill="currentColor" />
                                            <path d="M17 14H7V12H17V14Z" fill="currentColor" />
                                            <path d="M7 10H11V8H7V10Z" fill="currentColor" />
                                            <path fillRule="evenodd" clipRule="evenodd" d="M6 2C4.34315 2 3 3.34315 3 5V19C3 20.6569 4.34315 22 6 22H18C19.6569 22 21 20.6569 21 19V9C21 5.13401 17.866 2 14 2H6ZM6 4H13V9H19V19C19 19.5523 18.5523 20 18 20H6C5.44772 20 5 19.5523 5 19V5C5 4.44772 5.44772 4 6 4ZM15 4.10002C16.6113 4.4271 17.9413 5.52906 18.584 7H15V4.10002Z" fill="currentColor" />
                                          </svg>
                                        ) : isDoc ? (
                                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-indigo-500 mb-2">
                                            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M9 15H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M9 18H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M16 13H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                          </svg>
                                        ) : isExcel ? (
                                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-green-500 mb-2">
                                            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M8 13H9V17H8V13Z" fill="currentColor"/>
                                            <path d="M11 13H12V17H11V13Z" fill="currentColor"/>
                                            <path d="M14 13H15V17H14V13Z" fill="currentColor"/>
                                          </svg>
                                        ) : (
                                          <FileIcon className="h-12 w-12 text-gray-400 mb-2" />
                                        )}
                                        <span className="text-sm text-gray-600">{isPdf ? "PDF öffnen" : "Datei öffnen"}</span>
                                      </div>
                                    </a>
                                  </div>
                                )}
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
                            <div className="p-3">
                              <Calendar
                                mode="single"
                                selected={field.value ? new Date(field.value) : undefined}
                                onSelect={(date) => {
                                  field.onChange(date ? date.toISOString() : null);
                                }}
                                disabled={(date) =>
                                  date < new Date(new Date().setHours(0, 0, 0, 0))
                                }
                              />
                            </div>
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
                            {/* Replaced with LabelSelect Component */}
                            <LabelSelect value={field.value || []} onChange={field.onChange} />
                          </div>
                        </div>
                        <FormMessage />
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

            <div className="fixed bottom-0 w-full p-4 bg-background border-t border-border flex justify-between rounded-b-lg">
              <div>
                {task && (
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm"
                    className="border-red-500 text-red-600 hover:bg-red-50"
                    onClick={() => {
                      try {
                        form.setValue("archived", !form.getValues("archived"));
                        // Wenn wir im Formular-Modus sind, müssen wir sonst nichts tun - 
                        // die Änderung wird beim Speichern des Formulars übernommen.
                        toast({
                          title: form.getValues("archived") 
                            ? "Aufgabe wird archiviert..." 
                            : "Aufgabe wird wiederhergestellt...",
                        });
                      } catch (error) {
                        toast({
                          title: "Fehler",
                          description: "Die Einstellung konnte nicht geändert werden",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    {form.getValues("archived") ? (
                      <>
                        <RotateCcw className="h-4 w-4 mr-1.5" />
                        Wiederherstellen
                      </>
                    ) : (
                      <>
                        <Archive className="h-4 w-4 mr-1.5" />
                        Archivieren
                      </>
                    )}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
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
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="px-6 overflow-y-auto pb-24" style={{ maxHeight: "calc(85vh - 120px)" }}>
              {renderDetailView()}
            </div>

            <div className="fixed bottom-0 w-full p-4 bg-background border-t border-border flex justify-between rounded-b-lg">
              <div className="flex gap-2">
                {task && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className={task.archived 
                      ? "bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-md transition-all duration-300 hover:shadow-lg border-transparent" 
                      : "border-red-500 text-red-600 hover:bg-red-50"}
                    onClick={async () => {
                      if (!task) return;
                      try {
                        // Wir bereiten ein Objekt vor, das nur die notwendigen Felder enthält,
                        // die für die API-Validierung erforderlich sind
                        const updatedTask: UpdateTask = {
                          id: task.id,
                          title: task.title,
                          status: task.status,
                          priority: task.priority || "medium",
                          order: task.order, 
                          boardId: task.boardId,
                          archived: !task.archived,
                          // Weitere erforderliche Felder
                          assignedUserIds: task.assignedUserIds || [],
                          labels: task.labels || []
                        };

                        if (onUpdate) {
                          await onUpdate(updatedTask);

                          toast({
                            title: updatedTask.archived 
                              ? "Aufgabe archiviert" 
                              : "Aufgabe wiederhergestellt",
                          });
                        }
                      } catch (error) {
                        console.error("Fehler beim Archivieren:", error);
                        toast({
                          title: "Fehler",
                          description: getErrorMessage(error) || "Die Aufgabe konnte nicht archiviert werden",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    {task.archived ? (
                      <>
                        <RotateCcw className="h-4 w-4 mr-1.5" />
                        Wiederherstellen
                      </>
                    ) : (
                      <>
                        <Archive className="h-4 w-4 mr-1.5" />
                        Archivieren
                      </>
                    )}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
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
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}