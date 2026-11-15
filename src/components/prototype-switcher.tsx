"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

type VariantValue = "A" | "B" | "C";

const variants: VariantValue[] = ["A", "B", "C"];

type PrototypeSwitcherProps = {
  queryKey: string;
};

export function PrototypeSwitcher({ queryKey }: PrototypeSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active = useMemo(() => {
    const value = searchParams.get(queryKey);
    return value === "A" || value === "B" || value === "C" ? value : "A";
  }, [queryKey, searchParams]);

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  function setVariant(nextVariant: VariantValue) {
    const next = new URLSearchParams(searchParams.toString());
    next.set(queryKey, nextVariant);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border bg-background/95 p-1 shadow-lg backdrop-blur">
      <div className="flex items-center gap-1">
        {variants.map((variant) => (
          <Button
            key={variant}
            size="sm"
            variant={active === variant ? "default" : "outline"}
            onClick={() => setVariant(variant)}
          >
            Variant {variant}
          </Button>
        ))}
      </div>
    </div>
  );
}
