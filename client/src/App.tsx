import { Switch, Route, useLocation } from "wouter";
import * as React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth, AuthProvider } from "@/lib/auth-store";
import { BoardProvider } from "@/context/board-context";
import { StripeProvider } from "@/lib/stripe-provider";
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarContent, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  SidebarTrigger 
} from "@/components/ui/sidebar";
import { LayoutDashboard, Folder, KanbanSquare, UserCircle, Target, LineChart, Users, CheckSquare, Shield, CreditCard, HelpCircle, Download, Key } from "lucide-react";
import { PauseNotice } from "@/components/pause-notice";
import Dashboard from "@/pages/dashboard";
import AllProjects from "@/pages/all-projects";
import Auth from "@/pages/auth";
import NotFound from "@/pages/not-found";
import ProjectDetail from "@/pages/project-detail";
import AllBoards from "@/pages/all-boards";
import Profile from "@/pages/profile";
import AllOKRs from "@/pages/all-okrs";
import OKRDetailPage from "@/pages/okr-detail";
import TeamsPage from "@/pages/teams";
import TeamDetail from "@/pages/team-detail";
import { ProductivityPage } from "@/pages/productivity";
import { Board } from "@/pages/board";
import MyTasks from "@/pages/my-tasks";
import { Topbar } from "@/components/ui/topbar";
import { cn } from "@/lib/utils";
import { TestDialog } from "@/components/test-dialog";
import AdminDashboard from "@/pages/admin-dashboard";
import SubscriptionPage from "@/pages/subscription";
import SubscriptionPlans from "@/pages/subscription-plans";
import Payment from "@/pages/payment";
import PaymentSuccess from "@/pages/payment-success";
import PaymentCancel from "@/pages/payment-cancel";
import FAQ from "@/pages/faq";
import DataExportPage from "@/pages/data-export";
import APIManagement from "@/pages/api-management";
import LandingPage from "@/pages/landing";

