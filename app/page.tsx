import Link from "next/link";
import { ShieldCheck, Sparkles, Video, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const highlights = [
  {
    icon: ShieldCheck,
    title: "Privacy-first",
    text: "Private chats stay private. Reports include only the content a user chooses to submit."
  },
  {
    icon: UsersRound,
    title: "Family-safe groups",
    text: "Group approvals, warnings, and Islamic-safe filters help keep shared spaces calm."
  },
  {
    icon: Video,
    title: "Calls and media",
    text: "Messaging, uploads, voice notes, audio calls, video calls, and call history are built in."
  }
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Link className="flex items-center gap-3" href="/">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
            P
          </span>
          <span className="text-lg font-semibold tracking-normal">PureChat</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost">
            <Link href="/auth/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/chats">Open app</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-88px)] w-full max-w-7xl items-center gap-10 px-4 pb-12 pt-8 sm:px-6 lg:grid-cols-[1fr_0.95fr]">
        <div className="max-w-2xl space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm text-muted-foreground">
            <Sparkles className="size-4 text-accent" />
            Premium Islamic-safe modern messenger
          </div>
          <div className="space-y-5">
            <h1 className="text-4xl font-semibold tracking-normal text-foreground sm:text-5xl lg:text-6xl">
              PureChat
            </h1>
            <p className="max-w-xl text-lg leading-8 text-muted-foreground">
              Clean, trustworthy messaging for families, teams, and communities. Built with private chats, group tools, rich media, calls, and careful moderation.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/auth/register">Create account</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/chats">View messenger</Link>
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {highlights.map((item) => (
              <div className="rounded-lg border bg-card p-4 shadow-sm" key={item.title}>
                <item.icon className="mb-3 size-5 text-primary" />
                <h2 className="font-medium">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-lg border bg-card shadow-2xl shadow-primary/10">
          <div className="border-b bg-muted/50 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Family Circle</p>
                <p className="text-sm text-muted-foreground">4 online · family-safe mode on</p>
              </div>
              <div className="flex gap-2">
                <span className="size-3 rounded-full bg-primary" />
                <span className="size-3 rounded-full bg-accent" />
              </div>
            </div>
          </div>
          <div className="space-y-4 p-5">
            <div className="max-w-[78%] rounded-lg bg-muted p-3 text-sm">
              Assalamu alaikum, dinner plans are confirmed for 7.
            </div>
            <div className="ml-auto max-w-[78%] rounded-lg bg-primary p-3 text-sm text-primary-foreground">
              Perfect. I will bring dessert and share the location here.
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="text-sm font-medium">Voice message</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="h-2 w-8 rounded-full bg-primary" />
                <span className="h-2 w-16 rounded-full bg-accent" />
                <span className="h-2 w-10 rounded-full bg-primary/60" />
                <span className="text-xs text-muted-foreground">0:18</span>
              </div>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
              Message approval is on for new group members.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
