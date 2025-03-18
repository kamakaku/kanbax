import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Board, Project, Objective } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, StarOff } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function AllItems() {
  const [showFavorites, setShowFavorites] = useState(false);

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
      await apiRequest(`/api/${type}s/${id}/favorite`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      // Invalidate the relevant query to refresh the data
      await queryClient.invalidateQueries({ queryKey: [`/api/${type}s`] });
    } catch (error) {
      console.error(`Failed to toggle favorite for ${type}:`, error);
    }
  };

  const filteredProjects = projects?.filter(p => !showFavorites || p.isFavorite);
  const filteredBoards = boards?.filter(b => !showFavorites || b.isFavorite);
  const filteredObjectives = objectives?.filter(o => !showFavorites || o.isFavorite);

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Alle Elemente</h1>
        <Button
          variant="outline"
          onClick={() => setShowFavorites(!showFavorites)}
          className="flex gap-2 items-center"
        >
          {showFavorites ? (
            <>
              <StarOff className="w-5 h-5" />
              <span>Alle anzeigen</span>
            </>
          ) : (
            <>
              <Star className="w-5 h-5" />
              <span>Nur Favoriten</span>
            </>
          )}
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
              <Card key={project.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold">{project.title}</h3>
                  <Button
                    variant="ghost"
                    onClick={() => toggleFavorite('project', project.id, project.isFavorite)}
                    className="p-1"
                  >
                    {project.isFavorite ? '⭐' : '☆'}
                  </Button>
                </div>
                <p className="text-sm text-gray-500">{project.description}</p>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="boards">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBoards?.map((board) => (
              <Card key={board.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold">{board.title}</h3>
                  <Button
                    variant="ghost"
                    onClick={() => toggleFavorite('board', board.id, board.isFavorite)}
                    className="p-1"
                  >
                    {board.isFavorite ? '⭐' : '☆'}
                  </Button>
                </div>
                <p className="text-sm text-gray-500">{board.description}</p>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="objectives">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredObjectives?.map((objective) => (
              <Card key={objective.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold">{objective.title}</h3>
                  <Button
                    variant="ghost"
                    onClick={() => toggleFavorite('objective', objective.id, objective.isFavorite)}
                    className="p-1"
                  >
                    {objective.isFavorite ? '⭐' : '☆'}
                  </Button>
                </div>
                <p className="text-sm text-gray-500">{objective.description}</p>
                <div className="mt-2">
                  <div className="bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 rounded-full h-2"
                      style={{ width: `${objective.progress}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-500">{objective.progress}% abgeschlossen</span>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}