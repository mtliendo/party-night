import { auth0 } from "@/lib/auth0";

export default async function Home() {
  const session = await auth0.getSession();

  if (!session) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center gap-6 py-32 px-16 bg-white dark:bg-black">
          <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
            Party Animals
          </h1>
          <div className="flex gap-4">
            <a
              className="flex h-12 items-center justify-center rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
              href="/auth/login?screen_hint=signup"
            >
              Sign up
            </a>
            <a
              className="flex h-12 items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
              href="/auth/login"
            >
              Log in
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center gap-6 py-32 px-16 bg-white dark:bg-black">
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Logged in as {session.user.email}
        </p>
        <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
          User Profile
        </h1>
        <pre className="w-full rounded-lg bg-zinc-100 dark:bg-zinc-900 p-4 text-sm text-zinc-800 dark:text-zinc-200 overflow-auto">
          {JSON.stringify(session.user, null, 2)}
        </pre>
        <a
          className="flex h-12 items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
          href="/auth/logout"
        >
          Log out
        </a>
      </main>
    </div>
  );
}
