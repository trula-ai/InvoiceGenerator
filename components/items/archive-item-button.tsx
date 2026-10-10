"use client";

import { useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setItemArchivedAction } from "@/lib/actions/items";

export function ArchiveItemButton({ itemId, archived, compact }: { itemId: string; archived: boolean; compact?: boolean }) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await setItemArchivedAction(itemId, !archived);
      if (result.ok) toast.success(archived ? "Item restored" : "Item archived");
      else toast.error(result.error);
    });
  }

  if (compact) {
    return (
      <Button variant="ghost" size="icon-sm" aria-label={archived ? "Restore item" : "Archive item"} onClick={toggle} disabled={pending}>
        {archived ? <ArchiveRestore /> : <Archive />}
      </Button>
    );
  }

  return (
    <Button variant="outline" onClick={toggle} disabled={pending}>
      {archived ? <ArchiveRestore /> : <Archive />}
      {archived ? "Restore" : "Archive"}
    </Button>
  );
}
