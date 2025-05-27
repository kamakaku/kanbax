import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { User, UserCheck, UserX, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { User as UserType } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export function UserManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'activate' | 'deactivate'>('activate');

  // Benutzer aus dem aktuellen Unternehmen abrufen
  const { data: users = [], isLoading: usersLoading } = useQuery<UserType[]>({
    queryKey: ['/api/users'],
    queryFn: () => apiRequest<UserType[]>('GET', '/api/users'),
    enabled: !!user
  });

  // Ausstehende Benutzer (nicht aktivierte) abrufen
  const { data: pendingUsers = [], isLoading: pendingLoading } = useQuery<UserType[]>({
    queryKey: ['/api/companies', user?.companyId, 'users/pending'],
    queryFn: () => apiRequest<UserType[]>('GET', `/api/companies/${user?.companyId}/users/pending`),
    enabled: !!user?.companyId && !!user?.isCompanyAdmin,
  });

  // Mutation für Aktivierung/Deaktivierung von Benutzern
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ userId, activate }: { userId: number, activate: boolean }) => {
      if (!user?.companyId) throw new Error("Keine Unternehmens-ID verfügbar");
      
      const response = await apiRequest(
        'PATCH',
        `/api/companies/${user.companyId}/users/${userId}/activate`,
        { activate }
      );
      
      return response;
    },
    onSuccess: () => {
      // Beide Benutzerlisten aktualisieren
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/companies', user?.companyId, 'users/pending'] 
      });
      
      toast({
        title: confirmAction === 'activate' ? "Benutzer aktiviert" : "Benutzer deaktiviert",
        description: confirmAction === 'activate'
          ? "Der Benutzer hat nun Zugriff auf das System."
          : "Der Benutzer hat keinen Zugriff mehr auf das System.",
      });
      
      setConfirmDialogOpen(false);
    },
    onError: (error) => {
      console.error("Fehler beim Ändern des Benutzerstatus:", error);
      toast({
        title: "Fehler",
        description: "Beim Ändern des Benutzerstatus ist ein Fehler aufgetreten.",
        variant: "destructive",
      });
    }
  });

  const handleActivateUser = (user: UserType) => {
    setSelectedUser(user);
    setConfirmAction('activate');
    setConfirmDialogOpen(true);
  };

  const handleDeactivateUser = (user: UserType) => {
    setSelectedUser(user);
    setConfirmAction('deactivate');
    setConfirmDialogOpen(true);
  };

  const confirmToggleActive = () => {
    if (!selectedUser) return;
    
    toggleActiveMutation.mutate({
      userId: selectedUser.id,
      activate: confirmAction === 'activate'
    });
  };

  if (!user) {
    return null;
  }

  if (!user.isCompanyAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Benutzerverwaltung</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Sie benötigen Administrator-Rechte, um auf die Benutzerverwaltung zuzugreifen.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Benutzerverwaltung</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Abschnitt für ausstehende Benutzeraktivierungen */}
          <h3 className="text-lg font-medium mb-2">Ausstehende Benutzer</h3>
          {pendingLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !pendingUsers || pendingUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine ausstehenden Benutzer.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Benutzername</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Registriert am</TableHead>
                  <TableHead className="w-24">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map((pendingUser: any) => (
                  <TableRow key={pendingUser.id}>
                    <TableCell>{pendingUser.username}</TableCell>
                    <TableCell>{pendingUser.email}</TableCell>
                    <TableCell>
                      {pendingUser.createdAt && format(
                        new Date(pendingUser.createdAt),
                        'dd.MM.yyyy',
                        { locale: de }
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleActivateUser(pendingUser)}
                        disabled={toggleActiveMutation.isPending}
                      >
                        {toggleActiveMutation.isPending && 
                         selectedUser?.id === pendingUser.id ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <UserCheck className="h-4 w-4 mr-1" />
                        )}
                        Aktivieren
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Abschnitt für aktive Benutzer */}
          <h3 className="text-lg font-medium mt-6 mb-2">Aktive Benutzer</h3>
          {usersLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !users || users.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Benutzer gefunden.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Benutzername</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead className="w-24">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users
                  .filter((u: UserType) => u.isActive)
                  .map((activeUser: UserType) => (
                    <TableRow key={activeUser.id}>
                      <TableCell>{activeUser.username}</TableCell>
                      <TableCell>{activeUser.email}</TableCell>
                      <TableCell>
                        <Badge variant={activeUser.isActive ? "default" : "secondary"}>
                          {activeUser.isActive ? "Aktiv" : "Inaktiv"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {activeUser.isCompanyAdmin ? (
                          <Badge variant="default">Admin</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {activeUser.id !== user.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeactivateUser(activeUser)}
                            disabled={toggleActiveMutation.isPending}
                          >
                            {toggleActiveMutation.isPending && 
                             selectedUser?.id === activeUser.id ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <UserX className="h-4 w-4 mr-1" />
                            )}
                            Deaktivieren
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Bestätigungsdialog für Aktivierung/Deaktivierung */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === 'activate' 
                ? "Benutzer aktivieren" 
                : "Benutzer deaktivieren"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {confirmAction === 'activate' ? (
              <p>
                Möchten Sie den Benutzer <strong>{selectedUser?.username}</strong> wirklich aktivieren? 
                Der Benutzer erhält damit Zugriff auf das System.
              </p>
            ) : (
              <p>
                Möchten Sie den Benutzer <strong>{selectedUser?.username}</strong> wirklich deaktivieren? 
                Der Benutzer wird keinen Zugriff mehr auf das System haben.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={confirmToggleActive}
              disabled={toggleActiveMutation.isPending}
              variant={confirmAction === 'activate' ? "default" : "destructive"}
            >
              {toggleActiveMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {confirmAction === 'activate' ? "Aktivieren" : "Deaktivieren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}