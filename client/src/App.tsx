import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useAuth, AuthProvider } from "@/lib/auth-store";
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarContent, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  SidebarTrigger 
} from "@/components/ui/sidebar";
import { LayoutDashboard, Folder, KanbanSquare, UserCircle, Target, LineChart, Users } from "lucide-react";
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
import { ProductivityPage } from "@/pages/productivity";
import { Board } from "@/pages/board";
import { Topbar } from "@/components/ui/topbar";
import { cn } from "@/lib/utils";

function MainLayout({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();

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

        <Sidebar className="shrink-0 z-30">
          <div className="flex items-center justify-end px-2 h-12">
            <SidebarTrigger />
          </div>
          <SidebarContent>
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
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setLocation("/all-projects")}
                  tooltip="Projekte"
                >
                  <Folder className="h-4 w-4" />
                  <span>Projekte</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setLocation("/teams")}
                  tooltip="Teams"
                >
                  <Users className="h-4 w-4" />
                  <span>Teams</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setLocation("/all-boards")}
                  tooltip="Boards"
                >
                  <KanbanSquare className="h-4 w-4" />
                  <span>Boards</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setLocation("/all-okrs")}
                  tooltip="OKRs"
                >
                  <Target className="h-4 w-4" />
                  <span>OKRs</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setLocation("/productivity")}
                  tooltip="Produktivität"
                >
                  <LineChart className="h-4 w-4" />
                  <span>Produktivität</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setLocation("/profile")}
                  tooltip="Profil"
                >
                  <UserCircle className="h-4 w-4" />
                  <span>Profil</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
        <div className="relative flex-1 overflow-x-auto">
          <main 
            className={cn(
              "min-h-screen w-full",
              "px-6 py-6 mr-12 mt-16", 
              "bg-white/30 backdrop-blur-[2px]",
              "transition-[width] duration-300 ease-in-out"
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
      <Component />
    </MainLayout>
  );
}

function AuthenticatedApp() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (user && window.location.pathname === "/") {
    setLocation("/dashboard");
    return null;
  }

  if (!user && window.location.pathname !== "/auth") {
    setLocation("/auth");
    return null;
  }

  return (
    <Switch>
      <Route path="/auth" component={Auth} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/all-projects" component={() => <ProtectedRoute component={AllProjects} />} />
      <Route path="/projects/:id" component={() => <ProtectedRoute component={ProjectDetail} />} />
      <Route path="/teams" component={() => <ProtectedRoute component={TeamsPage} />} />
      <Route path="/all-boards" component={() => <ProtectedRoute component={AllBoards} />} />
      <Route path="/boards/:id" component={() => <ProtectedRoute component={Board} />} />
      <Route path="/all-okrs" component={() => <ProtectedRoute component={AllOKRs} />} />
      <Route path="/all-okrs/:id" component={() => <ProtectedRoute component={OKRDetailPage} />} />
      <Route path="/productivity" component={() => <ProtectedRoute component={ProductivityPage} />} />
      <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />

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
        <AuthenticatedApp />
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;