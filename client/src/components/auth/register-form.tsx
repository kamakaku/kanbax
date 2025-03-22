import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-store";
import { useToast } from "@/hooks/use-toast";
import * as z from "zod";

const registerFormSchema = z.object({
  username: insertUserSchema.shape.username,
  email: insertUserSchema.shape.email,
  password: insertUserSchema.shape.password,
  inviteCode: z.string().min(1, "Unternehmenseinladungscode ist erforderlich")
});

type RegisterForm = z.infer<typeof registerFormSchema>;

export function RegisterForm() {
  const { register } = useAuth();
  const { toast } = useToast();

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      inviteCode: "",
    },
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      await register(data.username, data.email, data.password, data.inviteCode);
      toast({ 
        title: "Registrierung erfolgreich", 
        description: "Ihr Konto wurde erstellt. Ein Administrator muss Ihren Account noch freischalten.",
      });
    } catch (error) {
      toast({
        title: "Registrierung fehlgeschlagen",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Benutzername</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-Mail</FormLabel>
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
              <FormLabel>Passwort</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="inviteCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Unternehmenseinladungscode</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>
                Der Einladungscode wird von einem Administrator Ihres Unternehmens bereitgestellt.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">
          Registrieren
        </Button>
      </form>
    </Form>
  );
}
