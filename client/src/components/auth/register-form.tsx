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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-store";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import * as z from "zod";
import { useLocation } from "wouter";

// Erweitere das Schema für die Unternehmensdaten
const companyRegisterSchema = z.object({
  companyName: z.string().min(2, "Der Unternehmensname muss mindestens 2 Zeichen lang sein"),
  companyAddress: z.string().min(5, "Die Adresse muss mindestens 5 Zeichen lang sein"),
  companyCity: z.string().min(2, "Die Stadt muss mindestens 2 Zeichen lang sein"),
  companyZip: z.string().min(4, "Die Postleitzahl muss mindestens 4 Zeichen lang sein"),
  companyCountry: z.string().min(2, "Das Land muss mindestens 2 Zeichen lang sein"),
});

// Basisschema für alle Benutzer
const baseRegisterSchema = z.object({
  username: insertUserSchema.shape.username,
  email: insertUserSchema.shape.email,
  password: insertUserSchema.shape.password,
  subscriptionPackageId: z.number().optional(), // Made optional
  inviteCode: z.string().optional(), // Moved here
});


// Dynamisches Schema, das basierend auf dem Pakettyp angepasst wird
const registerFormSchema = z.intersection(
  baseRegisterSchema,
  z.union([
    // Für Unternehmens-Pakete (Enterprise, Organisation) - only if not using invite code
    z.object({
      packageType: z.literal("company"),
      ...companyRegisterSchema.shape
    }),
    // Für Einzelpersonen-Pakete (Free, Freelancer) or invite code
    z.object({
      packageType: z.literal("individual"),
    })
  ])
);

type RegisterForm = z.infer<typeof registerFormSchema>;

