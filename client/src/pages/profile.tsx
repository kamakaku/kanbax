import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth-store";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, User, Shield, Users, Bell } from "lucide-react";
import { AvatarCropDialog } from "@/components/ui/avatar-crop-dialog";
import { NotificationSettingsForm } from "@/components/profile/notification-settings";
import { CompanyInfoSection } from "@/components/profile/company-info";
import { UserManagement } from "@/components/profile/user-management";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const profileSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email address"),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "Password must be at least 8 characters").optional(),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  if (data.newPassword && !data.currentPassword) {
    return false;
  }
  return true;
}, {
  message: "Current password is required when setting a new password",
  path: ["currentPassword"],
}).refine((data) => {
  if (data.newPassword !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function Profile() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: user?.username || "",
      email: user?.email || "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          ...data,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }

      const updatedUser = await res.json();
      setUser(updatedUser);
      toast({ title: "Profile updated successfully" });

      // Reset password fields
      form.reset({
        ...data,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      toast({
        title: "Failed to update profile",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
        setIsCropOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = async (croppedImage: Blob) => {
    try {
      const formData = new FormData();
      formData.append('avatar', croppedImage, 'avatar.jpg');
      formData.append('userId', user?.id?.toString() || '');

      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }

      const updatedUser = await res.json();
      setUser(updatedUser);
      toast({ title: "Avatar updated successfully" });
    } catch (error) {
      toast({
        title: "Failed to update avatar",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container max-w-4xl py-10 space-y-8">
      <div className="flex items-center gap-6 mb-8">
        <div className="relative">
          <Avatar className="h-20 w-20">
            {user?.avatarUrl && <AvatarImage src={user.avatarUrl} />}
            <AvatarFallback className="bg-primary/10">
              <User className="h-10 w-10" />
            </AvatarFallback>
          </Avatar>
          <Button
            size="icon"
            variant="outline"
            className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="h-4 w-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{user?.username}</h1>
          <p className="text-muted-foreground">{user?.email}</p>
        </div>
      </div>
      
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="w-full mb-6 grid grid-cols-4 h-12">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>Profil</span>
          </TabsTrigger>
          <TabsTrigger value="company" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span>Unternehmen</span>
          </TabsTrigger>
          {user?.isCompanyAdmin && (
            <TabsTrigger id="tab-user-management" value="user-management" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Benutzerverwaltung</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span>Benachrichtigungen</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profileinstellungen</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Passwort ändern</h3>

                    <FormField
                      control={form.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Aktuelles Passwort</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Neues Passwort</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Neues Passwort bestätigen</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Wird gespeichert..." : "Änderungen speichern"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="company" className="mt-6">
          <CompanyInfoSection />
        </TabsContent>
        
        {user?.isCompanyAdmin && (
          <TabsContent value="user-management" className="mt-6">
            <UserManagement />
          </TabsContent>
        )}
        
        <TabsContent value="notifications" className="mt-6">
          <NotificationSettingsForm />
        </TabsContent>
      </Tabs>

      <AvatarCropDialog
        open={isCropOpen}
        onOpenChange={setIsCropOpen}
        imageSrc={selectedImage || ''}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}