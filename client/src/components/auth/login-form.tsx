import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-store";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginForm() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation(); // Using useLocation from wouter

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.password);
      toast({ title: "Successfully logged in" });
    } catch (error) {
      toast({
        title: "Failed to login",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full">
            Login
          </Button>
        </form>
      </Form>

      <div className="mt-6 text-center text-sm">
        <Button
          variant="link"
          onClick={() => setLocation("/subscription-plans")} // Updated onClick handler using setLocation
          className="text-sm"
        >
          Noch kein Konto? Jetzt registrieren
        </Button>
        <p>
          Haben Sie einen Einladungscode von Ihrem Unternehmen?{' '}
          <a 
            href="/auth?with-code=true"
            className="text-primary hover:underline font-medium"
          >
            Hier registrieren
          </a>
        </p>
      </div>
    </>
  );
}