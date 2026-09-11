import { useCallback, useEffect, useState } from "react";
import { ApiError, type ListScenariosParams, scenarioApi } from "../api/scenarioApi";
import type { ScenarioListItem } from "../types";

interface UseScenariosResult {
  scenarios: ScenarioListItem[];
  total: number;
  status: "idle" | "loading" | "success" | "error";
  error: string | null;
  refetch: () => void;
}

const PAGE_SIZE = 20;

export function useScenarios(params: ListScenariosParams): UseScenariosResult {
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<UseScenariosResult["status"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    // Setting the loading flag before the fetch starts is the standard
    // data-fetching effect pattern (react.dev/learn/you-might-not-need-an-effect's
    // own fetch example does the same) — react-hooks/set-state-in-effect
    // flags it anyway; there's no external-system subscription to defer to here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("loading");
    setError(null);

    scenarioApi
      .getScenarios({ limit: PAGE_SIZE, ...params })
      .then((page) => {
        if (cancelled) return;
        setScenarios(page.items);
        setTotal(page.total);
        setStatus("success");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Failed to load scenarios.");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
    // params is a plain object rebuilt by the caller each render — stringify
    // to avoid refetching on every render when its contents haven't changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params), reloadToken]);

  return { scenarios, total, status, error, refetch };
}
