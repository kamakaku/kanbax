import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusCircle, Edit, Loader2, Pause, Play, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Schema für Unternehmensformular
const companyFormSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  description: z.string().optional(),
  inviteCode: z.string().min(6, "Einladungscode muss mindestens 6 Zeichen haben"),
});

// Schema für das Pausieren eines Unternehmens
const pauseCompanySchema = z.object({
  pauseReason: z.string().min(1, "Begründung ist erforderlich"),
});

export default function AdminCompanies() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isPauseDialogOpen, setIsPauseDialogOpen] = React.useState(false);
  const [selectedCompany, setSelectedCompany] = React.useState<any>(null);

  // Formular für Unternehmenserstellung
  const createForm = useForm({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: "",
      description: "",
      inviteCode: "",
    }
  });

  // Formular für Unternehmensbearbeitung
  const editForm = useForm({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: "",
      description: "",
      inviteCode: "",
    }
  });
  
  // Formular für das Pausieren eines Unternehmens
  const pauseForm = useForm({
    resolver: zodResolver(pauseCompanySchema),
    defaultValues: {
      pauseReason: "",
    }
  });

  // Unternehmen abrufen
  const { data: companies = [], isLoading, error } = useQuery({
    queryKey: ['/api/admin/companies'],
    retry: false,
  });

  // Unternehmen erstellen
  const createMutation = useMutation({
    mutationFn: (data: z.infer<typeof companyFormSchema>) => {
      return apiRequest('/api/admin/companies', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/companies'] });
      toast({
        title: "Unternehmen erstellt",
        description: "Das Unternehmen wurde erfolgreich erstellt.",
      });
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Beim Erstellen des Unternehmens ist ein Fehler aufgetreten.",
        variant: "destructive",
      });
    },
  });

  // Unternehmen aktualisieren
  const updateMutation = useMutation({
    mutationFn: (data: z.infer<typeof companyFormSchema> & { id: number }) => {
      return apiRequest(`/api/admin/companies/${data.id}`, 'PATCH', {
        name: data.name,
        description: data.description,
        inviteCode: data.inviteCode,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/companies'] });
      toast({
        title: "Unternehmen aktualisiert",
        description: "Das Unternehmen wurde erfolgreich aktualisiert.",
      });
      setIsEditDialogOpen(false);
      setSelectedCompany(null);
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Beim Aktualisieren des Unternehmens ist ein Fehler aufgetreten.",
        variant: "destructive",
      });
    },
  });
  
  // Unternehmen pausieren
  const pauseMutation = useMutation({
    mutationFn: (data: { id: number, pauseReason: string }) => {
      return apiRequest(`/api/admin/companies/${data.id}/pause`, 'POST', {
        pauseReason: data.pauseReason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/companies'] });
      toast({
        title: "Unternehmen pausiert",
        description: "Das Unternehmen wurde erfolgreich pausiert.",
      });
      setIsPauseDialogOpen(false);
      setSelectedCompany(null);
      pauseForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Beim Pausieren des Unternehmens ist ein Fehler aufgetreten.",
        variant: "destructive",
      });
    },
  });
  
  // Unternehmen fortsetzen
  const resumeMutation = useMutation({
    mutationFn: (id: number) => {
      return apiRequest(`/api/admin/companies/${id}/resume`, 'POST', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/companies'] });
      toast({
        title: "Unternehmen fortgesetzt",
        description: "Das Unternehmen wurde erfolgreich fortgesetzt.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Beim Fortsetzen des Unternehmens ist ein Fehler aufgetreten.",
        variant: "destructive",
      });
    },
  });

  // Unternehmen zum Bearbeiten auswählen
  const handleEditCompany = (company: any) => {
    setSelectedCompany(company);
    editForm.reset({
      name: company.name,
      description: company.description || "",
      inviteCode: company.inviteCode,
    });
    setIsEditDialogOpen(true);
  };
  
  // Unternehmen zum Pausieren auswählen
  const handlePauseCompany = (company: any) => {
    setSelectedCompany(company);
    pauseForm.reset({ pauseReason: "" });
    setIsPauseDialogOpen(true);
  };
  
  // Unternehmen fortsetzen
  const handleResumeCompany = (company: any) => {
    if (confirm(`Möchten Sie das Unternehmen "${company.name}" wirklich fortsetzen?`)) {
      resumeMutation.mutate(company.id);
    }
  };

  // Formular zum Erstellen eines Unternehmens abschicken
  const onCreateSubmit = (values: z.infer<typeof companyFormSchema>) => {
    createMutation.mutate(values);
  };

  // Formular zum Aktualisieren eines Unternehmens abschicken
  const onEditSubmit = (values: z.infer<typeof companyFormSchema>) => {
    if (!selectedCompany) return;
    updateMutation.mutate({
      ...values,
      id: selectedCompany.id,
    });
  };
  
  // Formular zum Pausieren eines Unternehmens abschicken
  const onPauseSubmit = (values: z.infer<typeof pauseCompanySchema>) => {
    if (!selectedCompany) return;
    pauseMutation.mutate({
      pauseReason: values.pauseReason,
      id: selectedCompany.id,
    });
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fehler beim Laden der Unternehmen</CardTitle>
          <CardDescription>
            {error instanceof Error ? error.message : "Unbekannter Fehler"}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Unternehmen</h2>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Neues Unternehmen
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead>Einladungscode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erstellt am</TableHead>
                  <TableHead>Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies && companies.length > 0 ? (
                  companies.map((company: any) => (
                    <TableRow key={company.id} className={company.isPaused ? "bg-muted/50" : ""}>
                      <TableCell>{company.id}</TableCell>
                      <TableCell>{company.name}</TableCell>
                      <TableCell>{company.description || "-"}</TableCell>
                      <TableCell><code>{company.inviteCode}</code></TableCell>
                      <TableCell>
                        {company.isPaused ? (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Pausiert
                          </Badge>
                        ) : (
                          <Badge variant="default" className="flex items-center gap-1">
                            Aktiv
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(company.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleEditCompany(company)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          
                          {company.isPaused ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-500 hover:text-green-600"
                              onClick={() => handleResumeCompany(company)}
                              title="Fortsetzen"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-amber-500 hover:text-amber-600"
                              onClick={() => handlePauseCompany(company)}
                              title="Pausieren"
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center p-4">
                      Keine Unternehmen gefunden
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog zum Erstellen eines Unternehmens */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neues Unternehmen erstellen</DialogTitle>
            <DialogDescription>
              Erstellen Sie ein neues Unternehmen für die Plattform.
            </DialogDescription>
          </DialogHeader>

          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Unternehmensname" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beschreibung</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Beschreibung (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createForm.control}
                name="inviteCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Einladungscode</FormLabel>
                    <FormControl>
                      <Input placeholder="z.B. COMPANY123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Abbrechen
                </Button>
                <Button 
                  type="submit"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Erstellen
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog zum Bearbeiten eines Unternehmens */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unternehmen bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeiten Sie die Informationen des Unternehmens.
            </DialogDescription>
          </DialogHeader>

          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Unternehmensname" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beschreibung</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Beschreibung (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="inviteCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Einladungscode</FormLabel>
                    <FormControl>
                      <Input placeholder="z.B. COMPANY123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Abbrechen
                </Button>
                <Button 
                  type="submit"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Aktualisieren
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Dialog zum Pausieren eines Unternehmens */}
      <Dialog open={isPauseDialogOpen} onOpenChange={setIsPauseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500">
              <Pause className="h-5 w-5" />
              Unternehmen pausieren
            </DialogTitle>
            <DialogDescription>
              {selectedCompany && (
                <>Das Unternehmen "{selectedCompany.name}" wird pausiert. Alle Benutzer werden ausgeloggt und haben keinen Zugriff mehr.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <Form {...pauseForm}>
            <form onSubmit={pauseForm.handleSubmit(onPauseSubmit)} className="space-y-4">
              <FormField
                control={pauseForm.control}
                name="pauseReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Begründung</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Geben Sie eine Begründung für die Pausierung an" 
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPauseDialogOpen(false)}
                >
                  Abbrechen
                </Button>
                <Button 
                  type="submit"
                  variant="destructive"
                  disabled={pauseMutation.isPending}
                >
                  {pauseMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Unternehmen pausieren
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}