import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type Project } from "@shared/schema";
import { useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProjectForm } from "@/components/project/project-form";

export default function Projects() {
  const [showForm, setShowForm] = useState(false);
  const [, setLocation] = useLocation();

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects"],
  });

  const handleProjectClick = (projectId: number) => {
    setLocation(`/projects/${projectId}`);
  };

  return (
    <div className="container py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Projekte</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
        >
          Neues Projekt
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Keine Projekte vorhanden</p>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Projekte</h2>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="group hover:shadow-lg transition-all duration-300 cursor-pointer border border-primary/20 h-[120px]"
                  onClick={() => handleProjectClick(project.id)}
                >
                  <CardHeader className="p-4 space-y-2">
                    <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
                      {project.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {project.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">Alle Projekte</h2>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="group hover:shadow-lg transition-all duration-300 cursor-pointer border border-primary/10 hover:border-primary/20 h-[120px]"
                  onClick={() => handleProjectClick(project.id)}
                >
                  <CardHeader className="p-4 space-y-2">
                    <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
                      {project.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {project.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      <ProjectForm
        open={showForm}
        onClose={() => setShowForm(false)}
      />
    </div>
  );
}