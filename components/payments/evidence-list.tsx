import { FileText, Image as ImageIcon } from "lucide-react";

import type { EvidenceSummary } from "@/lib/data/payments";

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Links to the proof files attached to a payment. Each opens through the authenticated evidence route. */
export function EvidenceList({ paymentId, evidence, emptyLabel = "No proof attached" }: { paymentId: string; evidence: EvidenceSummary[]; emptyLabel?: string | null }) {
  if (evidence.length === 0) return emptyLabel ? <span className="text-xs text-muted-foreground">{emptyLabel}</span> : null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {evidence.map((e) => {
        const Icon = e.contentType.startsWith("image/") ? ImageIcon : FileText;
        return (
          <li key={e.id}>
            <a
              href={`/api/payments/${paymentId}/evidence/${e.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-56 items-center gap-1 rounded-md border px-2 py-0.5 text-xs hover:bg-muted"
              title={`${e.fileName} · ${sizeLabel(e.sizeBytes)}${e.uploadedByName ? ` · uploaded by ${e.uploadedByName}` : ""}`}
            >
              <Icon className="size-3 shrink-0" />
              <span className="truncate">{e.fileName}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
