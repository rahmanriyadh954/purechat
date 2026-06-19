import { Skeleton } from "@/components/ui/skeleton";

export default function CallsLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </main>
  );
}
