import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  Edit,
  Eye,
  Loader2,
  Mail,
  Pause,
  Play,
  Shield,
  ShieldOff,
  CreditCard,
} from "lucide-react";

// Schema für Pausierung eines Benutzers
const pauseUserSchema = z.object({
  pauseReason: z.string().min(5, {
    message: "Die Begründung muss mindestens 5 Zeichen lang sein.",
  }),
});

// Schema für Abonnement eines Benutzers
const subscriptionSchema = z.object({
  tier: z.string().min(1, {
    message: "Bitte wählen Sie ein Abonnement aus.",
  }),
});

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPauseDialogOpen, setIsPauseDialogOpen] = useState(false);
  const [isSubscriptionDialogOpen, setIsSubscriptionDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Formulare
  const pauseForm = useForm<z.infer<typeof pauseUserSchema>>({
    resolver: zodResolver(pauseUserSchema),
    defaultValues: {
      pauseReason: "",
    }
  });
  
  const subscriptionForm = useForm<z.infer<typeof subscriptionSchema>>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      tier: "",
    }
  });

  // Benutzer abrufen
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['/api/admin/users'],
    retry: false,
  });
  
  // Abonnement-Pakete abrufen
  const { data: subscriptionPackages = [] } = useQuery({
    queryKey: ['/api/admin/subscription-packages'],
    retry: false,
  });

  // Benutzer pausieren
  const pauseMutation = useMutation({
    mutationFn: (data: { id: number, pauseReason: string }) => {
      return apiRequest(`/api/admin/users/${data.id}/pause`, 'POST', {
        pauseReason: data.pauseReason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "Benutzer pausiert",
        description: "Der Benutzer wurde erfolgreich pausiert.",
      });
      setIsPauseDialogOpen(false);
      setSelectedUser(null);
      pauseForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Beim Pausieren des Benutzers ist ein Fehler aufgetreten.",
        variant: "destructive",
      });
    },
  });
  
  // Benutzer fortsetzen
  const resumeMutation = useMutation({
    mutationFn: (id: number) => {
      return apiRequest(`/api/admin/users/${id}/resume`, 'POST', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "Benutzer fortgesetzt",
        description: "Der Benutzer wurde erfolgreich fortgesetzt.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Beim Fortsetzen des Benutzers ist ein Fehler aufgetreten.",
        variant: "destructive",
      });
    },
  });
  
  // Abonnement eines Benutzers ändern
  const updateSubscriptionMutation = useMutation({
    mutationFn: (data: { userId: number, tier: string }) => {
      return apiRequest(`/api/admin/users/${data.userId}/subscription`, 'PATCH', {
        tier: data.tier,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subscriptions'] });
      toast({
        title: "Abonnement aktualisiert",
        description: "Das Abonnement des Benutzers wurde erfolgreich aktualisiert.",
      });
      setIsSubscriptionDialogOpen(false);
      setSelectedUser(null);
      subscriptionForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Beim Aktualisieren des Abonnements ist ein Fehler aufgetreten.",
        variant: "destructive",
      });
    },
  });
  
  // Benutzer zum Pausieren auswählen
  const handlePauseUser = (user: any) => {
    setSelectedUser(user);
    pauseForm.reset({ pauseReason: "" });
    setIsPauseDialogOpen(true);
  };
  
  // Benutzer fortsetzen
  const handleResumeUser = (user: any) => {
    if (confirm(`Möchten Sie den Benutzer "${user.username}" wirklich fortsetzen?`)) {
      resumeMutation.mutate(user.id);
    }
  };
  
  // Formular zum Pausieren eines Benutzers abschicken
  const onPauseSubmit = (values: z.infer<typeof pauseUserSchema>) => {
    if (!selectedUser) return;
    pauseMutation.mutate({
      pauseReason: values.pauseReason,
      id: selectedUser.id,
    });
  };
  
  // Formular zum Ändern des Abonnements abschicken
  const onSubscriptionSubmit = (values: z.infer<typeof subscriptionSchema>) => {
    if (!selectedUser) return;
    updateSubscriptionMutation.mutate({
      userId: selectedUser.id,
      tier: values.tier,
    });
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fehler beim Laden der Benutzer</CardTitle>
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
        <h2 className="text-xl font-bold">Benutzer</h2>
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
                  <TableHead>Benutzername</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Rollen</TableHead>
                  <TableHead>Unternehmen</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erstellt am</TableHead>
                  <TableHead>Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users && users.length > 0 ? (
                  users.map((user: any) => (
                    <TableRow key={user.id} className={user.isPaused ? "bg-muted/50" : ""}>
                      <TableCell>{user.id}</TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.isHyperAdmin && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <Shield className="h-3 w-3" />
                              Hyper-Admin
                            </Badge>
                          )}
                          {user.isCompanyAdmin && (
                            <Badge variant="default" className="flex items-center gap-1">
                              <Shield className="h-3 w-3" />
                              Admin
                            </Badge>
                          )}
                          {!user.isActive && (
                            <Badge variant="outline" className="border-amber-500 text-amber-500 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Inaktiv
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.company?.name || "-"}
                      </TableCell>
                      <TableCell>
                        {user.isPaused ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="destructive" className="flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Pausiert
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">{user.pauseReason || "Kein Grund angegeben"}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Pausiert am: {user.pausedAt ? formatDate(user.pausedAt) : "Unbekannt"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <Badge variant="default" className="flex items-center gap-1">
                            Aktiv
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <div className="flex space-x-1">
                            {/* Abonnement-Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-primary hover:text-primary/80"
                              onClick={() => {
                                setSelectedUser(user);
                                // Aktuelles Abonnement als Default setzen
                                subscriptionForm.reset({ 
                                  tier: user.subscriptionTier || "" 
                                });
                                setIsSubscriptionDialogOpen(true);
                              }}
                              title="Abonnement verwalten"
                            >
                              <CreditCard className="h-4 w-4" />
                            </Button>

                            {/* Pausieren/Fortsetzen-Button */}
                            {user.isPaused ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-green-500 hover:text-green-600"
                                onClick={() => handleResumeUser(user)}
                                title="Fortsetzen"
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-amber-500 hover:text-amber-600"
                                onClick={() => handlePauseUser(user)}
                                title="Pausieren"
                                // Hyper-Admins können nicht pausiert werden
                                disabled={user.isHyperAdmin}
                              >
                                <Pause className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center p-4">
                      Keine Benutzer gefunden
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* Dialog zum Pausieren eines Benutzers */}
      <Dialog open={isPauseDialogOpen} onOpenChange={setIsPauseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500">
              <Pause className="h-5 w-5" />
              Benutzer pausieren
            </DialogTitle>
            <DialogDescription>
              {selectedUser && (
                <>Der Benutzer "{selectedUser.username}" wird pausiert. Er wird ausgeloggt und hat keinen Zugriff mehr.</>
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
                  disabled={pauseMutation.isPending}
                  variant="destructive"
                >
                  {pauseMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Pausieren
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Dialog zum Ändern des Benutzer-Abonnements */}
      <Dialog open={isSubscriptionDialogOpen} onOpenChange={setIsSubscriptionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <CreditCard className="h-5 w-5" />
              Abonnement verwalten
            </DialogTitle>
            <DialogDescription>
              {selectedUser && (
                <>Verwalten Sie das Abonnement für den Benutzer "{selectedUser.username}".</>
              )}
            </DialogDescription>
          </DialogHeader>

          <Form {...subscriptionForm}>
            <form onSubmit={subscriptionForm.handleSubmit(onSubscriptionSubmit)} className="space-y-4">
              <FormField
                control={subscriptionForm.control}
                name="tier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Abonnement</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Wählen Sie ein Abonnement" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {subscriptionPackages.map((pkg: any) => (
                          <SelectItem key={pkg.id} value={pkg.name} className="flex items-center">
                            {pkg.name} {!selectedUser?.companyId && pkg.requiresCompany && 
                              " - Benötigt Unternehmen"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsSubscriptionDialogOpen(false)}
                >
                  Abbrechen
                </Button>
                <Button 
                  type="submit"
                  disabled={updateSubscriptionMutation.isPending || 
                    // Prüfen, ob das ausgewählte Abonnement ein Unternehmen erfordert, 
                    // der Benutzer aber keins hat
                    (subscriptionForm.watch("tier") && 
                     selectedUser && 
                     !selectedUser.companyId && 
                     subscriptionPackages.find((pkg: any) => 
                       pkg.name === subscriptionForm.watch("tier") && pkg.requiresCompany)
                    )}
                >
                  {updateSubscriptionMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Speichern
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}