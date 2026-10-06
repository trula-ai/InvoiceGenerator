"use client";

import { useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setClientArchivedAction } from "@/lib/actions/clients";

export function ArchiveClientButton({ clientId, archived }: { clientId: string; archived: boolean }) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await setClientArchivedAction(clientId, !archived);
      if (result.ok) toast.success(archived ? "Client restored" : "Client archived");
      else toast.error(result.error);
    });
  }

  return (
    <Button variant="outline" onClick={toggle} disabled={pending}>
      {archived ? <ArchiveRestore /> : <Archive />}
      {archived ? "Restore" : "Archive"}
    </Button>
  );
}
