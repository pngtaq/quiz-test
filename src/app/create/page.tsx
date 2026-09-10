import type { Metadata } from "next";
import { CreateRoomForm } from "@/components/room/CreateRoomForm";

export const metadata: Metadata = {
  title: "Create a room",
};

export default function CreatePage() {
  return <CreateRoomForm />;
}
