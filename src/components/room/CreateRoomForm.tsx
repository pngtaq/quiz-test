"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { DEFAULT_SETTINGS, NICKNAME_MAX_LENGTH } from "@shared/constants";
import { ERROR_MESSAGES } from "@shared/errors";
import type { QuizSettings } from "@shared/types";
import { normalizeNickname } from "@shared/validation";
import { QuizSettingsForm } from "@/components/quiz/QuizSettingsForm";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { ApiError, createRoom } from "@/lib/api";
import { saveSession } from "@/lib/session";

export function CreateRoomForm() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [settings, setSettings] = useState<QuizSettings>(DEFAULT_SETTINGS);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const cleanNickname = normalizeNickname(nickname);
    if (!cleanNickname) {
      setNicknameError(ERROR_MESSAGES.INVALID_NICKNAME);
      return;
    }
    setNicknameError(null);
    setSubmitting(true);

    try {
      const result = await createRoom(cleanNickname, settings);
      saveSession(result.roomCode, { playerId: result.playerId, sessionToken: result.sessionToken });
      router.push(`/room/${result.roomCode}`);
    } catch (error) {
      const apiError =
        error instanceof ApiError ? error : new ApiError("INTERNAL_ERROR", ERROR_MESSAGES.INTERNAL_ERROR);
      if (apiError.code === "INVALID_NICKNAME") setNicknameError(apiError.message);
      else setFormError(apiError.message);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Create a room</h1>
        <p className="mt-1 text-slate-600">Set up your quiz, then share the room code with friends.</p>
      </div>

      <Card title="You">
        <Input
          label="Your nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={NICKNAME_MAX_LENGTH}
          autoComplete="nickname"
          placeholder="e.g. Raison"
          hint="You'll be the leader of this room."
          error={nicknameError}
          disabled={submitting}
          required
        />
      </Card>

      <Card title="Quiz settings" description="You can still change these in the lobby before starting.">
        <QuizSettingsForm value={settings} onChange={setSettings} disabled={submitting} />
      </Card>

      {formError && <ErrorMessage title="Couldn't create the room" message={formError} />}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <ButtonLink href="/" variant="ghost" size="lg">
          Cancel
        </ButtonLink>
        <Button type="submit" size="lg" loading={submitting} loadingText="Creating room…">
          Create Room
        </Button>
      </div>
    </form>
  );
}
