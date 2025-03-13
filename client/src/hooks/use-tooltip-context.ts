import { useStore } from "@/lib/store"
import { useAuth } from "@/lib/auth-store"

interface TooltipContext {
  variant: "default" | "info" | "warning" | "success"
  description?: string
  shortcut?: string
}

export function useTooltipContext(elementType: string): TooltipContext {
  const { currentBoard } = useStore()
  const { user } = useAuth()

  const context: Record<string, TooltipContext> = {
    "board-create": {
      variant: "info",
      description: "Erstellen Sie ein neues Board für Ihr Projekt",
      shortcut: "⌘ + B",
    },
    "task-add": {
      variant: user ? "default" : "warning",
      description: user 
        ? "Fügen Sie eine neue Aufgabe hinzu" 
        : "Bitte melden Sie sich an, um Aufgaben hinzuzufügen",
    },
    "task-edit": {
      variant: "default",
      description: "Bearbeiten Sie die Details dieser Aufgabe",
    },
    "column-add": {
      variant: currentBoard ? "default" : "warning",
      description: currentBoard
        ? "Fügen Sie eine neue Spalte hinzu"
        : "Wählen Sie zuerst ein Board aus",
    }
  }

  return context[elementType] || { variant: "default" }
}
