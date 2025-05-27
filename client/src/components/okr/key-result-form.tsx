
import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type KeyResult, insertKeyResultSchema, keyResults } from '@shared/schema';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Plus, Check, CheckSquare2, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

// Definiere einen Typ für ChecklistItems
interface ChecklistItem {
  title: string;
  completed: boolean;
}

// Definiere den FormData-Typ basierend auf dem Insert-Schema und eigenen Ergänzungen
type KeyResultFormData = Omit<z.infer<typeof insertKeyResultSchema>, 'checklistItems'> & {
  checklistItems?: ChecklistItem[];
};

interface KeyResultFormProps {
  objectiveId: number;
  keyResult?: KeyResult;
  onSuccess?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyResultForm({
  objectiveId,
  keyResult,
  onSuccess,
  open,
  onOpenChange
}: KeyResultFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Validierungsschema erstellen (erweitert aus insertKeyResultSchema)
  const validationSchema = insertKeyResultSchema.extend({
    title: z.string().min(1, "Titel ist erforderlich"),
    description: z.string().optional(),
    type: z.enum(["percentage", "checkbox", "checklist"], {
      required_error: "Bitte wählen Sie einen Typ",
    }),
    // Validierung je nach Typ unterschiedlich
    targetValue: z.number()
      .min(0, "Der Zielwert darf nicht negativ sein")
      .refine(val => val >= 1, { 
        message: "Der Zielwert muss mindestens 1 sein", 
        // Nur prüfen, wenn der Typ nicht checkbox ist
        path: ['targetValue'] 
      }),
    currentValue: z.number().min(0, "Der aktuelle Wert darf nicht negativ sein"),
    status: z.enum(["active", "completed", "archived"], {
      required_error: "Bitte wählen Sie einen Status",
    }),
    // Checklistitems: Entweder ein Array aus Objekten oder ein leeres Array
    checklistItems: z.array(
      z.object({
        title: z.string().min(1, "Titel ist erforderlich").default(""),
        completed: z.boolean().default(false),
      })
    ).default([])
      // Nur überprüfen, wenn der Typ "checklist" ist
      .refine(items => items.length === 0 || items.some(item => item.title.trim() !== ""), {
        message: "Mindestens ein gültiges Checklisten-Element wird benötigt",
        path: ['checklistItems'],
      }),
  });
  
  // Verarbeite den Typ aus dem Key Result und konvertiere alte Typen wenn nötig
  const getValidType = (type: string | undefined): "percentage" | "checkbox" | "checklist" => {
    if (!type) return "percentage";
    
    // Konvertiere alte "progress" Typen zu "percentage"
    if (type === "progress") return "percentage";
    
    // Überprüfe, ob der Typ gültig ist, sonst Standardtyp
    return ["percentage", "checkbox", "checklist"].includes(type as any) 
      ? (type as "percentage" | "checkbox" | "checklist") 
      : "percentage";
  };

  // Erstelle Standardwerte für das Formular
  const defaultValues: Partial<KeyResultFormData> = {
    title: keyResult?.title || '',
    description: keyResult?.description || '',
    currentValue: keyResult?.currentValue || 0,
    targetValue: keyResult?.targetValue || 100,
    type: getValidType(keyResult?.type),
    status: (keyResult?.status as "active" | "completed" | "archived") || "active",
    objectiveId: objectiveId,
    // Stelle sicher, dass checklistItems das richtige Format hat
    checklistItems: Array.isArray(keyResult?.checklistItems) && keyResult.checklistItems.length > 0
      ? keyResult.checklistItems.map(item => {
          if (typeof item === 'string') {
            // Handle alte Datenformat (String-Array)
            return { title: item, completed: false };
          }
          return item as ChecklistItem;
        })
      : [{ title: '', completed: false }] // Standardmäßig ein leeres Checklisten-Item
  };
  
  console.log('Formular-Standardwerte:', defaultValues);
  
  const form = useForm<KeyResultFormData>({
    resolver: zodResolver(validationSchema),
    defaultValues
  });

  // useFieldArray für die dynamische Verwaltung von Checklisten-Elementen
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "checklistItems",
  });

  // Aktiver Typ aus dem Formular
  const currentType = form.watch("type");

  // Effekt zum Erstellen eines Checklisten-Elements, wenn der Typ zu "checklist" geändert wird
  useEffect(() => {
    if (currentType === "checklist" && (!fields || fields.length === 0)) {
      append({ title: "", completed: false });
    }
  }, [currentType, fields, append]);

  const mutation = useMutation({
    mutationFn: async (data: KeyResultFormData) => {
      // Einfacher direkter Ansatz, der sicherstellt, dass die checklistItems-Eigenschaft immer richtig ist
      // und die Daten direkt verändert, um Checkbox-Typen korrekt zu handhaben
      
      // Kopieren der Daten, um sie zu bearbeiten
      let processedData: any = { ...data };
      
      // Bei Checkbox-Typ auf Checklist umschalten (Workaround)
      // Diese Lösung verwendet den Checklist-Typ, der nachweislich funktioniert
      // und fügt eine einzelne Checkbox hinzu
      if (processedData.type === "checkbox") {
        console.log("Workaround: Konvertiere Checkbox in Checkliste mit einem Element");
        
        // Konvertiere den Typ
        processedData.type = "checklist";
        
        // Erstelle eine einzelne Checklist mit dem Namen des Key Results
        const title = processedData.title || "Erledigt";
        const isCompleted = (processedData.currentValue || 0) > 0;
        
        // Diese einzelne Checkliste repräsentiert die Checkbox
        processedData.checklistItems = [
          { title, completed: isCompleted }
        ];
      } 
      else if (processedData.type === "checklist") {
        // Für Checklist: Nur gültige Elemente behalten und richtig formatieren
        if (processedData.checklistItems && Array.isArray(processedData.checklistItems)) {
          processedData.checklistItems = processedData.checklistItems
            .filter((item: any) => item.title && item.title.trim() !== "");
        }
      }
      else {
        // Für alle anderen Typen: Keine checklistItems
        delete processedData.checklistItems;
      }
      
      // Endpunkte basierend auf Bearbeitungs- oder Erstellungsmodus
      const method = keyResult ? "PATCH" : "POST";
      const endpoint = keyResult 
        ? `/api/key-results/${keyResult.id}`
        : `/api/objectives/${objectiveId}/key-results`;
      
      // Sicherstellen, dass die objectiveId immer gesetzt ist
      processedData.objectiveId = objectiveId;
      
      console.log(`[DEBUG] Finaler Payload (${method}) an ${endpoint}:`, JSON.stringify(processedData, null, 2));
      
      // Direkter Fetch-Aufruf mit umfangreichem Logging
      try {
        const response = await fetch(endpoint, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(processedData),
          credentials: 'include'
        });
        
        console.log(`Server-Antwort (${response.status}): ${response.statusText}`);
        
        if (!response.ok) {
          let errorMessage = `Fehler ${response.status}: ${response.statusText}`;
          try {
            const errorText = await response.text();
            console.error('Fehlerdetails vom Server:', errorText);
            errorMessage = errorText || errorMessage;
          } catch (e) {
            console.error('Fehler beim Lesen der Fehlermeldung:', e);
          }
          throw new Error(errorMessage);
        }
        
        const result = await response.json();
        console.log('Erfolgreiche Antwort:', result);
        return result;
      } catch (error) {
        console.error('API-Anfrage fehlgeschlagen:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/objectives/${objectiveId}`]
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/objectives", objectiveId, "key-results"]
      });
      onSuccess?.();
      onOpenChange(false);
      toast({
        title: keyResult ? "Key Result aktualisiert" : "Key Result erstellt",
        description: "Die Änderungen wurden erfolgreich gespeichert."
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error 
          ? error.message
          : keyResult 
            ? "Fehler beim Aktualisieren des Key Results"
            : "Fehler beim Erstellen des Key Results",
        variant: "destructive"
      });
    }
  });

  const onSubmit = form.handleSubmit((data) => {
    console.log("Formulardaten beim Absenden:", data);
    
    // Beim Checkbox-Typ erfolgt dieselbe Konvertierung zu Checklist wie in der Mutation
    if (data.type === "checkbox") {
      // Workaround: Konvertiere Checkbox in eine Checkliste mit einem Element
      console.log("onSubmit: Konvertiere Checkbox in Checkliste mit einem Element");
      
      // Werte speichern, bevor wir den Typ ändern
      const isChecked = (data.currentValue || 0) > 0;
      const title = data.title || "Erledigt";
      
      // Typ ändern
      data.type = "checklist";
      
      // Einzelne Checkliste mit dem Titel des Key Results erstellen
      data.checklistItems = [
        { title, completed: isChecked }
      ];
    }
    
    // Wenn der Typ "checklist" ist, überprüfe, ob gültige Elemente vorhanden sind
    if (data.type === "checklist") {
      const validItems = data.checklistItems?.filter((item: any) => item.title.trim() !== "") || [];
      if (validItems.length === 0) {
        toast({
          title: "Fehler",
          description: "Bitte fügen Sie mindestens ein gültiges Checklisten-Element hinzu",
          variant: "destructive"
        });
        return;
      }
      
      // Nur gültige Checklisten-Elemente behalten
      data.checklistItems = validItems;
    }
    
    // Logge die finalen Daten vor dem Senden
    console.log("Finale Daten zum Senden:", data);
    
    mutation.mutate(data);
  });

  // Funktion zum Hinzufügen eines neuen Checklisten-Elements
  const addChecklistItem = () => {
    append({ title: "", completed: false });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {keyResult ? "Key Result bearbeiten" : "Neues Key Result erstellen"}
          </DialogTitle>
          <DialogDescription>
            Key Results sind messbare Ergebnisse, die den Fortschritt eines Objectives quantifizieren.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titel</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="z.B. 100 neue Kunden gewinnen" />
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
                    <Textarea 
                      placeholder="Detaillierte Beschreibung des Key Results"
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      value={field.value || ''}
                      disabled={field.disabled}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Typ</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      console.log("Type changed to:", value);
                      field.onChange(value);
                      
                      // Bei Typ "checkbox" Standardwerte setzen
                      if (value === "checkbox") {
                        form.setValue("targetValue", 1);
                        form.setValue("currentValue", 0);
                      }
                    }} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Typ auswählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="percentage">Prozentsatz</SelectItem>
                      <SelectItem value="checklist">Checkliste</SelectItem>
                      <SelectItem value="checkbox">Checkbox</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {currentType === "percentage" && (
              <div className="flex flex-col gap-4 sm:flex-row">
                <FormField
                  control={form.control}
                  name="currentValue"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Aktueller Wert</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="targetValue"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Zielwert</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
            
            {currentType === "checkbox" && (
              <div className="rounded-md border p-4 bg-muted/30">
                <div className="flex items-center gap-3 mb-1">
                  <Checkbox 
                    id="checkbox-info"
                    checked={(form.watch("currentValue") || 0) > 0}
                    onCheckedChange={(checked) => {
                      // Wenn angehakt, setze currentValue auf 1, sonst auf 0
                      form.setValue("currentValue", checked ? 1 : 0);
                      // Setze targetValue immer auf 1 bei Checkbox-Typ
                      form.setValue("targetValue", 1);
                    }}
                  />
                  <label htmlFor="checkbox-info" className="text-sm font-medium">
                    Status
                  </label>
                </div>
                <p className="text-xs text-muted-foreground ml-7">
                  Für den Checkbox-Typ wird automatisch ein Zielwert von 1 gesetzt. 
                  Der aktuelle Wert wird auf 1 (erledigt) oder 0 (nicht erledigt) gesetzt.
                </p>
              </div>
            )}

            {/* Checklisten-Bereich wird angezeigt, wenn der Typ "checklist" ist */}
            {currentType === "checklist" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <FormLabel>Checklisten-Elemente</FormLabel>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={addChecklistItem}
                    className="h-8 px-2"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Hinzufügen
                  </Button>
                </div>
                
                <Card>
                  <CardContent className="p-3 space-y-2">
                    {fields.length === 0 ? (
                      <div className="text-center py-2 text-sm text-muted-foreground">
                        Keine Elemente. Klicken Sie auf "Hinzufügen", um ein Element zu erstellen.
                      </div>
                    ) : (
                      fields.map((field, index) => (
                        <div key={field.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`checklistItems.${index}.completed`}
                            checked={form.watch(`checklistItems.${index}.completed`)}
                            onCheckedChange={(checked) => {
                              form.setValue(`checklistItems.${index}.completed`, checked === true);
                            }}
                            className="mt-0.5"
                          />
                          <Input
                            {...form.register(`checklistItems.${index}.title`)}
                            placeholder="Element-Titel"
                            className="flex-1"
                          />
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => remove(index)}
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
                
                {form.formState.errors.checklistItems && (
                  <p className="text-sm font-medium text-destructive">
                    Mindestens ein Checklisten-Element wird benötigt
                  </p>
                )}
              </div>
            )}

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Status auswählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Aktiv</SelectItem>
                      <SelectItem value="completed">Abgeschlossen</SelectItem>
                      <SelectItem value="archived">Archiviert</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                Abbrechen
              </Button>
              <Button 
                type="submit" 
                disabled={mutation.isPending}
                className="min-w-24"
              >
                {mutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Wird gespeichert...
                  </span>
                ) : (
                  keyResult ? "Speichern" : "Erstellen"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
