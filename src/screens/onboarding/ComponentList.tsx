// What GetcKo can run right now: one row per engine component, with a real status chip.
// Required models first, then the optional ones under a small label. Missing models are shown as
// missing (with the file name), never offered as a download.
import type { SetupStatus } from "../../bindings/SetupStatus";
import { StatusChip, cn } from "../../components/ui";
import { APP_COPY } from "../../app/copy";
import { PLATFORM } from "../../app/platform";
import { ONBOARDING_COPY } from "./copy";
import { visibleComponentRows, type ComponentRow } from "./flow";

export interface ComponentListProps {
  status: SetupStatus | undefined;
  className?: string;
}

function chip(r: ComponentRow) {
  if (r.state === "processing") return <StatusChip status="processing">{ONBOARDING_COPY.loadingTag}</StatusChip>;
  if (r.state === "failed")
    return <StatusChip status="failed">{ONBOARDING_COPY.problem(r.problem ?? "unavailable", PLATFORM)}</StatusChip>;
  return <StatusChip status="ready" />;
}

/** One row: name and one chip; a missing model adds its exact file name, in full, on the next line. */
function Row({ r }: { r: ComponentRow }) {
  const name = APP_COPY.components[r.component];
  return (
    <li className="flex min-h-11 flex-col justify-center gap-0.5 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 text-row text-text">
          {name}
        </span>
        <span className="shrink-0">{chip(r)}</span>
      </div>
      {r.state === "failed" && r.file && <span className="break-all font-mono text-caption text-text-2">{r.file}</span>}
    </li>
  );
}

export function ComponentList({ status, className }: ComponentListProps) {
  // Models only. The microphone device has its own permission row; it shows here only when it failed.
  const rows = visibleComponentRows(status);
  const required = rows.filter((r) => r.required);
  const optional = rows.filter((r) => !r.required);
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <ul className="flex flex-col divide-y divide-border">
        {required.map((r) => (
          <Row key={r.component} r={r} />
        ))}
      </ul>
      {optional.length > 0 && (
        <>
          <p className="pt-2 text-caption text-text-3">{ONBOARDING_COPY.optionalTag}</p>
          <ul className="flex flex-col divide-y divide-border">
            {optional.map((r) => (
              <Row key={r.component} r={r} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
