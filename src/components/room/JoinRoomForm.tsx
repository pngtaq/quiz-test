"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { NICKNAME_MAX_LENGTH, ROOM_CODE_LENGTH } from "@shared/constants";
import { ERROR_MESSAGES } from "@shared/errors";
import { isValidRoomCode, normalizeNickname, normalizeRoomCode } from "@shared/validation";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { ApiError, joinRoom } from "@/lib/api";
import { loadSession, saveSession } from "@/lib/session";

interface JoinRoomFormProps {
  initialCode?: string;
  /** Code comes from the URL and can't be edited (room page). */
  lockCode?: boolean;
  notice?: string | null;
  /** When provided, called instead of navigating to the room page. */
  onJoined?: (roomCode: string) => void;
}

interface FieldErrors {
  code?: string;
  nickname?: string;
  form?: string;
}

const cleanCode = (value: string) => normalizeRoomCode(value).slice(0, ROOM_CODE_LENGTH);

export function JoinRoomForm({ initialCode = "", lockCode = false, notice, onJoined }: JoinRoomFormProps) {
  const router = useRouter();
  const [code, setCode] = useState(() => cleanCode(initialCode));
  const [nickname, setNickname] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const goToRoom = (roomCode: string) => {
    if (onJoined) onJoined(roomCode);
    else router.push(`/room/${roomCode}`);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const roomCode = normalizeRoomCode(code);
    const cleanNickname = normalizeNickname(nickname);

    const validation: FieldErrors = {};
    if (!isValidRoomCode(roomCode)) validation.code = ERROR_MESSAGES.INVALID_ROOM_CODE;
    if (!cleanNickname) validation.nickname = ERROR_MESSAGES.INVALID_NICKNAME;
    setErrors(validation);
    if (validation.code || !cleanNickname) return;

    // Already joined this room in this tab: resume instead of creating a second player.
    if (loadSession(roomCode)) {
      goToRoom(roomCode);
      return;
    }

    setSubmitting(true);
    try {
      const result = await joinRoom(roomCode, cleanNickname);
      saveSession(result.roomCode, { playerId: result.playerId, sessionToken: result.sessionToken });
      goToRoom(result.roomCode);
    } catch (error) {
      const apiError =
        error instanceof ApiError ? error : new ApiError("INTERNAL_ERROR", ERROR_MESSAGES.INTERNAL_ERROR);
      switch (apiError.code) {
        case "ROOM_NOT_FOUND":
        case "INVALID_ROOM_CODE":
          setErrors({ code: apiError.message });
          break;
        case "NICKNAME_TAKEN":
        case "INVALID_NICKNAME":
          setErrors({ nickname: apiError.message });
          break;
        default:
          setErrors({ form: apiError.message });
      }
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {notice && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {notice}
        </p>
      )}
      <Input
        label="Room code"
        inputSize="code"
        value={code}
        onChange={(e) => setCode(cleanCode(e.target.value))}
        readOnly={lockCode}
        placeholder="AB7KQ"
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        error={errors.code}
        disabled={submitting}
        required
      />
      <Input
        label="Nickname"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        maxLength={NICKNAME_MAX_LENGTH}
        autoComplete="nickname"
        placeholder="e.g. John"
        error={errors.nickname}
        disabled={submitting}
        required
      />
      {errors.form && <ErrorMessage message={errors.form} />}
      <Button type="submit" size="lg" fullWidth loading={submitting} loadingText="Joining…">
        Join Room
      </Button>
    </form>
  );
}
