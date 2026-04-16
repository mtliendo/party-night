"use client";

import dynamic from "next/dynamic";
import { useState, useCallback } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcalidrawImperativeAPI = any;

// Dynamically import the wrapper (not Excalidraw directly) so the CSS
// import inside ExcalidrawWrapper only runs client-side.
const ExcalidrawWrapper = dynamic(
  () => import("@/components/ExcalidrawWrapper").then((mod) => mod.ExcalidrawWrapper),
  { ssr: false, loading: () => <CanvasLoader /> }
);

type SubmitState =
  | { type: "idle" }
  | { type: "submitting" }
  | { type: "success" }
  | { type: "error"; message: string };

export default function DrawClient() {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const onExcalidrawAPI = useCallback((api: ExcalidrawImperativeAPI) => setExcalidrawAPI(api), []);
  const [xHandle, setXHandle] = useState("");
  const [state, setState] = useState<SubmitState>({ type: "idle" });

  async function handleSubmit() {
    if (!xHandle.trim()) {
      setState({ type: "error", message: "Please enter your X handle." });
      return;
    }

    if (!excalidrawAPI) {
      setState({ type: "error", message: "Canvas not ready — please wait a moment." });
      return;
    }

    const elements = excalidrawAPI.getSceneElements();
    const hasContent = elements.some((el: { isDeleted: boolean }) => !el.isDeleted);
    if (!hasContent) {
      setState({ type: "error", message: "Draw something first!" });
      return;
    }

    setState({ type: "submitting" });

    try {
      // Export canvas to blob
      const { exportToBlob } = await import("@excalidraw/excalidraw");
      const blob = await exportToBlob({
        elements,
        appState: excalidrawAPI.getAppState(),
        files: excalidrawAPI.getFiles(),
        mimeType: "image/png",
        quality: 0.92,
      });

      const formData = new FormData();
      formData.append("image", blob, "animal.png");
      formData.append("xHandle", xHandle.trim());

      const res = await fetch("/api/animals", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Submission failed. Please try again.");
      }

      setState({ type: "success" });
    } catch (err) {
      setState({
        type: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  }

  if (state.type === "success") {
    return <SuccessScreen xHandle={xHandle} />;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0" style={{ background: "var(--bg-dark)" }}>
      {/* Nav */}
      <nav
        className="flex items-center justify-between px-6 py-4 border-b shrink-0"
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
          <Link href="/wall" className="text-sm hover:text-white transition-colors" style={{ color: "var(--text-muted)" }}>
            The Wall
          </Link>
          <Link href="/settings" className="text-sm hover:text-white transition-colors" style={{ color: "var(--text-muted)" }}>
            Settings
          </Link>
          <Link href="/auth/logout" className="text-sm hover:text-white transition-colors" style={{ color: "var(--text-muted)" }}>
            Logout
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden">
          <ExcalidrawWrapper
            excalidrawAPI={onExcalidrawAPI}
          />
        </div>

        {/* Sidebar — scrollable; capped at 50vh on mobile, full height on desktop */}
        <div
          className="w-full lg:w-80 shrink-0 flex flex-col gap-6 p-6 border-t lg:border-t-0 lg:border-l overflow-y-auto max-h-[50vh] lg:max-h-none"
          style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
        >
          <div>
            <h1
              className="text-3xl tracking-wide mb-1"
              style={{ fontFamily: "var(--font-bangers)" }}
            >
              <span className="gradient-text">DRAW YOUR</span>
              <br />
              <span style={{ color: "var(--neon-cyan)" }}>PARTY ANIMAL</span>
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Sketch anything wild. AI animates it into a video that hits the wall — and X.
            </p>
          </div>

          <Separator className="opacity-20" />

          {/* X handle input */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="x-handle" className="text-sm font-semibold tracking-wide" style={{ color: "var(--text-primary)" }}>
              Your X Handle
            </Label>
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold select-none"
                style={{ color: "var(--text-muted)" }}
              >
                @
              </span>
              <Input
                id="x-handle"
                value={xHandle}
                onChange={(e) => {
                  setXHandle(e.target.value.replace(/^@/, ""));
                  if (state.type === "error") setState({ type: "idle" });
                }}
                placeholder="yourhandle"
                className="pl-7"
                style={{
                  background: "var(--bg-dark)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
                disabled={state.type === "submitting"}
              />
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              @PartyAnimalBot will tag you when posted.
            </p>
          </div>

          {/* Tips */}
          <div
            className="rounded-xl p-4 flex flex-col gap-2"
            style={{
              background: "rgba(176,38,255,0.06)",
              border: "1px solid rgba(176,38,255,0.2)",
            }}
          >
            <p
              className="text-xs font-bold tracking-widest uppercase"
              style={{ color: "var(--electric-purple)" }}
            >
              Tips
            </p>
            {[
              "Big shapes = better animation",
              "Bold lines over fine details",
              "Keep it fun — no stick figures… unless that is your thing",
            ].map((tip) => (
              <p key={tip} className="text-xs flex gap-2" style={{ color: "var(--text-muted)" }}>
                <span style={{ color: "var(--electric-purple)" }}>✦</span> {tip}
              </p>
            ))}
          </div>

          {/* Error */}
          {state.type === "error" && (
            <div
              className="rounded-xl p-3 text-sm"
              style={{
                background: "rgba(255,45,120,0.1)",
                border: "1px solid rgba(255,45,120,0.3)",
                color: "var(--hot-pink)",
              }}
            >
              {state.message}
            </div>
          )}

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={state.type === "submitting"}
            className="w-full btn-primary border-0 mt-auto"
            style={{
              background: state.type === "submitting"
                ? "rgba(255,45,120,0.4)"
                : "linear-gradient(135deg, var(--hot-pink), var(--electric-purple))",
            }}
          >
            {state.type === "submitting" ? (
              <>
                <span className="animate-spin mr-2">⟳</span>
                Unleashing…
              </>
            ) : (
              "Unleash Your Animal! 🐾"
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}

function CanvasLoader() {
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: "#1e1e2e" }}
    >
      <p style={{ color: "var(--text-muted)" }}>Loading canvas…</p>
    </div>
  );
}

function SuccessScreen({ xHandle }: { xHandle: string }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center text-center px-6"
      style={{ background: "var(--bg-dark)" }}
    >
      <div className="max-w-lg flex flex-col items-center gap-6">
        <div className="text-8xl animate-bounce">🎉</div>
        <h1
          className="text-6xl tracking-wide leading-none"
          style={{ fontFamily: "var(--font-bangers)" }}
        >
          <span className="gradient-text glow-pink">ANIMAL</span>
          <br />
          <span style={{ color: "var(--neon-cyan)" }}>UNLEASHED!</span>
        </h1>
        <p className="text-lg" style={{ color: "var(--text-muted)" }}>
          Your animal is being animated by Grok AI. Once it is ready, it will
          hit the wall and{" "}
          <span style={{ color: "var(--hot-pink)" }}>@PartyAnimalBot</span> will
          tag <span style={{ color: "var(--neon-cyan)" }}>@{xHandle}</span> on X.
        </p>
        <div
          className="w-full rounded-2xl p-5 text-left flex flex-col gap-3"
          style={{
            background: "rgba(255,215,0,0.06)",
            border: "1px solid rgba(255,215,0,0.2)",
          }}
        >
          <p
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: "var(--gold)" }}
          >
            Collect your reward
          </p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Head to the booth to claim your limited{" "}
            <span style={{ color: "var(--gold)" }}>3D-printed NFC tag</span> —
            X logo on the front, Auth0 on the back. Limited supply!
          </p>
        </div>
        <div className="flex gap-4">
          <Link href="/wall" className="btn-primary">
            See The Wall 🐾
          </Link>
          <Link href="/draw" className="btn-secondary">
            Draw Another
          </Link>
        </div>
      </div>
    </div>
  );
}
