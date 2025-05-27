import { useState, useEffect } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";
import { useLocation } from "wouter";

export default function Auth() {
  // Prüfen, ob wir einen Einladungscode oder mode=invite in der URL haben
  const params = new URLSearchParams(window.location.search);
  const hasInviteCode = params.get('with-code') === 'true';
  const isRegisterMode = params.get('mode') === 'register';
  const isInviteMode = params.get('mode') === 'invite';
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(!(hasInviteCode || isInviteMode || isRegisterMode || location.state?.isRegister));
  
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Redirect to dashboard if already logged in
    if (user) {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  // Don't render anything while redirecting
  if (user) {
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/50">
      <div className="w-full max-w-md space-y-8 p-8 bg-background rounded-lg shadow-lg">
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            {isLogin ? "Willkommen zurück" : "Konto erstellen"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isLogin
              ? "Geben Sie Ihre Anmeldedaten ein, um auf Ihr Konto zuzugreifen"
              : "Füllen Sie die Felder aus, um ein neues Konto zu erstellen"}
          </p>
        </div>

        {isLogin ? <LoginForm /> : <RegisterForm />}

        
      </div>
    </div>
  );
}