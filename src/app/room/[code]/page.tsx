import type { Metadata } from "next";
import { normalizeRoomCode } from "@shared/validation";
import { RoomClient } from "@/components/room/RoomClient";

interface RoomPageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: RoomPageProps): Promise<Metadata> {
  const { code } = await params;
  return { title: `Room ${normalizeRoomCode(code).slice(0, 5)}` };
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { code } = await params;
  return <RoomClient code={code} />;
}
