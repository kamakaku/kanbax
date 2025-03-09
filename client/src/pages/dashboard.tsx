import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-store";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import type { Board } from "@shared/schema";

export default function Dashboard() {
  const { user } = useAuth();

  const { data: boards } = useQuery<Board[]>({
    queryKey: ["/api/boards"],
    queryFn: async () => {
      const res = await fetch("/api/boards");
      if (!res.ok) {
        throw new Error("Failed to fetch boards");
      }
      return res.json();
    },
  });

  return (
    <div className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">Welcome, {user?.username}!</h1>
          <p className="text-muted-foreground mt-2">Here's an overview of your workspace</p>
        </div>
        <Button asChild>
          <Link href="/board">
            <Plus className="mr-2 h-4 w-4" />
            New Board
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Boards</CardTitle>
            <CardDescription>Total number of boards you have</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{boards?.length || 0}</p>
          </CardContent>
        </Card>

        {boards && boards.length > 0 ? (
          <div className="col-span-full">
            <h2 className="text-2xl font-bold mb-4">Your Boards</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {boards.map((board) => (
                <Link key={board.id} href={`/board`}>
                  <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardHeader>
                      <CardTitle>{board.title}</CardTitle>
                      <CardDescription>{board.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground">No boards yet. Create your first board to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}
