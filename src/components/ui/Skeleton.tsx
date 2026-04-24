import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("skeleton rounded-lg", className)} />
  );
}

export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="os-block p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-3 rounded-full" />
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-4 w-10 ml-auto" />
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === 0 ? "w-3/4" : "w-1/2"}`} />
      ))}
    </div>
  );
}

export function SkeletonPage({ cards = 4 }: { cards?: number }) {
  return (
    <div className="px-5 pt-6 pb-10 space-y-3">
      <Skeleton className="h-6 w-32 mb-5" />
      {Array.from({ length: cards }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
