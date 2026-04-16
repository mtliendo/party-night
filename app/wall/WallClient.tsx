"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import type { Animal } from "@/lib/db";

export default function WallClient({ animals: initialAnimals }: { animals: Animal[] }) {
  const [animals, setAnimals] = useState<Animal[]>(initialAnimals);
  const [selected, setSelected] = useState<Animal | null>(null);

  const closeModal = useCallback(() => setSelected(null), []);
  const updateAnimal = useCallback((updated: Animal) => {
    setAnimals((current) =>
      current.map((animal) => (animal.id === updated.id ? updated : animal))
    );
    setSelected((current) => (current?.id === updated.id ? updated : current));
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!selected) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, closeModal]);

  useEffect(() => {
    const hasPending = animals.some((a) => !a.video_url || a.status !== "posted");
    if (!hasPending) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/animals");
        if (!res.ok) return;
        const fresh: Animal[] = await res.json();
        setAnimals(fresh);
        const stillPending = fresh.some((a) => !a.video_url || a.status !== "posted");
        if (!stillPending) clearInterval(interval);
      } catch {
        // silently ignore transient fetch errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [animals]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-dark)" }}>
      {/* Nav */}
      <nav
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <Link
          href="/"
          className="text-2xl tracking-wider hover:opacity-80 transition-opacity"
          style={{ fontFamily: "var(--font-bangers)", color: "var(--hot-pink)" }}
        >
          PARTY ANIMALS
        </Link>
        <div className="flex items-center gap-4">
          <span
            className="text-sm font-semibold tracking-widest uppercase"
            style={{ color: "var(--neon-cyan)" }}
          >
            The Wall
          </span>
          <Link href="/draw" className="btn-primary text-sm py-2 px-5">
            Draw Yours
          </Link>
        </div>
      </nav>

      <main className="flex-1 px-6 py-12 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1
            className="text-6xl sm:text-7xl mb-4 tracking-wide"
            style={{ fontFamily: "var(--font-bangers)" }}
          >
            <span className="gradient-text glow-pink">THE WALL</span>
          </h1>
          <p style={{ color: "var(--text-muted)" }}>
            Every animal, immortalized forever.
          </p>
          <Separator className="mt-8 opacity-20" />
        </div>

        {/* Count badge */}
        <div className="flex items-center justify-between mb-8">
          <Badge
            className="text-sm px-4 py-1.5"
            style={{
              background: "rgba(255,45,120,0.12)",
              border: "1px solid rgba(255,45,120,0.3)",
              color: "var(--hot-pink)",
            }}
          >
            {animals.length} {animals.length === 1 ? "animal" : "animals"} on the wall
          </Badge>
        </div>

        {/* Grid */}
        {animals.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {animals.map((animal) => (
              <AnimalCard key={animal.id} animal={animal} onClick={() => setSelected(animal)} />
            ))}
          </div>
        )}
      </main>

      <footer
        className="text-center py-8 text-xs border-t"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        Powered by{" "}
        <span style={{ color: "var(--hot-pink)" }}>Auth0 Token Vault</span> ·{" "}
        <span style={{ color: "var(--neon-cyan)" }}>Grok AI</span>
      </footer>

      {selected && (
        <AnimalModal animal={selected} onClose={closeModal} onAnimalUpdated={updateAnimal} />
      )}
    </div>
  );
}

