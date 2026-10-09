import type { Citation } from "../../bindings/Citation";

export function CitationChip({ citation }: { citation: Citation }) {
  return (
    <span className="gc-citation">
      {citation.documentName} · {citation.location}
    </span>
  );
}
