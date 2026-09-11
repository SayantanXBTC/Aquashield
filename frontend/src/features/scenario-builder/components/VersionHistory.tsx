import type { ScenarioVersion } from "../types";

interface VersionHistoryProps {
  versions: ScenarioVersion[];
  currentVersionNumber: number | null;
}

/** Read-only — historical versions are immutable and never editable here (§31). */
export function VersionHistory({ versions, currentVersionNumber }: VersionHistoryProps) {
  if (versions.length === 0) {
    return <p className="text-sm text-slate-500">No versions yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-2">
      {[...versions].reverse().map((version) => {
        const isCurrent = version.version_number === currentVersionNumber;
        const configSummary = Object.entries(version.scenario_config)
          .slice(0, 3)
          .map(([key, value]) => `${key}: ${String(value)}`)
          .join(", ");
        return (
          <li
            key={version.id}
            className="flex flex-col gap-1 rounded border border-slate-800 bg-slate-900/50 px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-100">Version {version.version_number}</span>
              {isCurrent && (
                <span className="rounded bg-sky-900 px-2 py-0.5 text-xs font-medium text-sky-300">Current</span>
              )}
              {version.label && <span className="text-sm text-slate-400">— {version.label}</span>}
            </div>
            <time dateTime={version.created_at} className="text-xs text-slate-500">
              {version.created_at ? new Date(version.created_at).toLocaleString() : ""}
            </time>
            {configSummary && <p className="text-sm text-slate-400">{configSummary}</p>}
          </li>
        );
      })}
    </ol>
  );
}
