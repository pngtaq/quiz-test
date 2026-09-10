import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "../../../shared/constants";

/** Uniform float in [0, 1) from the Web Crypto CSPRNG. */
export function secureRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] as number) / 2 ** 32;
}

/** Random integer in [0, max). */
export function randomInt(max: number, random: () => number = secureRandom): number {
  return Math.floor(random() * max);
}

/** Fisher-Yates shuffle returning a new array. */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

export function generateRoomCode(random: () => number = secureRandom): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length, random)];
  }
  return code;
}

export function generateId(): string {
  return crypto.randomUUID();
}

/** 256-bit base64url token (43 chars). */
export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
