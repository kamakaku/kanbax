import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Board, Project, Objective } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

export function AllItems() {
  const [showFavorites, setShowFavorites] = useState(false);
  const [, setLocation] = useLocation();

  const { data: projects } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const { data: boards } = useQuery<Board[]>({
    queryKey: ['/api/boards'],
  });

  const { data: objectives } = useQuery<Objective[]>({
    queryKey: ['/api/objectives'],
  });

  const toggleFavorite = async (type: 'project' | 'board' | 'objective', id: number, currentValue: boolean | null | undefined) => {
    try {
      await apiRequest('PATCH', `/api/${type}s/${id}/favorite`);
      await queryClient.invalidateQueries({ queryKey: [`/api/${type}s`] });
    } catch (error) {
      console.error(`Failed to toggle favorite for ${type}:`, error);
    }
  };

  const filteredProjects = projects?.filter(p => !showFavorites || p.isFavorite);
  const filteredBoards = boards?.filter(b => !showFavorites || b.isFavorite);
  const filteredObjectives = objectives?.filter(o => !showFavorites || o.isFavorite);

  const navigateToDetail = (type: 'project' | 'board' | 'objective', id: number) => {
    if (type === 'project') {
      setLocation(`/projects/${id}`);
    } else if (type === 'board') {
      setLocation(`/all-boards`); 
    } else {
      setLocation(`/okr/${id}`);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Alle Elemente</h1>
        <Button
          variant="outline"
          onClick={() => setShowFavorites(!showFavorites)}
          className="flex items-center gap-2"
        >
          <Star className={showFavorites ? "fill-yellow-400 text-yellow-400" : ""} />
          <span>{showFavorites ? "Alle anzeigen" : "Nur Favoriten"}</span>
        </Button>
      </div>

      <Tabs defaultValue="projects" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="projects">Projekte</TabsTrigger>
          <TabsTrigger value="boards">Boards</TabsTrigger>
          <TabsTrigger value="objectives">OKRs</TabsTrigger>
        </TabsList>

        <TabsContent value="projects">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects?.map((project) => (
              <Card 
                key={project.id} 
                className="p-4 group cursor-pointer relative"
                onClick={() => navigateToDetail('project', project.id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold group-hover:text-primary transition-colors">
                      {project.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{project.description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite('project', project.id, project.isFavorite);
                    }}
                  >
                    <Star 
                      className={`h-5 w-5 ${project.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400 hover:text-yellow-400"}`} 
                    />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="boards">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBoards?.map((board) => (
              <Card 
                key={board.id} 
                className="p-4 group cursor-pointer relative"
                onClick={() => navigateToDetail('board', board.id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold group-hover:text-primary transition-colors">
                      {board.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{board.description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite('board', board.id, board.isFavorite);
                    }}
                  >
                    <Star 
                      className={`h-5 w-5 ${board.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400 hover:text-yellow-400"}`} 
                    />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="objectives">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredObjectives?.map((objective) => (
              <Card 
                key={objective.id} 
                className="p-4 group cursor-pointer relative"
                onClick={() => navigateToDetail('objective', objective.id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold group-hover:text-primary transition-colors">
                      {objective.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{objective.description}</p>
                    <div className="mt-2">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 rounded-full h-2"
                          style={{ width: `${objective.progress}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {objective.progress}% abgeschlossen
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite('objective', objective.id, objective.isFavorite);
                    }}
                  >
                    <Star 
                      className={`h-5 w-5 ${objective.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400 hover:text-yellow-400"}`} 
                    />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}