import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { type Objective } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ObjectiveForm } from "@/components/okr/objective-form";
import { OkrTable } from "@/components/okr/okr-table";
import { useState } from "react";

export function OKRPage() {
  const [isObjectiveDialogOpen, setIsObjectiveDialogOpen] = useState(false);

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">OKRs</h1>
          <Dialog open={isObjectiveDialogOpen} onOpenChange={setIsObjectiveDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="h-4 w-4 mr-2" />
                Neues Objective
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Neues Objective erstellen</DialogTitle>
              </DialogHeader>
              <ObjectiveForm onSuccess={() => setIsObjectiveDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <OkrTable />
    </div>
  );
}

export default OKRPage;