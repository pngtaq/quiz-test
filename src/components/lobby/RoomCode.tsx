"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type CopyStatus = "idle" | "code" | "link" | "failed";

export function RoomCode({ code }: { code: string }) {
  const [status, setStatus] = useState<CopyStatus>("idle");

  useEffect(() => {
    if (status === "idle") return;
    const id = window.setTimeout(() => setStatus("idle"), 2_500);
    return () => window.clearTimeout(id);
  }, [status]);

  const copy = async (kind: "code" | "link") => {
    const text = kind === "code" ? code : `${window.location.origin}/join?code=${code}`;
    try {
      await navigator.clipboard.writeText(text);
      setStatus(kind);
    } catch {
      setStatus("failed");
    }
  };

  return (
    <div className="text-center">
      <p id="room-code-label" className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        Room code
      </p>
      <p
        aria-labelledby="room-code-label"
        className="mt-1 select-all font-mono text-5xl font-extrabold tracking-[0.2em] text-slate-900 sm:text-6xl"
      >
        {code}
      </p>
      <p className="mt-2 text-sm text-slate-600">Share this code with your friends</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => copy("code")}>
          {status === "code" ? "✓ Copied!" : "Copy code"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => copy("link")}>
          {status === "link" ? "✓ Link copied!" : "Copy invite link"}
        </Button>
      </div>
      <p aria-live="polite" className={status === "failed" ? "mt-2 text-sm text-red-700" : "sr-only"}>
        {status === "failed"
          ? "Couldn't access the clipboard. Select the code above to copy it."
          : status === "idle"
            ? ""
            : "Copied to clipboard"}
      </p>
    </div>
  );
}