function MainLayout({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  
  // Überprüfen, ob der Benutzer ein Hyper-Admin ist
  const isHyperAdmin = user?.isHyperAdmin === true;
  
  // Überprüfen, ob der Benutzer nicht aktiviert ist (hat CompanyId aber isActive ist false)
  const isInactive = user?.companyId && !user?.isActive;
  
  // DEBUG: Detaillierte Benutzerinformationen für die Sidebar-Anzeige
  console.log("MainLayout - DETAILED User Info:", {
    userExists: !!user,
    userId: user?.id,
    username: user?.username,
    email: user?.email,
    companyId: user?.companyId,
    companyIdType: user?.companyId !== undefined ? typeof user.companyId : 'undefined',
    companyIdValue: String(user?.companyId),
    isNull: user?.companyId === null,
    isUndefined: user?.companyId === undefined,
    isFalsy: !user?.companyId,
    isCompanyAdmin: user?.isCompanyAdmin,
    subscriptionTier: user?.subscriptionTier,
    // Bedingungen für Abonnement-Menüpunkt
    condition1: !user?.companyId,
    condition2: user?.isCompanyAdmin,
    showSubscriptionMenu: user && (!user?.companyId || user?.isCompanyAdmin)
  });
  
  // Diese alte Debug-Nachricht wurde durch die detaillierte Version oben ersetzt
  
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full overflow-hidden bg-slate-50">
        {/* Animated Background Pattern */}
        <div 
          className="fixed inset-0 -z-10 opacity-20"
          style={{
            backgroundImage: `
              radial-gradient(circle at 50% 50%, rgba(var(--primary-rgb), 0.1) 0%, transparent 50%),
              radial-gradient(circle at 0% 0%, rgba(var(--primary-rgb), 0.05) 0%, transparent 50%),
              radial-gradient(circle at 100% 100%, rgba(var(--primary-rgb), 0.05) 0%, transparent 50%),
              linear-gradient(45deg, transparent 45%, rgba(var(--primary-rgb), 0.02) 50%, transparent 55%),
              linear-gradient(-45deg, transparent 45%, rgba(var(--primary-rgb), 0.02) 50%, transparent 55%)
            `,
            backgroundSize: '100% 100%, 50% 50%, 50% 50%, 20px 20px, 20px 20px',
            backgroundPosition: 'center, top left, bottom right, center, center',
            backgroundRepeat: 'no-repeat, no-repeat, no-repeat, repeat, repeat',
          }}
        />

        <Topbar />

        <Sidebar className="shrink-0 z-30 flex flex-col">
          <SidebarContent className="flex-grow">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setLocation("/dashboard")}
                  tooltip="Dashboard"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {/* Alle Menüpunkte außer Dashboard und Abonnement nur anzeigen, wenn der Benutzer aktiviert ist */}
              {!isInactive && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setLocation("/all-projects")}
                      tooltip="Projekte"
                    >
                      <Folder className="h-4 w-4" />
                      <span>Projekte</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  
                  {(user?.subscriptionTier && ['organisation', 'enterprise', 'kanbax'].includes(user.subscriptionTier.toLowerCase())) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => setLocation("/teams")}
                        tooltip="Teams"
                      >
                        <Users className="h-4 w-4" />
                        <span>Teams</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setLocation("/all-boards")}
                      tooltip="Boards"
                    >
                      <KanbanSquare className="h-4 w-4" />
                      <span>Boards</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  
                  {(!user?.subscriptionTier || ['organisation', 'enterprise'].includes(user.subscriptionTier.toLowerCase())) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => setLocation("/my-tasks")}
                        tooltip="Meine Aufgaben"
                      >
                        <CheckSquare className="h-4 w-4" />
                        <span>Meine Aufgaben</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  
                  {(user?.subscriptionTier && ['organisation', 'enterprise', 'kanbax'].includes(user.subscriptionTier.toLowerCase())) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => setLocation("/all-okrs")}
                        tooltip="OKRs"
                      >
                        <Target className="h-4 w-4" />
                        <span>OKRs</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setLocation("/productivity")}
                      tooltip="Produktivität"
                    >
                      <LineChart className="h-4 w-4" />
                      <span>Produktivität</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
              
              {/* Abonnement-Menüpunkt immer anzeigen - später wird die Seite selbst die Sichtbarkeit steuern */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setLocation("/subscription")}
                  tooltip="Abonnement"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Abonnement</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {/* FAQ-Menüpunkt immer anzeigen */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setLocation("/faq")}
                  tooltip="Häufig gestellte Fragen"
                >
                  <HelpCircle className="h-4 w-4" />
                  <span>FAQ</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {/* Datenexport-Menüpunkt immer anzeigen (DSGVO-Recht) */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setLocation("/data-export")}
                  tooltip="Daten exportieren"
                >
                  <Download className="h-4 w-4" />
                  <span>Datenexport</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {/* Hyper-Admin-Menüpunkt - nur anzeigen, wenn der Benutzer ein Hyper-Admin ist */}
              {isHyperAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setLocation("/admin")}
                    tooltip="SaaS-Administration"
                    className="border-t border-primary/10 mt-2 pt-2"
                  >
                    <Shield className="h-4 w-4 text-purple-600" />
                    <span className="font-semibold text-purple-600">Administration</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarContent>
          <div className="px-2 py-4 border-t flex justify-end">
            <SidebarTrigger />
          </div>
        </Sidebar>
        <div className="relative flex-1 overflow-x-auto ml-14">
          <main 
            className={cn(
              "min-h-screen w-full",
              "px-6 py-6 mr-12 mt-14", 
              "bg-white/30 backdrop-blur-[2px]",
              "transition-all duration-300 ease-in-out"
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) {
    setLocation("/auth");
    return null;
  }

  return (
    <MainLayout>
      <PauseNotice />
      <Component />
    </MainLayout>
  );
}

