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

// Import and re-export the apiRequest from queryClient to consolidate API requests
import { apiRequest } from './queryClient';
export { apiRequest };