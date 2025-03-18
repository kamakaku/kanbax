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
          className="flex gap-2 items-center px-4 py-2"
        >
          {showFavorites ? (
            <>
              <StarOff className="h-5 w-5 text-gray-600" />
              <span>Alle anzeigen</span>
            </>
          ) : (
            <>
              <Star className="h-5 w-5 text-yellow-400" />
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
              <Card key={project.id} className="p-4 relative">
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-10">
                    <h3 className="font-semibold">{project.title}</h3>
                    <p className="text-sm text-gray-500">{project.description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-3 right-3 p-2 hover:bg-gray-100 rounded-full"
                    onClick={() => toggleFavorite('project', project.id, project.isFavorite)}
                  >
                    {project.isFavorite ? (
                      <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
                    ) : (
                      <Star className="h-6 w-6 text-gray-400 hover:text-yellow-400" />
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="boards">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBoards?.map((board) => (
              <Card key={board.id} className="p-4 relative">
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-10">
                    <h3 className="font-semibold">{board.title}</h3>
                    <p className="text-sm text-gray-500">{board.description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-3 right-3 p-2 hover:bg-gray-100 rounded-full"
                    onClick={() => toggleFavorite('board', board.id, board.isFavorite)}
                  >
                    {board.isFavorite ? (
                      <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
                    ) : (
                      <Star className="h-6 w-6 text-gray-400 hover:text-yellow-400" />
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="objectives">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredObjectives?.map((objective) => (
              <Card key={objective.id} className="p-4 relative">
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-10">
                    <h3 className="font-semibold">{objective.title}</h3>
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
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-3 right-3 p-2 hover:bg-gray-100 rounded-full"
                    onClick={() => toggleFavorite('objective', objective.id, objective.isFavorite)}
                  >
                    {objective.isFavorite ? (
                      <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
                    ) : (
                      <Star className="h-6 w-6 text-gray-400 hover:text-yellow-400" />
                    )}
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