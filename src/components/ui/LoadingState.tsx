import type { ReactNode } from "react";
import { Spinner } from "./Spinner";

export function LoadingState({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Spinner className="h-8 w-8 text-indigo-600" />
      <p className="text-sm font-medium text-slate-700">{message}</p>
      {children}
    </div>
  );
}
