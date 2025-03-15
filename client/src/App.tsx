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
import { LayoutDashboard, Folder, KanbanSquare, UserCircle, Target } from "lucide-react";
import Board from "@/pages/board";
import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import Auth from "@/pages/auth";
import NotFound from "@/pages/not-found";
import ProjectDetail from "@/pages/project-detail";
import AllBoards from "@/pages/all-boards";
import Profile from "@/pages/profile";
import OKRPage from "@/pages/okr";
import { cn } from "@/lib/utils";

function MainLayout({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full overflow-hidden bg-slate-50">
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
                  onClick={() => setLocation("/projects")}
                  tooltip="Projekte"
                >
                  <Folder className="h-4 w-4" />
                  <span>Projekte</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setLocation("/boards")}
                  tooltip="Boards"
                >
                  <KanbanSquare className="h-4 w-4" />
                  <span>Boards</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setLocation("/okr")}
                  tooltip="OKRs"
                >
                  <Target className="h-4 w-4" />
                  <span>OKRs</span>
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
              "px-6 py-6 mr-12",
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
      <Route path="/projects" component={() => <ProtectedRoute component={Projects} />} />
      <Route path="/projects/:id" component={() => <ProtectedRoute component={ProjectDetail} />} />
      <Route path="/board" component={() => <ProtectedRoute component={Board} />} />
      <Route path="/boards" component={() => <ProtectedRoute component={AllBoards} />} />
      <Route path="/okr" component={() => <ProtectedRoute component={OKRPage} />} />
      <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
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