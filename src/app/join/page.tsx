import type { Metadata } from "next";
import Link from "next/link";
import { JoinRoomForm } from "@/components/room/JoinRoomForm";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Join a room",
};

interface JoinPageProps {
  searchParams: Promise<{ code?: string | string[] }>;
}

export default async function JoinPage({ searchParams }: JoinPageProps) {
  const { code } = await searchParams;
  const initialCode = typeof code === "string" ? code : "";

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900">Join a room</h1>
        <p className="mt-1 text-slate-600">Enter the code your host shared with you.</p>
      </div>
      <Card as="div">
        <JoinRoomForm initialCode={initialCode} />
      </Card>
      <p className="text-center text-sm text-slate-600">
        Want to host instead?{" "}
        <Link href="/create" className="font-semibold text-indigo-700 underline-offset-2 hover:underline">
          Create a room
        </Link>
      </p>
    </div>
  );
}
