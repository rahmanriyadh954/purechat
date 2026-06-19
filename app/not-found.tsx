import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-lg">
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This PureChat page is not available or the link has expired.
        </p>
        <Button asChild className="mt-5">
          <Link href="/chats">Open chats</Link>
        </Button>
      </section>
    </main>
  );
}
