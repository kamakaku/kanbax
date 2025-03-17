type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function apiRequest(
  method: HttpMethod,
  endpoint: string,
  data?: unknown
) {
  const options: RequestInit = {
    method,
    credentials: "include", // Add cookie support
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  console.log(`Making ${method} request to ${endpoint}`, { options });
  const response = await fetch(endpoint, options);
  console.log(`Response from ${endpoint}:`, {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries())
  });

  // Handle non-2xx responses
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error(`API Error (${response.status}):`, errorData);
    const error = new Error(errorData.message || `HTTP error! status: ${response.status}`);
    throw error;
  }

  return response;
}