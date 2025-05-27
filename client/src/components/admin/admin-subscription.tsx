import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, CreditCard, Package, History, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

// Typ-Definitionen
interface SubscriptionPackage {
  id: number;
  name: string;
  displayName: string;
  description: string;
  price: number;
  maxProjects: number;
  maxBoards: number;
  maxTeams: number;
  maxUsersPerCompany: number;
  maxTasks: number;
  maxOkrs: number;
  hasGanttView: boolean;
  hasAdvancedReporting: boolean;
  hasApiAccess: boolean;
  hasCustomBranding: boolean;
  hasPrioritySupport: boolean;
  isActive: boolean;
}

interface CompanySubscription {
  id: number;
  companyId: number;
  subscriptionTier: string;
  subscriptionStatus: string;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  company?: {
    id: number;
    name: string;
  };
  companyName?: string;
}

interface AuditLog {
  id: number;
  companyId: number;
  userId: number | null;
  action: string;
  oldTier: string | null;
  newTier: string | null;
  details: string | null;
  createdAt: string;
}

const AdminSubscriptionPackages: React.FC = () => {
  const [activeTab, setActiveTab] = useState("packages");
  const [selectedCompany, setSelectedCompany] = useState<CompanySubscription | null>(null);
  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string>("");
  const [auditCompanyId, setAuditCompanyId] = useState<number | null>(null);
  const [editPackageDialogOpen, setEditPackageDialogOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<SubscriptionPackage | null>(null);
  
  const queryClient = useQueryClient();

  // Abonnement-Pakete abrufen
  const packagesQuery = useQuery({
    queryKey: ['/api/admin/subscription-packages'],
    enabled: activeTab === "packages",
  });

  // Alle Abonnements abrufen
  const subscriptionsQuery = useQuery({
    queryKey: ['/api/admin/subscriptions'],
    enabled: activeTab === "subscriptions",
  });

  // Audit-Logs für ein Unternehmen abrufen
  const auditLogsQuery = useQuery({
    queryKey: ['/api/admin/subscription-audit', auditCompanyId],
    queryFn: () => {
      if (!auditCompanyId) return Promise.resolve([]);
      return apiRequest(`/api/admin/subscription-audit/${auditCompanyId}`, 'GET');
    },
    enabled: auditCompanyId !== null,
  });

  // Mutation zum Aktualisieren des Abonnement-Pakets
  const updatePackageMutation = useMutation({
    mutationFn: async (packageData: Partial<SubscriptionPackage>) => {
      return apiRequest(`/api/admin/subscription-packages/${packageData.id}`, 'PATCH', packageData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subscription-packages'] });
      toast({
        title: "Paket aktualisiert",
        description: "Das Abonnement-Paket wurde erfolgreich aktualisiert.",
      });
      setEditPackageDialogOpen(false);
    },
    onError: (error) => {
      console.error("Fehler beim Aktualisieren des Pakets:", error);
      toast({
        title: "Fehler",
        description: "Das Paket konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  });

  // Mutation zum Aktualisieren des Abonnements eines Unternehmens
  const updateCompanySubscriptionMutation = useMutation({
    mutationFn: async ({ companyId, tier }: { companyId: number, tier: string }) => {
      return apiRequest(`/api/admin/company-subscription/${companyId}`, 'PATCH', {
        tier,
      });
    },
    onSuccess: () => {
      // Daten neu laden
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subscriptions'] });
      if (auditCompanyId) {
        queryClient.invalidateQueries({ queryKey: ['/api/admin/subscription-audit', auditCompanyId] });
      }
      toast({
        title: "Abonnement aktualisiert",
        description: "Das Abonnement wurde erfolgreich aktualisiert.",
      });
      setTierDialogOpen(false);
    },
    onError: (error) => {
      console.error("Fehler beim Aktualisieren des Abonnements:", error);
      toast({
        title: "Fehler",
        description: "Das Abonnement konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  });

  // Abonnement-Pakete anzeigen
  const renderPackages = () => {
    if (packagesQuery.isLoading) {
      return (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="mr-2 h-8 w-8 animate-spin" />
        </div>
      );
    }

    if (packagesQuery.isError) {
      return (
        <div className="text-center p-4 text-red-500">
          <XCircle className="mx-auto h-8 w-8 mb-2" />
          Fehler beim Laden der Abonnement-Pakete
        </div>
      );
    }

    const packages = packagesQuery.data as SubscriptionPackage[];

    return (
      <>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Anzeigename</TableHead>
              <TableHead>Beschreibung</TableHead>
              <TableHead>Preis</TableHead>
              <TableHead>Max. Projekte</TableHead>
              <TableHead>Max. Boards</TableHead>
              <TableHead>Max. Teams</TableHead>
              <TableHead>Max. Benutzer</TableHead>
              <TableHead>Max. Tasks</TableHead>
              <TableHead>Max. OKRs</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages.map((pkg) => (
              <TableRow key={pkg.id}>
                <TableCell className="font-medium">{pkg.name}</TableCell>
                <TableCell>{pkg.displayName}</TableCell>
                <TableCell>{pkg.description}</TableCell>
                <TableCell>{(pkg.price / 100).toFixed(2)} €</TableCell>
                <TableCell>{pkg.maxProjects === 9999 ? "∞" : pkg.maxProjects}</TableCell>
                <TableCell>{pkg.maxBoards === 9999 ? "∞" : pkg.maxBoards}</TableCell>
                <TableCell>{pkg.maxTeams === 9999 ? "∞" : pkg.maxTeams}</TableCell>
                <TableCell>{pkg.maxUsersPerCompany === 9999 ? "∞" : pkg.maxUsersPerCompany}</TableCell>
                <TableCell>{pkg.maxTasks === 9999 ? "∞" : pkg.maxTasks}</TableCell>
                <TableCell>{pkg.maxOkrs === 9999 ? "∞" : (pkg.maxOkrs === 0 ? "-" : pkg.maxOkrs)}</TableCell>
                <TableCell>
                  {pkg.isActive ? (
                    <Badge className="bg-green-500">Aktiv</Badge>
                  ) : (
                    <Badge variant="destructive">Inaktiv</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedPackage(pkg);
                      setEditPackageDialogOpen(true);
                    }}
                  >
                    Bearbeiten
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Dialog zum Bearbeiten des Pakets */}
        <Dialog open={editPackageDialogOpen} onOpenChange={setEditPackageDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Paket bearbeiten</DialogTitle>
              <DialogDescription>
                Bearbeiten Sie die Eigenschaften des Pakets {selectedPackage?.displayName}.
              </DialogDescription>
            </DialogHeader>
            {selectedPackage && (
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Anzeigename</label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded-md"
                    value={selectedPackage.displayName}
                    onChange={(e) => setSelectedPackage({
                      ...selectedPackage,
                      displayName: e.target.value
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Beschreibung</label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded-md"
                    value={selectedPackage.description}
                    onChange={(e) => setSelectedPackage({
                      ...selectedPackage,
                      description: e.target.value
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Preis (in Cent)</label>
                  <input
                    type="number"
                    className="w-full p-2 border rounded-md"
                    value={selectedPackage.price}
                    onChange={(e) => setSelectedPackage({
                      ...selectedPackage,
                      price: parseInt(e.target.value)
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max. Projekte</label>
                  <input
                    type="number"
                    className="w-full p-2 border rounded-md"
                    value={selectedPackage.maxProjects}
                    onChange={(e) => setSelectedPackage({
                      ...selectedPackage,
                      maxProjects: parseInt(e.target.value)
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max. Boards</label>
                  <input
                    type="number"
                    className="w-full p-2 border rounded-md"
                    value={selectedPackage.maxBoards}
                    onChange={(e) => setSelectedPackage({
                      ...selectedPackage,
                      maxBoards: parseInt(e.target.value)
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max. Teams</label>
                  <input
                    type="number"
                    className="w-full p-2 border rounded-md"
                    value={selectedPackage.maxTeams}
                    onChange={(e) => setSelectedPackage({
                      ...selectedPackage,
                      maxTeams: parseInt(e.target.value)
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max. Benutzer pro Firma</label>
                  <input
                    type="number"
                    className="w-full p-2 border rounded-md"
                    value={selectedPackage.maxUsersPerCompany}
                    onChange={(e) => setSelectedPackage({
                      ...selectedPackage,
                      maxUsersPerCompany: parseInt(e.target.value)
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max. Tasks</label>
                  <input
                    type="number"
                    className="w-full p-2 border rounded-md"
                    value={selectedPackage.maxTasks}
                    onChange={(e) => setSelectedPackage({
                      ...selectedPackage,
                      maxTasks: parseInt(e.target.value)
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max. OKRs</label>
                  <input
                    type="number"
                    className="w-full p-2 border rounded-md"
                    value={selectedPackage.maxOkrs}
                    onChange={(e) => setSelectedPackage({
                      ...selectedPackage,
                      maxOkrs: parseInt(e.target.value)
                    })}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium">Features</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="ganttView"
                        checked={selectedPackage.hasGanttView}
                        onChange={(e) => setSelectedPackage({
                          ...selectedPackage,
                          hasGanttView: e.target.checked
                        })}
                      />
                      <label htmlFor="ganttView">Gantt-Ansicht</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="advancedReporting"
                        checked={selectedPackage.hasAdvancedReporting}
                        onChange={(e) => setSelectedPackage({
                          ...selectedPackage,
                          hasAdvancedReporting: e.target.checked
                        })}
                      />
                      <label htmlFor="advancedReporting">Erweiterte Berichte</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="apiAccess"
                        checked={selectedPackage.hasApiAccess}
                        onChange={(e) => setSelectedPackage({
                          ...selectedPackage,
                          hasApiAccess: e.target.checked
                        })}
                      />
                      <label htmlFor="apiAccess">API-Zugriff</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="customBranding"
                        checked={selectedPackage.hasCustomBranding}
                        onChange={(e) => setSelectedPackage({
                          ...selectedPackage,
                          hasCustomBranding: e.target.checked
                        })}
                      />
                      <label htmlFor="customBranding">Custom Branding</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="prioritySupport"
                        checked={selectedPackage.hasPrioritySupport}
                        onChange={(e) => setSelectedPackage({
                          ...selectedPackage,
                          hasPrioritySupport: e.target.checked
                        })}
                      />
                      <label htmlFor="prioritySupport">Premium Support</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isActive"
                        checked={selectedPackage.isActive}
                        onChange={(e) => setSelectedPackage({
                          ...selectedPackage,
                          isActive: e.target.checked
                        })}
                      />
                      <label htmlFor="isActive">Aktiv</label>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditPackageDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button
                onClick={() => {
                  if (selectedPackage) {
                    const { id, displayName, description, price, maxProjects, maxBoards, maxTeams, 
                      maxUsersPerCompany, maxTasks, maxOkrs, hasGanttView, hasAdvancedReporting, hasApiAccess,
                      hasCustomBranding, hasPrioritySupport, isActive } = selectedPackage;
                    
                    updatePackageMutation.mutate({
                      id,
                      displayName, 
                      description,
                      price,
                      maxProjects,
                      maxBoards,
                      maxTeams,
                      maxUsersPerCompany,
                      maxTasks,
                      maxOkrs,
                      hasGanttView,
                      hasAdvancedReporting,
                      hasApiAccess,
                      hasCustomBranding,
                      hasPrioritySupport,
                      isActive
                    });
                  }
                }}
                disabled={updatePackageMutation.isPending}
              >
                {updatePackageMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Speichern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  };

  // Abonnements anzeigen
  const renderSubscriptions = () => {
    if (subscriptionsQuery.isLoading) {
      return (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="mr-2 h-8 w-8 animate-spin" />
        </div>
      );
    }

    if (subscriptionsQuery.isError) {
      return (
        <div className="text-center p-4 text-red-500">
          <XCircle className="mx-auto h-8 w-8 mb-2" />
          Fehler beim Laden der Abonnements
        </div>
      );
    }

    const subscriptions = subscriptionsQuery.data as CompanySubscription[];

    if (!subscriptions || subscriptions.length === 0) {
      return (
        <div className="text-center p-4 text-gray-500">
          <AlertTriangle className="mx-auto h-8 w-8 mb-2" />
          Keine Abonnements gefunden
        </div>
      );
    }

    const packages = packagesQuery.data as SubscriptionPackage[] || [];
    const tiers = packages.map(pkg => ({ value: pkg.name, label: pkg.displayName }));

    return (
      <>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Firma</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>Ende</TableHead>
              <TableHead>Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscriptions.map((subscription) => (
              <TableRow key={subscription.id}>
                <TableCell className="font-medium">{subscription.companyName || subscription.company?.name || 'Unbekannte Firma'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {subscription.subscriptionTier}
                  </Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge status={subscription.subscriptionStatus} />
                </TableCell>
                <TableCell>{formatDate(subscription.subscriptionStartDate)}</TableCell>
                <TableCell>{formatDate(subscription.subscriptionEndDate)}</TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCompany(subscription);
                        setSelectedTier(subscription.subscriptionTier);
                        setTierDialogOpen(true);
                      }}
                    >
                      Ändern
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAuditCompanyId(subscription.companyId);
                        setActiveTab("audit");
                      }}
                    >
                      Audit
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Dialog zum Ändern des Abonnements */}
        <Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Abonnement ändern</DialogTitle>
              <DialogDescription>
                Wählen Sie das neue Abonnement für{" "}
                <strong>{selectedCompany?.companyName || selectedCompany?.company?.name || `Firma #${selectedCompany?.companyId}`}</strong> aus.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Select value={selectedTier} onValueChange={setSelectedTier}>
                <SelectTrigger>
                  <SelectValue placeholder="Tier auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {tiers.map((tier) => (
                    <SelectItem key={tier.value} value={tier.value}>
                      {tier.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTierDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button
                onClick={() => {
                  if (selectedCompany && selectedTier) {
                    updateCompanySubscriptionMutation.mutate({
                      companyId: selectedCompany.companyId,
                      tier: selectedTier,
                    });
                  }
                }}
                disabled={updateCompanySubscriptionMutation.isPending}
              >
                {updateCompanySubscriptionMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Speichern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  };

  // Audit-Logs anzeigen
  const renderAuditLogs = () => {
    if (!auditCompanyId) {
      return (
        <div className="text-center p-4 text-gray-500">
          <AlertTriangle className="mx-auto h-8 w-8 mb-2" />
          Bitte wählen Sie ein Unternehmen aus, um die Audit-Logs anzuzeigen
        </div>
      );
    }

    if (auditLogsQuery.isLoading) {
      return (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="mr-2 h-8 w-8 animate-spin" />
        </div>
      );
    }

    if (auditLogsQuery.isError) {
      return (
        <div className="text-center p-4 text-red-500">
          <XCircle className="mx-auto h-8 w-8 mb-2" />
          Fehler beim Laden der Audit-Logs
        </div>
      );
    }

    const auditLogs = auditLogsQuery.data as AuditLog[];
    
    // Stelle sicher, dass subscriptionsQuery.data ein Array ist
    const subscriptions = subscriptionsQuery.data as CompanySubscription[] || [];
    const companyName = subscriptions.find(
      (s: CompanySubscription) => s.companyId === auditCompanyId
    )?.company?.name || 'Unbekannte Firma';

    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            Audit-Logs für {companyName}
          </h3>
          <Button variant="outline" onClick={() => setActiveTab("subscriptions")}>
            Zurück zu Abonnements
          </Button>
        </div>

        {auditLogs.length === 0 ? (
          <div className="text-center p-4 text-gray-500">
            <AlertTriangle className="mx-auto h-8 w-8 mb-2" />
            Keine Audit-Logs gefunden
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Aktion</TableHead>
                <TableHead>Von</TableHead>
                <TableHead>Zu</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{formatDateTime(log.createdAt)}</TableCell>
                  <TableCell>
                    <ActionBadge action={log.action} />
                  </TableCell>
                  <TableCell>{log.oldTier || '-'}</TableCell>
                  <TableCell>{log.newTier || '-'}</TableCell>
                  <TableCell>{log.details || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Abonnementverwaltung</CardTitle>
        <CardDescription>
          Verwalten Sie Abonnementpakete und Firmenabonnements.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="packages">
              <Package className="mr-2 h-4 w-4" />
              Pakete
            </TabsTrigger>
            <TabsTrigger value="subscriptions">
              <CreditCard className="mr-2 h-4 w-4" />
              Abonnements
            </TabsTrigger>
            <TabsTrigger value="audit" disabled={!auditCompanyId}>
              <History className="mr-2 h-4 w-4" />
              Audit-Logs
            </TabsTrigger>
          </TabsList>
          <TabsContent value="packages">
            {renderPackages()}
          </TabsContent>
          <TabsContent value="subscriptions">
            {renderSubscriptions()}
          </TabsContent>
          <TabsContent value="audit">
            {renderAuditLogs()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

// Hilfsfunktionen und -komponenten
const formatDate = (dateString: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('de-DE');
};

const formatDateTime = (dateString: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('de-DE');
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  switch (status.toLowerCase()) {
    case 'active':
      return <Badge className="bg-green-500">Aktiv</Badge>;
    case 'inactive':
      return <Badge variant="secondary">Inaktiv</Badge>;
    case 'past_due':
      return <Badge variant="destructive">Fällig</Badge>;
    case 'canceled':
      return <Badge variant="outline">Gekündigt</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const ActionBadge: React.FC<{ action: string }> = ({ action }) => {
  switch (action.toLowerCase()) {
    case 'create':
      return <Badge className="bg-blue-500">Erstellt</Badge>;
    case 'upgrade':
      return <Badge className="bg-green-500">Upgrade</Badge>;
    case 'downgrade':
      return <Badge className="bg-yellow-500">Downgrade</Badge>;
    case 'change_tier':
      return <Badge className="bg-purple-500">Änderung</Badge>;
    case 'admin_change':
      return <Badge className="bg-red-500">Admin-Änderung</Badge>;
    default:
      return <Badge variant="outline">{action}</Badge>;
  }
};

export default AdminSubscriptionPackages;