import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/lib/auth-store";
import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Folder, LayoutDashboard, KanbanSquare } from "lucide-react";
import Board from "@/pages/board";
import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import Auth from "@/pages/auth";
import NotFound from "@/pages/not-found";
import ProjectDetail from "@/pages/project-detail";
import AllBoards from "@/pages/all-boards";

function MainLayout({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setLocation("/dashboard")}
                  className="w-full"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setLocation("/projects")}
                  className="w-full"
                >
                  <Folder className="h-4 w-4" />
                  <span>Projekte</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setLocation("/boards")}
                  className="w-full"
                >
                  <KanbanSquare className="h-4 w-4" />
                  <span>Boards</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 p-6">{children}</main>
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

function Router() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect to dashboard if logged in and at root
  if (user && window.location.pathname === "/") {
    setLocation("/dashboard");
    return null;
  }

  // Redirect to auth if not logged in and not on auth page
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
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;