function AuthenticatedApp() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Verwenden Sie useEffect für Navigationsänderungen, um React-Rendering-Regeln einzuhalten
  React.useEffect(() => {
    if (user && window.location.pathname === "/") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  React.useEffect(() => {
    // Öffentliche Routen, die auch ohne Authentifizierung zugänglich sein müssen
    const publicPaths = ["/auth", "/payment/success", "/payment/cancel", "/landing"];
    const isPublicPath = publicPaths.some(path => window.location.pathname.startsWith(path));
    
    // Nur zur Auth-Seite weiterleiten, wenn keine öffentliche Route und kein authentifizierter Benutzer
    // Eingeloggte Benutzer können die Landingpage trotzdem besuchen
    if (!user && !isPublicPath && window.location.pathname !== "/landing") {
      setLocation("/landing");
    }
  }, [user, setLocation]);

  return (
    <Switch>
      <Route path="/landing" component={LandingPage} />
      <Route path="/auth" component={Auth} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/all-projects" component={() => <ProtectedRoute component={AllProjects} />} />
      <Route path="/projects/:id" component={() => <ProtectedRoute component={ProjectDetail} />} />
      <Route path="/teams" component={() => <ProtectedRoute component={TeamsPage} />} />
      <Route path="/teams/:id" component={() => <ProtectedRoute component={TeamDetail} />} />
      <Route path="/all-boards" component={() => <ProtectedRoute component={AllBoards} />} />
      <Route path="/boards/:id" component={() => <ProtectedRoute component={Board} />} />
      <Route path="/all-okrs" component={() => <ProtectedRoute component={AllOKRs} />} />
      <Route path="/all-okrs/:id" component={() => <ProtectedRoute component={OKRDetailPage} />} />
      {/* Fallback für alte Links */}
      <Route path="/objectives/:id" component={() => {
        const [, setLocation] = useLocation();
        // Holen Sie die ID direkt aus der URL
        const id = window.location.pathname.split('/').pop();
        if (id) {
          setLocation(`/all-okrs/${id}`);
        }
        return null;
      }} />
      <Route path="/productivity" component={() => <ProtectedRoute component={ProductivityPage} />} />
      <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />
      <Route path="/my-tasks" component={() => <ProtectedRoute component={MyTasks} />} />
      <Route path="/subscription" component={() => <ProtectedRoute component={SubscriptionPage} />} />
      <Route path="/faq" component={() => <ProtectedRoute component={FAQ} />} />
      <Route path="/data-export" component={() => <ProtectedRoute component={DataExportPage} />} />
      <Route path="/api-management" component={() => <ProtectedRoute component={APIManagement} />} />
      <Route path="/test-dialog" component={() => <ProtectedRoute component={TestDialog} />} />
      <Route path="/admin" component={() => <ProtectedRoute component={AdminDashboard} />} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      
      {/* Subscription und Payment Routes */}
      <Route path="/subscription-plans" component={SubscriptionPlans} />
      {/* Die Success- und Cancel-Routen sind absichtlich NICHT geschützt mit ProtectedRoute, 
          damit sie nach der Bezahlung erreichbar sind, ohne dass ein Login erforderlich ist */}
      <Route path="/payment/success" component={PaymentSuccess} />
      <Route path="/payment/cancel" component={PaymentCancel} />
      {/* Dieser Pfad kommt NACH den spezifischen Pfaden, da er sonst alle anderen überschreibt */}
      <Route path="/payment/:subscriptionId" component={() => <ProtectedRoute component={Payment} />} />

      {/* Redirects */}
      <Route path="/boards" component={() => {
        setLocation("/all-boards");
        return null;
      }} />
      <Route path="/projects" component={() => {
        setLocation("/all-projects");
        return null;
      }} />
      <Route path="/board" component={() => {
        setLocation("/all-boards");
        return null;
      }} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <StripeProvider>
          <BoardProvider>
            <TooltipProvider delayDuration={300} skipDelayDuration={100}>
              <AuthenticatedApp />
              <Toaster />
            </TooltipProvider>
          </BoardProvider>
        </StripeProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;