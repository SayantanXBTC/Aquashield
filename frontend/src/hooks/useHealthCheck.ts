import { useEffect, useState } from "react";
import { fetchHealth, type HealthResponse } from "@/api/health";

type Status = "loading" | "ok" | "error";

export function useHealthCheck(): { status: Status; data: HealthResponse | null } {
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<HealthResponse | null>(null);

  useEffect(() => {
    fetchHealth()
      .then((result) => {
        setData(result);
        setStatus("ok");
      })
      .catch(() => {
        setStatus("error");
      });
  }, []);

  return { status, data };
}
