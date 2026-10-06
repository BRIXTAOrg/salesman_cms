// BRIXTA_COMPANY_SWITCH_PROOF_V1
//
// Switching company used to trust "same email address" alone. Anyone can
// sign up a company and put someone else's email on its admin, so that was
// a way into other companies. Now a switch into a company needs that
// company's password once; after that this browser remembers the proof
// (signed, httpOnly, 30 days) so everyday switching stays one click.
import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { JWT_KEY } from "./Reusable-constants";

const COOKIE = "brixta_company_links";
const AUDIENCE = "brixta-company-links";
const MAX_LINKS = 40;
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const key = new TextEncoder().encode(JWT_KEY);

function linkId(schemaName: string, userId: number) {
  return `${schemaName}:${userId}`;
}

async function readLinks(email: string) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE)?.value;
  if (!raw) return [] as string[];

  try {
    const { payload } = await jwtVerify(raw, key, {
      algorithms: ["HS256"],
      audience: AUDIENCE,
    });

    if (
      typeof payload.email !== "string" ||
      payload.email !== email.trim().toLowerCase() ||
      !Array.isArray(payload.links)
    ) {
      return [];
    }

    return (payload.links as unknown[]).filter(
      (item): item is string => typeof item === "string",
    );
  } catch {
    return [];
  }
}

export async function hasCompanyLink(
  email: string,
  schemaName: string,
  userId: number,
) {
  const links = await readLinks(email);
  return links.includes(linkId(schemaName, userId));
}

/** Remember that this browser proved the password for this company login. */
export async function rememberCompanyLink(
  email: string,
  schemaName: string,
  userId: number,
  options: { reset?: boolean } = {},
) {
  const normalized = email.trim().toLowerCase();
  const existing = options.reset ? [] : await readLinks(normalized);
  const id = linkId(schemaName, userId);
  const links = [id, ...existing.filter((item) => item !== id)].slice(
    0,
    MAX_LINKS,
  );

  const token = await new SignJWT({ email: normalized, links })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setAudience(AUDIENCE)
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(key);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function forgetCompanyLinks() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE);
}
