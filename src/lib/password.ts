// BRIXTA_PASSWORD_SECURITY_V1
//
// One place for dashboard passwords:
//   - new passwords are always stored as bcrypt hashes
//   - old plaintext values keep working and are upgraded on the next
//     successful login (no one gets locked out by this change)
//   - generated passwords use crypto randomness and are easy to type
import "server-only";

import {
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import bcrypt from "bcryptjs";

export const PASSWORD_MIN_LENGTH = 8;

const BCRYPT_ROUNDS = 12;
const BCRYPT_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

// A real hash of a random value, used to spend the same time on
// "unknown user" as on "wrong password". Built once per server process.
let dummyHash: Promise<string> | null = null;
function getDummyHash() {
  dummyHash ??= bcrypt.hash(randomBytes(18).toString("base64"), BCRYPT_ROUNDS);
  return dummyHash;
}

export function isPasswordHash(value: string | null | undefined) {
  return typeof value === "string" && BCRYPT_PATTERN.test(value);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

function plaintextEquals(stored: string, candidate: string) {
  const a = Buffer.from(stored, "utf8");
  const b = Buffer.from(candidate, "utf8");
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Checks a password against what is stored for the user.
 * `needsUpgrade` is true when the stored value is a legacy plaintext
 * password that matched -- the caller should save `hashPassword(...)`.
 */
export async function verifyStoredPassword(
  stored: string | null | undefined,
  candidate: string,
): Promise<{ ok: boolean; needsUpgrade: boolean }> {
  if (!stored || !candidate) {
    await burnPasswordCheck(candidate);
    return { ok: false, needsUpgrade: false };
  }

  if (isPasswordHash(stored)) {
    const ok = await bcrypt.compare(candidate, stored).catch(() => false);
    return { ok, needsUpgrade: false };
  }

  await burnPasswordCheck(candidate);
  const ok = plaintextEquals(stored, candidate);
  return { ok, needsUpgrade: ok };
}

/** Spend bcrypt time without a user, so timing does not reveal accounts. */
export async function burnPasswordCheck(candidate: string) {
  const hash = await getDummyHash();
  await bcrypt.compare(candidate || "x", hash).catch(() => false);
}

// No 0/o, 1/l/i -- easy to read out loud and type on a phone.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** e.g. "k7mq-x3vr-9tbn" (~59 bits of randomness). */
export function generatePassword(groups = 3, groupLength = 4) {
  const parts: string[] = [];
  for (let g = 0; g < groups; g += 1) {
    let part = "";
    for (let i = 0; i < groupLength; i += 1) {
      part += ALPHABET[randomInt(ALPHABET.length)];
    }
    parts.push(part);
  }
  return parts.join("-");
}

export function passwordProblem(password: unknown) {
  const value = typeof password === "string" ? password : "";
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (value.length > 200) {
    return "Password is too long.";
  }
  return null;
}

/** Remove every credential column before a user row leaves the server. */
export function withoutSecrets<T extends Record<string, unknown>>(
  row: T | null | undefined,
) {
  if (!row) return null;
  const copy: Record<string, unknown> = { ...row };
  delete copy.dashboardHashedPassword;
  delete copy.salesAppPasswordHash;
  delete copy.salesAppPassword;
  return copy as Omit<
    T,
    "dashboardHashedPassword" | "salesAppPasswordHash" | "salesAppPassword"
  >;
}
