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