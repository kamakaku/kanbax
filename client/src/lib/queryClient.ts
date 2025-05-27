import { QueryClient } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await res.json();
        const error: any = new Error(errorData.message || `${res.status}: ${res.statusText}`);
        error.response = {
          status: res.status,
          data: errorData,
          statusText: res.statusText
        };
        error.details = errorData.details || '';
        throw error;
      } else {
        const text = await res.text() || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }
    } catch (e) {
      if (e instanceof Error && (e as any).response) {
        throw e; // Wenn bereits ein formatierter Fehler existiert, werfe ihn weiter
      }
      throw new Error(`${res.status}: ${res.statusText}`);
    }
  }
}

export async function apiRequest<T>(
  method: string = "GET",
  url: string,
  data?: unknown | undefined,
): Promise<T> {
  console.log(`Sending ${method} request to ${url}`, data);
  try {
    const res = await fetch(url, {
      method: method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    console.log(`Response from ${url}:`, res.status, res.statusText);
    
    if (!res.ok) {
      console.log("Response not OK - attempting to parse error");
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorText = await res.text();
        console.log("Error response text:", errorText);
        try {
          const errorData = JSON.parse(errorText);
          console.log("Parsed error data:", errorData);
        } catch (e) {
          console.log("Failed to parse error as JSON:", e);
        }
      } else {
        const text = await res.text();
        console.log("Non-JSON error response:", text);
      }
    }

    await throwIfResNotOk(res);
    const jsonResponse = await res.json();
    console.log(`JSON response from ${url}:`, jsonResponse);
    return jsonResponse;
  } catch (error) {
    console.error(`API request to ${url} failed:`, error);
    throw error;
  }
}

// Default fetch function for React Query
async function defaultQueryFn({ queryKey }: { queryKey: string[] }): Promise<any> {
  if (queryKey.length === 0) return null;
  
  const url = queryKey[0];
  console.log("defaultQueryFn - URL:", url);
  
  const res = await fetch(url, {
    method: "GET", // Explizit GET-Methode angeben
    credentials: "include",
  });
  
  await throwIfResNotOk(res);
  return res.json();
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 0, // Kein staleTime mehr, damit Daten immer neu geladen werden
      refetchOnMount: true, // Daten immer neu laden, wenn die Komponente mountet
      queryFn: defaultQueryFn,
    },
  },
});

// Expose the queryClient globally for access from other components
// This is especially important for payment success page to invalidate the cache
declare global {
  interface Window {
    queryClient: QueryClient;
  }
}

// Make queryClient available globally
if (typeof window !== 'undefined') {
  window.queryClient = queryClient;
}