export function RegisterForm() {
  const { register } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  // Prüfen, ob der with-code Parameter in der URL vorhanden ist
  const withCompanyCode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('with-code') === 'true';
  }, []);

  // Hier holen wir die verfügbaren Abonnement-Pakete
  const { data: subscriptionPackages, isLoading } = useQuery({
    queryKey: ["/api/public/subscription-packages"],
    refetchOnWindowFocus: false,
  });

  // Hole die gespeicherte Paket-ID aus localStorage, nur wenn kein Einladungscode verwendet wird
  const preselectedPackageId = useMemo(() => {
    if (withCompanyCode) return undefined;
    const storedId = localStorage.getItem('selectedPackageId');
    return storedId ? parseInt(storedId) : undefined;
  }, [withCompanyCode]);

  // Bestimme, ob das vorausgewählte Paket ein Unternehmenspaket ist
  const getPackageType = (packageId: number | undefined) => {
    if (withCompanyCode) return "individual"; // Always individual with invite code

    if (!packageId || !subscriptionPackages) return undefined;

    const selectedPackage = subscriptionPackages.find((pkg: any) => pkg.id === packageId);
    if (!selectedPackage) return undefined;

    // Wir nehmen an, dass "organisation" und "enterprise" Unternehmenspakete sind
    const isCompanyPackage = ["organisation", "enterprise"].includes(selectedPackage.name.toLowerCase());
    return isCompanyPackage ? "company" : "individual";
  };

  const packageType = useMemo(() => getPackageType(preselectedPackageId), [preselectedPackageId, subscriptionPackages]);


  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      inviteCode: "",
      subscriptionPackageId: preselectedPackageId,
      packageType: packageType as "company" | "individual" || "individual",
      companyName: "",
      companyAddress: "",
      companyCity: "",
      companyZip: "",
      companyCountry: "",
    },
  });

  // Aktualisiere den packageType, wenn sich das ausgewählte Paket ändert
  useEffect(() => {
    const subscriptionPackageId = form.watch("subscriptionPackageId");
    const newPackageType = getPackageType(subscriptionPackageId);

    if (newPackageType && newPackageType !== form.getValues("packageType")) {
      form.setValue("packageType", newPackageType as "company" | "individual");
    }
  }, [form.watch("subscriptionPackageId"), subscriptionPackages]);

  // Wenn kein Paket vorausgewählt wurde und es keine Registrierung mit Code ist,
  // leite zur Paketauswahl weiter
  useEffect(() => {
    if (!preselectedPackageId && !isLoading && !withCompanyCode) {
      toast({
        title: "Paket auswählen",
        description: "Bitte wählen Sie zuerst ein Abonnement-Paket aus",
      });
      setLocation("/subscription-plans");
    }
  }, [preselectedPackageId, isLoading, toast, setLocation, withCompanyCode]);

  const onSubmit = async (data: RegisterForm) => {
    try {
      // Bei Registrierung mit Einladungscode aus URL
      if (withCompanyCode) {
        await register(
          data.username, 
          data.email, 
          data.password, 
          data.inviteCode, 
          undefined 
        );

        toast({ 
          title: "Registrierung erfolgreich", 
          description: "Ihr Konto wurde erstellt. Ein Administrator muss Ihren Account noch freischalten.",
        });
        return;
      }

      // Normale Registrierungslogik (ohne Einladungscode-URL)
      if (data.packageType === "company") {
        const companyData = {
          name: data.companyName,
          address: data.companyAddress,
          city: data.companyCity,
          zip: data.companyZip,
          country: data.companyCountry
        };

        await register(
          data.username, 
          data.email, 
          data.password, 
          "auto-generated", 
          data.subscriptionPackageId,
          companyData
        );
      } else {
        await register(
          data.username, 
          data.email, 
          data.password, 
          data.inviteCode || "", 
          data.subscriptionPackageId
        );
      }

      localStorage.removeItem('selectedPackageId');

      // Bei kostenpflichtigen Paketen informiere über Weiterleitung zur Zahlung
      const selectedPackage = subscriptionPackages?.find((pkg: any) => pkg.id === data.subscriptionPackageId);
      
      if (selectedPackage?.price > 0) {
        toast({
          title: "Weiterleitung zur Zahlung",
          description: "Ihre Registrierung war erfolgreich. Sie werden zur Zahlungsseite weitergeleitet...",
        });
        // Die tatsächliche Weiterleitung erfolgt durch die auth-store.tsx Implementierung
      } else {
        toast({
          title: "Registrierung erfolgreich", 
          description: data.packageType === "company" 
            ? "Ihr Unternehmen und Ihr Konto wurden erstellt. Sie können sich jetzt anmelden."
            : "Ihr Konto wurde erstellt. Ein Administrator muss Ihren Account noch freischalten.",
        });
      }
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

        {withCompanyCode && (
          <FormField
            control={form.control}
            name="inviteCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unternehmenseinladungscode</FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    className="font-medium border-primary"
                    required={true}
                  />
                </FormControl>
                <FormDescription>
                  Bitte geben Sie den Einladungscode ein, den Sie von Ihrem Unternehmen erhalten haben.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}


        {!withCompanyCode && (
          <>
            {form.watch("packageType") === "individual" && form.watch("subscriptionPackageId") && (
              <>
                {/* Einladungscode nur für Business-Pakete anzeigen */}
                {/* Der Einladungscode wird nicht mehr hier angezeigt */}
              </>
            )}

            {form.watch("packageType") === "company" && (
              <div className="space-y-4 border p-4 rounded-md bg-muted/10">
                <h3 className="text-lg font-semibold">Unternehmensdaten</h3>

                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unternehmensname</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="companyAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unternehmensadresse</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="companyZip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PLZ</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="companyCity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stadt</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="companyCountry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Land</FormLabel>
                      <FormControl>
                        <Input {...field} defaultValue="Deutschland" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
            <FormField
              control={form.control}
              name="subscriptionPackageId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Abonnement-Paket</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      const numValue = parseInt(value);
                      console.log("Paket ausgewählt:", numValue, typeof numValue);
                      // Stelle sicher, dass es eine Zahl ist
                      field.onChange(numValue);
                    }}
                    value={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Bitte wählen Sie ein Paket" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {isLoading ? (
                        <SelectItem value="loading" disabled>Pakete werden geladen...</SelectItem>
                      ) : (
                        subscriptionPackages?.map((pkg: any) => (
                          <SelectItem key={pkg.id} value={pkg.id.toString()}>
                            {pkg.displayName} ({(pkg.price/100).toFixed(2).replace('.', ',')}€)
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {form.watch("packageType") === "company" 
                      ? "Sie haben ein Unternehmenspaket gewählt, das mehrere Benutzer unterstützt."
                      : "Individual-Pakete sind für die persönliche Nutzung bestimmt."}
                    {form.watch("subscriptionPackageId") === 2 && 
                      " - Freelancer-Paket erkannt (ID: 2)"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {form.watch("subscriptionPackageId") && 
         subscriptionPackages?.find((pkg: any) => pkg.id === form.watch("subscriptionPackageId"))?.price > 0 && (
          <div className="space-y-4 border p-4 rounded-md bg-muted/10">
            <h3 className="text-lg font-semibold">Zahlungsinformationen</h3>
            <p className="text-sm text-muted-foreground">
              Nach der Registrierung werden Sie zur Zahlungsseite weitergeleitet, 
              um Ihre Zahlungsdaten sicher über Stripe einzugeben.
            </p>
          </div>
        )}

        <Button type="submit" className="w-full">
          Registrieren
        </Button>
      </form>
    </Form>
  );
}