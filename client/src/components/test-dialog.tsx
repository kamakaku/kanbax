import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TestDialog() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-2xl font-bold">Dialog Test</h2>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="default">Öffne Dialog</Button>
        </DialogTrigger>

        <DialogContent className="max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Dialog mit fester Button-Leiste</DialogTitle>
            <DialogDescription>
              Dieses Dialog-Fenster demonstriert das neue Design mit einer festen Button-Leiste am unteren Rand.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Ihr Name" />

            <Label htmlFor="email">Email</Label>
            <Input id="email" placeholder="email@example.com" />
            
            <div className="h-[400px] border rounded p-4 flex items-center justify-center bg-muted/30">
              <p className="text-muted-foreground">Dies ist Scrollbarer Inhalt</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={() => setOpen(false)}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">Öffne Standard-Dialog</Button>
        </DialogTrigger>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Standard-Dialog</DialogTitle>
            <DialogDescription>
              Dies ist ein Dialog ohne besondere Anpassungen.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p>Hier könnte Ihr Inhalt stehen.</p>
          </div>

          <DialogFooter>
            <Button>Bestätigen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}