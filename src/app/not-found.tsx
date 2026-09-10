import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-5xl" aria-hidden="true">
        🧭
      </p>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 text-slate-600">The page you&apos;re looking for doesn&apos;t exist.</p>
      <div className="mt-6">
        <ButtonLink href="/">Back to home</ButtonLink>
      </div>
    </div>
  );
}
