import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { Separator } from "@/components/ui/separator";
import { User, Building, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { Company } from "@shared/schema";

export function CompanyInfoSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Abfrage der Unternehmensdetails, wenn der Benutzer einer Firma angehört
  const {
    data: company,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/api/companies', user?.companyId],
    enabled: !!user?.companyId,
  });

  // Abfrage der Unternehmensmitglieder
  const {
    data: companyMembers,
    isLoading: isMembersLoading,
  } = useQuery({
    queryKey: ['/api/companies/members', user?.companyId],
    enabled: !!user?.companyId,
  });

  // Wenn der Benutzer keinem Unternehmen angehört
  if (!user?.companyId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unternehmensinformationen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Building className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Kein Unternehmen zugewiesen</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              Sie sind derzeit keinem Unternehmen zugewiesen. Der Administrator kann Sie zu einem Unternehmen hinzufügen.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Während des Ladens
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unternehmensinformationen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Wenn ein Fehler aufgetreten ist
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unternehmensinformationen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-sm text-red-500">
              Fehler beim Laden der Unternehmensinformationen.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unternehmensinformationen</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Unternehmensdaten */}
          <div>
            <div className="flex items-center">
              <Building className="h-5 w-5 mr-2 text-primary" />
              <h3 className="text-lg font-medium">{company?.name}</h3>
            </div>
            {company?.description && (
              <p className="text-sm text-muted-foreground mt-2">
                {company.description}
              </p>
            )}
            <div className="mt-2">
              {user?.isCompanyAdmin && (
                <Badge variant="outline" className="mr-2 bg-primary/10">
                  Administrator
                </Badge>
              )}
              <Badge variant="outline">
                Mitglied
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Mitgliederliste */}
          <div>
            <div className="flex items-center mb-4">
              <Users className="h-5 w-5 mr-2 text-primary" />
              <h3 className="font-medium">Unternehmensmitglieder</h3>
            </div>

            {isMembersLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <ul className="space-y-2">
                {companyMembers?.map((member: any) => (
                  <li key={member.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                    <div className="flex items-center">
                      <div className="relative">
                        {member.avatarUrl ? (
                          <img 
                            src={member.avatarUrl} 
                            alt={member.username} 
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium">{member.username}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <div>
                      {member.isCompanyAdmin && (
                        <Badge variant="outline" className="bg-primary/10">
                          Admin
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}