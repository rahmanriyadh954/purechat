import { Skeleton } from "@/components/ui/skeleton";

export default function ChatsLoading() {
  return (
    <main className="grid h-screen grid-cols-1 bg-background md:grid-cols-[360px_1fr]">
      <aside className="hidden border-r bg-card p-4 md:block">
        <Skeleton className="mb-5 h-11 w-full" />
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, index) => (
            <div className="flex items-center gap-3" key={index}>
              <Skeleton className="size-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </aside>
      <section className="flex flex-col p-4">
        <Skeleton className="mb-4 h-16 w-full" />
        <div className="flex flex-1 flex-col justify-end gap-3">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="ml-auto h-12 w-1/2" />
          <Skeleton className="h-20 w-3/4" />
        </div>
        <Skeleton className="mt-4 h-14 w-full" />
      </section>
    </main>
  );
}
