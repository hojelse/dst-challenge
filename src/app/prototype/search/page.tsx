import { Suspense } from "react";
import { PrototypeSwitcher } from "@/components/prototype-switcher";
import { SearchPrototypeClient, VARIANTS } from "./client";

export default function SearchPrototypePage() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading prototype...</div>}>
        <SearchPrototypeClient />
        <PrototypeSwitcher queryKey="variant" variants={VARIANTS} />
      </Suspense>
    </div>
  );
}
