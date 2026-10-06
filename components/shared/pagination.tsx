import Link from "next/link";

import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  /** Current search params, used to build prev/next links. */
  params: Record<string, string | undefined>;
  basePath: string;
}

export function Pagination({ page, pageSize, total, params, basePath }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  const link = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" nativeButton={false} disabled={page <= 1} render={<Link href={link(page - 1)} aria-disabled={page <= 1} />}>
          Previous
        </Button>
        <Button variant="outline" size="sm" nativeButton={false} disabled={page >= pages} render={<Link href={link(page + 1)} aria-disabled={page >= pages} />}>
          Next
        </Button>
      </div>
    </div>
  );
}
