import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApproveAttributionButton, ProposeAttributionDialog, ReassignAttributionDialog, RejectAttributionDialog } from "@/components/attribution/attribution-actions";
import type { AttributionStatus } from "@/db/schema";
import { ATTRIBUTION_STATUS_LABELS, type AttributionDetail, type AttributionEventDetail, type SalespersonOption } from "@/lib/data/attribution";
import { formatDateTime } from "@/lib/format";

const DOTS: Record<AttributionStatus, string> = { pending: "bg-amber-500", approved: "bg-emerald-500", rejected: "bg-destructive" };

/** Status pill for an attribution. Safe in server and client components. */
export function AttributionStatusBadge({ status, className }: { status: AttributionStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", className)}>
      <span className={cn("size-1.5 rounded-full", DOTS[status])} aria-hidden />
      {ATTRIBUTION_STATUS_LABELS[status]}
    </Badge>
  );
}

const ACTION_LABELS: Record<AttributionEventDetail["action"], string> = {
  proposed: "Proposed",
  reproposed: "Proposed again",
  approved: "Approved",
  rejected: "Rejected",
  reassigned: "Reassigned",
};

export function AttributionHistory({ events }: { events: AttributionEventDetail[] }) {
  if (events.length === 0) return null;
  return (
    <ol className="flex flex-col gap-1.5 text-xs text-muted-foreground">
      {events.map((e) => (
        <li key={e.id}>
          <span className="font-medium text-foreground">{ACTION_LABELS[e.action]}</span>
          {e.action === "reassigned" && e.fromName ? ` ${e.fromName} → ${e.toName ?? "?"}` : e.toName ? ` ${e.toName}` : ""}
          {e.actorName ? ` by ${e.actorName}` : ""} · {formatDateTime(e.createdAt)}
          {e.note ? <span className="block pl-3 italic">“{e.note}”</span> : null}
        </li>
      ))}
    </ol>
  );
}

interface AttributionCardProps {
  invoiceId: string;
  attribution: AttributionDetail | null;
  events: AttributionEventDetail[];
  salespeople: SalespersonOption[];
  defaultUserId: string | null;
  currentUserId: string;
  canAssign: boolean;
  canApprove: boolean;
}

/**
 * "Sales credit" card on the invoice page. Shows who is credited and the
 * sales manager's decision, with the actions the signed-in user may take.
 * Independent of the Payments card: it never shows or changes payment state.
 */
export function AttributionCard({ invoiceId, attribution, events, salespeople, defaultUserId, currentUserId, canAssign, canApprove }: AttributionCardProps) {
  const label = attribution ? `${attribution.creditedName}` : "";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Sales credit
          {attribution ? <AttributionStatusBadge status={attribution.status} /> : null}
        </CardTitle>
        <CardDescription>
          {attribution
            ? attribution.status === "approved"
              ? `Credited to ${attribution.creditedName}${attribution.reviewedByName ? `, approved by ${attribution.reviewedByName}` : ""}. Internal only; not printed on documents.`
              : attribution.status === "rejected"
                ? `Crediting ${attribution.creditedName} was rejected${attribution.reviewedByName ? ` by ${attribution.reviewedByName}` : ""}. Propose the correct owner again.`
                : `${attribution.creditedName} was proposed${attribution.assignedByName ? ` by ${attribution.assignedByName}` : ""}. Waiting for a sales manager.`
            : "Nobody has been credited with this sale yet. The credited person is internal and feeds the incentive calculation; it is never printed for the client."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {attribution ? (
          <dl className="grid gap-1.5">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Credited to</dt>
              <dd className="font-medium">{attribution.creditedName}</dd>
            </div>
            {attribution.previousCreditedName ? (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Previously</dt>
                <dd>{attribution.previousCreditedName}</dd>
              </div>
            ) : null}
            {attribution.reason ? (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Proposer&apos;s note</dt>
                <dd className="text-right">{attribution.reason}</dd>
              </div>
            ) : null}
            {attribution.reviewNote ? (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Manager&apos;s note</dt>
                <dd className="text-right">{attribution.reviewNote}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {!attribution && canAssign && salespeople.length ? <ProposeAttributionDialog invoiceId={invoiceId} salespeople={salespeople} defaultUserId={defaultUserId} mode="new" /> : null}
          {attribution?.status === "rejected" && canAssign ? <ProposeAttributionDialog invoiceId={invoiceId} salespeople={salespeople} defaultUserId={defaultUserId} mode="again" /> : null}
          {attribution?.status === "pending" && canAssign ? <ProposeAttributionDialog invoiceId={invoiceId} salespeople={salespeople} defaultUserId={attribution.creditedUserId} mode="change" /> : null}
          {attribution?.status === "pending" && canApprove ? (
            <>
              <ApproveAttributionButton attributionId={attribution.id} invoiceId={invoiceId} label={label} />
              <RejectAttributionDialog attributionId={attribution.id} invoiceId={invoiceId} label={label} />
            </>
          ) : null}
          {attribution && attribution.status !== "rejected" && canApprove ? (
            <ReassignAttributionDialog attributionId={attribution.id} invoiceId={invoiceId} label={label} salespeople={salespeople} currentUserId={currentUserId} />
          ) : null}
        </div>

        <AttributionHistory events={events} />
      </CardContent>
    </Card>
  );
}
