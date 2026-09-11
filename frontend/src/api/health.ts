const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

export interface HealthResponse {
  status: string;
  service: string;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  return (await response.json()) as HealthResponse;
}
