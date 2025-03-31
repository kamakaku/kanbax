import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date): string {
  return format(date, "dd.MM.yyyy", { locale: de });
}

/**
 * Konvertiert verschiedene Fehlertypen in eine benutzerfreundliche Fehlermeldung
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  } else if (typeof error === 'string') {
    return error;
  } else if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Ein unbekannter Fehler ist aufgetreten';
}

import { apiRequest as originalApiRequest } from './queryClient';
export { originalApiRequest as apiRequest };
export function getPriorityColor(priority: string) {
  switch (priority.toLowerCase()) {
    case 'high':
      return 'text-red-500';
    case 'medium':
      return 'text-yellow-500';
    case 'low':
      return 'text-blue-500';
    default:
      return 'text-gray-500';
  }
}

/**
 * Hilfsfunktion zum Anfordern eines API-Schlüssels als Secret
 * @param secrets Liste der Secret-Schlüssel, die angefordert werden sollen
 * @param message Nachricht, die dem Benutzer angezeigt werden soll
 */
export async function askSecretsHelper(secrets: string[], message: string): Promise<void> {
  try {
    const response = await fetch('/api/ask-secrets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secrets,
        message
      }),
    });
    
    if (!response.ok) {
      console.error('Fehler beim Anfordern von Secrets:', await response.text());
    }
  } catch (error) {
    console.error('Fehler beim Anfordern von Secrets:', error);
  }
}
