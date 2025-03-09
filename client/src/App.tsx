import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/lib/auth-store";
import Board from "@/pages/board";
import Dashboard from "@/pages/dashboard";
import Auth from "@/pages/auth";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) {
    setLocation("/auth");
    return null;
  }

  return <Component />;
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
      <Route path="/board" component={() => <ProtectedRoute component={Board} />} />
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