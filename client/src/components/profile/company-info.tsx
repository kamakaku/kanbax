import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { Separator } from "@/components/ui/separator";
import { User, Building, Users, Copy, Plus, CheckCircle, Clock, UserCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { Company, User as UserType, CompanyResponse } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Textarea } from "@/components/ui/textarea";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Formular-Schema für die Unternehmenserstellung
const companyFormSchema = z.object({
  name: z.string()
    .min(2, { message: "Name muss mindestens 2 Zeichen lang sein." })
    .max(100, { message: "Name darf maximal 100 Zeichen lang sein." }),
  description: z.string().optional(),
});

type CompanyFormValues = z.infer<typeof companyFormSchema>;

export function CompanyInfoSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [joinCode, setJoinCode] = useState("");

  // Formular zum Erstellen eines Unternehmens
  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Abfrage der Unternehmensdetails über den "current" Endpunkt
  const {
    data: company,
    isLoading,
    error,
    isError,
    failureCount,
    refetch
  } = useQuery<CompanyResponse>({
    queryKey: ['/api/companies/current'],
    queryFn: async () => {
      if (!user?.id || !user?.companyId) {
        return null;
      }
      const response = await apiRequest<CompanyResponse>('GET', `/api/companies/${user.companyId}`);
      return response;
    },
    enabled: !!user?.id && !!user?.companyId,
    retry: false,
    onError: (error) => {
      console.error('Fehler beim Abrufen der Unternehmensdaten:', error);
    }
  }););

  // Abfrage der Unternehmensmitglieder mit korrekter company ID
  const {
    data: companyMembers,
    isLoading: isMembersLoading,
  } = useQuery<any[]>({
    queryKey: ['/api/companies', company?.id, 'members'],
    enabled: !!company?.id,
    queryFn: () => apiRequest<any[]>('GET', `/api/companies/${company?.id}/members`),
  });

  // Abfrage der ausstehenden Benutzer für Administratoren
  const {
    data: pendingUsers,
    isLoading: isPendingUsersLoading,
  } = useQuery<any[]>({
    queryKey: ['/api/companies', company?.id, 'users/pending'],
    enabled: !!company?.id && !!user?.isCompanyAdmin,
    queryFn: () => apiRequest<any[]>('GET', `/api/companies/${company?.id}/users/pending`),
  });

  // Mutation zum Generieren eines Einladungscodes
  const generateInviteMutation = useMutation({
    mutationFn: async () => {
      if (!company?.id) throw new Error("Keine Unternehmens-ID vorhanden");
      return apiRequest<{inviteCode: string}>("POST", `/api/companies/${company.id}/invite`);
    },
    onSuccess: (data) => {
      setInviteCode(data.inviteCode);
      toast({
        title: "Erfolg!",
        description: "Einladungscode wurde generiert.",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: "Einladungscode konnte nicht generiert werden.",
        variant: "destructive",
      });
    },
  });

  // Mutation zum Aktivieren ausstehender Benutzer
  const activateUserMutation = useMutation({
    mutationFn: (userId: number) => {
      if (!company?.id) throw new Error("Keine Unternehmens-ID vorhanden");
      return apiRequest("PATCH", `/api/companies/${company.id}/users/${userId}/activate`);
    },
    onSuccess: () => {
      toast({
        title: "Erfolg!",
        description: "Benutzer wurde aktiviert.",
      });
      // Aktualisiere Listen für ausstehende Benutzer und Mitglieder
      queryClient.invalidateQueries({ queryKey: ['/api/companies', company?.id, 'users/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/companies', company?.id, 'members'] });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: "Benutzer konnte nicht aktiviert werden.",
        variant: "destructive",
      });
    },
  });

  // Mutation zum Beitreten zu einem Unternehmen
  const joinCompanyMutation = useMutation({
    mutationFn: (inviteCode: string) => 
      apiRequest("POST", "/api/companies/join", { inviteCode }),
    onSuccess: () => {
      setJoinDialogOpen(false);
      setJoinCode("");
      toast({
        title: "Erfolg!",
        description: "Sie sind dem Unternehmen beigetreten.",
      });
      // Aktualisiere die Daten
      queryClient.invalidateQueries({ queryKey: ['/api/companies/current'] });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: "Ungültiger Einladungscode oder Fehler beim Beitreten.",
        variant: "destructive",
      });
    },
  });

  // Mutation zum Erstellen eines Unternehmens
  const createCompanyMutation = useMutation({
    mutationFn: (data: CompanyFormValues) => 
      apiRequest("POST", "/api/companies", data),
    onSuccess: () => {
      setCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Erfolg!",
        description: "Unternehmen wurde erfolgreich erstellt.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/companies/current'] });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Fehler beim Erstellen des Unternehmens.";
      if (errorMessage.includes("Die Erstellung eines Unternehmens erfordert mindestens ein Basic-Abonnement") ||
          errorMessage.includes("Sie sind bereits Mitglied eines Unternehmens")) {
        toast({
          title: "Nicht möglich",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Fehler",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
  });

  async function onSubmit(data: CompanyFormValues) {
    try {
      await createCompanyMutation.mutateAsync(data);
    } catch (error) {
      console.error("Fehler beim Erstellen des Unternehmens:", error);
    }
  }

  // Mutation zum Ändern der Admin-Rolle eines Benutzers
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, isAdmin }: { userId: number, isAdmin: boolean }) => 
      apiRequest("PATCH", `/api/companies/members/${userId}/role`, { isAdmin }),
    onSuccess: () => {
      toast({
        title: "Erfolg!",
        description: "Benutzerrolle wurde aktualisiert.",
      });
      // Aktualisiere die Mitgliederliste
      queryClient.invalidateQueries({ queryKey: ['/api/companies', company?.id, 'members'] });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: "Benutzerrolle konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    },
  });

  // Funktion zum Kopieren des Einladungscodes in die Zwischenablage
  const copyInviteCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      toast({
        title: "Kopiert!",
        description: "Einladungscode wurde in die Zwischenablage kopiert.",
      });
    }
  };

  // Wenn der Benutzer keinem Unternehmen angehört
  if (user && !isLoading && !company) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unternehmensinformationen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Building className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Kein Unternehmen zugewiesen</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              Sie sind derzeit keinem Unternehmen zugewiesen. Treten Sie mit einem Einladungscode einem Unternehmen bei oder erstellen Sie ein eigenes Unternehmen.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => setJoinDialogOpen(true)}
          >
            Unternehmen beitreten
          </Button>
          <Button 
            variant="default" 
            onClick={() => setCreateDialogOpen(true)}
          >
            Unternehmen erstellen
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Während des Ladens
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unternehmensinformationen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Wenn ein Fehler aufgetreten ist
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unternehmensinformationen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-sm text-red-500">
              Fehler beim Laden der Unternehmensinformationen.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Unternehmensinformationen</CardTitle>
          {user?.isCompanyAdmin && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setInviteDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Mitglied einladen
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Unternehmensdaten */}
            <div>
              <div className="flex items-center">
                <Building className="h-5 w-5 mr-2 text-primary" />
                <h3 className="text-lg font-medium">{company?.name}</h3>
              </div>
              {company?.description && (
                <p className="text-sm text-muted-foreground mt-2">
                  {company.description}
                </p>
              )}
              <div className="mt-2">
                {user?.isCompanyAdmin && (
                  <Badge variant="outline" className="mr-2 bg-primary/10">
                    Administrator
                  </Badge>
                )}
                <Badge variant="outline">
                  Mitglied
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Ausstehende Benutzerbestätigungen (nur für Admins) */}
            {user?.isCompanyAdmin && (
              <>
                <div>
                  <div className="flex items-center mb-4">
                    <Clock className="h-5 w-5 mr-2 text-primary" />
                    <h3 className="font-medium">Ausstehende Aktivierungen</h3>
                  </div>

                  {isPendingUsersLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : pendingUsers && Array.isArray(pendingUsers) && pendingUsers.length > 0 ? (
                    <Card>
                      <CardContent className="px-4 py-2">
                        <ul className="space-y-2 py-2">
                          {pendingUsers.map((pendingUser: any) => (
                            <li key={pendingUser.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-md border border-amber-200/30">
                              <div className="flex items-center">
                                <div className="relative">
                                  {pendingUser.avatarUrl ? (
                                    <img 
                                      src={pendingUser.avatarUrl} 
                                      alt={pendingUser.username} 
                                      className="h-8 w-8 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                                      <User className="h-4 w-4 text-amber-600" />
                                    </div>
                                  )}
                                </div>
                                <div className="ml-3">
                                  <p className="text-sm font-medium">{pendingUser.username}</p>
                                  <p className="text-xs text-muted-foreground">{pendingUser.email}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Registriert: {format(new Date(pendingUser.createdAt), 'dd.MM.yyyy', { locale: de })}
                                  </p>
                                </div>
                              </div>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                                onClick={() => activateUserMutation.mutate(pendingUser.id)}
                                disabled={activateUserMutation.isPending}
                              >
                                <UserCheck className="h-4 w-4 mr-2" />
                                Aktivieren
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="text-center p-4 bg-muted/30 rounded-md">
                      <p className="text-sm text-muted-foreground">
                        Keine ausstehenden Benutzeraktivierungen.
                      </p>
                    </div>
                  )}
                </div>

                <Separator />
              </>
            )}

            {/* Mitgliederliste */}
            <div>
              <div className="flex items-center mb-4">
                <Users className="h-5 w-5 mr-2 text-primary" />
                <h3 className="font-medium">Unternehmensmitglieder</h3>
              </div>

              {isMembersLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <ul className="space-y-2">
                  {companyMembers && Array.isArray(companyMembers) && companyMembers.map((member: any) => (
                    <li key={member.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                      <div className="flex items-center">
                        <div className="relative">
                          {member.avatarUrl ? (
                            <img 
                              src={member.avatarUrl} 
                              alt={member.username} 
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                          )}
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium">{member.username}</p>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        {user?.isCompanyAdmin && user.id !== member.id && (
                          <div className="mr-3 flex items-center">
                            <Switch 
                              id={`admin-${member.id}`}
                              checked={!!member.isCompanyAdmin}
                              onCheckedChange={(isChecked) => {
                                updateRoleMutation.mutate({ 
                                  userId: member.id, 
                                  isAdmin: isChecked 
                                });
                              }}
                            />
                            <Label htmlFor={`admin-${member.id}`} className="ml-2 text-xs">
                              Admin
                            </Label>
                          </div>
                        )}
                        {member.isCompanyAdmin && (
                          <Badge variant="outline" className="bg-primary/10">
                            Admin
                          </Badge>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog zum Erstellen eines Einladungscodes */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neues Mitglied einladen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Generieren Sie einen Einladungscode und teilen Sie ihn mit dem neuen Mitglied.
            </p>
            {inviteCode ? (
              <div className="flex items-center space-x-2">
                <Input 
                  value={inviteCode} 
                  readOnly 
                  className="font-mono"
                />
                <Button size="icon" variant="outline" onClick={copyInviteCode}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button 
                onClick={() => generateInviteMutation.mutate()}
                disabled={generateInviteMutation.isPending}
              >
                Einladungscode generieren
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setInviteDialogOpen(false);
              setInviteCode("");
            }}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog zum Beitreten zu einem Unternehmen */}
      <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unternehmen beitreten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Geben Sie den Einladungscode ein, um einem Unternehmen beizutreten.
            </p>
            <div className="space-y-2">
              <Label htmlFor="inviteCode">Einladungscode</Label>
              <Input 
                id="inviteCode"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="ABCD1234"
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJoinDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button 
              onClick={() => joinCompanyMutation.mutate(joinCode)}
              disabled={!joinCode || joinCompanyMutation.isPending}
            >
              Beitreten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog zum Erstellen eines Unternehmens */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unternehmen erstellen</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createCompanyMutation.mutate(data))}>
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Erstellen Sie ein neues Unternehmen. Bitte beachten Sie, dass für diese Funktion ein Premium-Abonnement erforderlich ist.
                </p>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unternehmensname</FormLabel>
                      <FormControl>
                        <Input placeholder="Mein Unternehmen GmbH" {...field} />
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
                          placeholder="Kurze Beschreibung des Unternehmens" 
                          {...field} 
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Abbrechen
                </Button>
                <Button 
                  type="submit"
                  disabled={createCompanyMutation.isPending}
                >
                  {createCompanyMutation.isPending ? "Wird erstellt..." : "Erstellen"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}