function AnimalCard({ animal, onClick }: { animal: Animal; onClick: () => void }) {
  return (
    <div
      className="card flex flex-col cursor-pointer group"
      onClick={onClick}
    >
      {/* Media */}
      <div
        className="relative w-full aspect-square overflow-hidden"
        style={{ background: "var(--bg-card-hover)" }}
      >
        {animal.video_url ? (
          <video
            src={animal.video_url}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : animal.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={animal.image_url}
            alt={`${animal.x_handle}'s party animal`}
            className="w-full h-full object-contain p-4"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Skeleton className="w-full h-full" />
          </div>
        )}

        {/* Hover overlay hint */}
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: "rgba(0,0,0,0.45)" }}
        >
          <span
            className="text-sm font-semibold tracking-widest uppercase"
            style={{ color: "var(--neon-cyan)" }}
          >
            View
          </span>
        </div>

        {/* Status pill */}
        <div className="absolute top-3 right-3">
          {animal.status === "posted" ? (
            <Badge
              className="text-xs"
              style={{
                background: "rgba(0,240,255,0.15)",
                border: "1px solid rgba(0,240,255,0.4)",
                color: "var(--neon-cyan)",
              }}
            >
              Posted to X
            </Badge>
          ) : animal.video_url ? (
            <Badge
              className="text-xs"
              style={{
                background: "rgba(176,38,255,0.15)",
                border: "1px solid rgba(176,38,255,0.4)",
                color: "var(--electric-purple)",
              }}
            >
              Animated
            </Badge>
          ) : (
            <Badge
              className="text-xs"
              style={{
                background: "rgba(255,215,0,0.15)",
                border: "1px solid rgba(255,215,0,0.4)",
                color: "var(--gold)",
              }}
            >
              Processing
            </Badge>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 flex items-center justify-between">
        <a
          href={`https://x.com/${animal.x_handle.replace("@", "")}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-sm font-semibold hover:opacity-80 transition-opacity"
          style={{ color: "var(--hot-pink)" }}
        >
          {animal.x_handle.startsWith("@") ? animal.x_handle : `@${animal.x_handle}`}
        </a>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {new Date(animal.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}

function AnimalModal({
  animal,
  onClose,
  onAnimalUpdated,
}: {
  animal: Animal;
  onClose: () => void;
  onAnimalUpdated: (animal: Animal) => void;
}) {
  const handle = animal.x_handle.startsWith("@") ? animal.x_handle : `@${animal.x_handle}`;
  const tweetUrl = animal.tweet_id ? `https://x.com/i/web/status/${animal.tweet_id}` : null;
  const [postState, setPostState] = useState<
    { type: "idle" } | { type: "posting" } | { type: "success" } | { type: "error"; message: string }
  >({ type: "idle" });

  async function handlePostToX() {
    setPostState({ type: "posting" });

    try {
      const res = await fetch(`/api/animals/${animal.id}/post-to-x`, {
        method: "POST",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to post to X.");
      }

      onAnimalUpdated({
        ...animal,
        status: "posted",
        tweet_id: data.tweetId ?? animal.tweet_id,
      });
      setPostState({ type: "success" });
    } catch (err) {
      setPostState({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to post to X.",
      });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl overflow-hidden"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          boxShadow: "0 0 60px rgba(255,45,120,0.15), 0 0 120px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <span
              className="text-xl tracking-wide"
              style={{ fontFamily: "var(--font-bangers)", color: "var(--hot-pink)" }}
            >
              {handle}
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {new Date(animal.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-xl leading-none hover:opacity-60 transition-opacity"
            style={{ color: "var(--text-muted)" }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Media panels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
          {/* Original drawing */}
          <div
            className="flex flex-col"
            style={{ borderRight: "1px solid var(--border)" }}
          >
            <div
              className="text-center py-2 text-xs font-semibold tracking-widest uppercase"
              style={{
                color: "var(--neon-cyan)",
                borderBottom: "1px solid var(--border)",
                background: "rgba(0,240,255,0.04)",
              }}
            >
              Original Drawing
            </div>
            <div
              className="aspect-square flex items-center justify-center p-4"
              style={{ background: "var(--bg-dark)" }}
            >
              {animal.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={animal.image_url}
                  alt={`${handle}'s original drawing`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Skeleton className="w-full h-full" />
              )}
            </div>
          </div>

          {/* Animated video */}
          <div className="flex flex-col">
            <div
              className="text-center py-2 text-xs font-semibold tracking-widest uppercase"
              style={{
                color: "var(--electric-purple)",
                borderBottom: "1px solid var(--border)",
                background: "rgba(176,38,255,0.04)",
              }}
            >
              AI Animation
            </div>
            <div
              className="aspect-square flex items-center justify-center"
              style={{ background: "var(--bg-dark)" }}
            >
              {animal.video_url ? (
                <video
                  src={animal.video_url}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Skeleton className="w-24 h-24 rounded-full" />
                  <span className="text-xs" style={{ color: "var(--gold)" }}>
                    Generating animation…
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex items-center justify-between border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex flex-col gap-2">
            <button
              onClick={handlePostToX}
              disabled={!animal.video_url || postState.type === "posting"}
              className="btn-primary text-sm px-5 py-2 border-0"
              style={{
                background:
                  postState.type === "posting"
                    ? "rgba(255,45,120,0.4)"
                    : "linear-gradient(135deg, var(--hot-pink), var(--electric-purple))",
              }}
            >
              {postState.type === "posting"
                ? "Posting..."
                : animal.status === "posted"
                  ? "Post to X Again"
                  : "Post to X"}
            </button>
            {postState.type === "error" && (
              <span className="text-xs" style={{ color: "var(--hot-pink)" }}>
                {postState.message}
              </span>
            )}
            {postState.type === "success" && (
              <span className="text-xs" style={{ color: "var(--neon-cyan)" }}>
                Posted to X.
              </span>
            )}
            {tweetUrl && (
              <a
                href={tweetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold hover:opacity-80 transition-opacity"
                style={{ color: "var(--neon-cyan)" }}
              >
                View post on X →
              </a>
            )}
          </div>
          <div
            className="text-sm font-semibold"
            style={{ color: animal.status === "posted" ? "var(--neon-cyan)" : "var(--text-muted)" }}
          >
            {animal.status === "posted" ? "Posted to X" : "Ready to share"}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center gap-6">
      <div className="text-8xl">🐾</div>
      <h2
        className="text-4xl tracking-wide"
        style={{ fontFamily: "var(--font-bangers)", color: "var(--text-muted)" }}
      >
        The wall is empty
      </h2>
      <p style={{ color: "var(--text-muted)" }}>
        Be the first to unleash your party animal.
      </p>
      <Link href="/draw" className="btn-primary">
        Draw Your Animal 🎨
      </Link>
    </div>
  );
}
