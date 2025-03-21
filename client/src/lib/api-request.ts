type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function apiRequest(
  method: HttpMethod,
  endpoint: string,
  data?: unknown,
  userId?: number
) {
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (data || userId) {
    // Add userId to the request data if provided
    const requestData = {
      ...(typeof data === 'object' ? data : {}),
      user_id: userId, // Changed from userId to user_id to match database column
    };
    options.body = JSON.stringify(requestData);
  }

  const response = await fetch(endpoint, options);
  return response;
}