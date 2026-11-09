import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

type ClerkEmail = {
  id: string;
  email_address: string;
  verification?: { status?: string } | null;
};

type ClerkUser = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  primary_email_address_id?: string | null;
  email_addresses?: ClerkEmail[];
};

export type AppUser = typeof usersTable.$inferSelect;

export class ApiAuthError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiAuthError";
  }
}

const profileCache = new Map<
  string,
  { profile: ClerkUser; expiresAt: number }
>();

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!getAuth(req).userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  next();
}

export async function getAppUser(req: Request): Promise<AppUser> {
  const userId = getAuth(req).userId;
  if (!userId) {
    throw new ApiAuthError("Sign in to continue.", 401);
  }

  const profile = await fetchClerkUser(userId);
  const email = profile.email_addresses?.find(
    (entry) => entry.id === profile.primary_email_address_id,
  );
  if (!email || email.verification?.status !== "verified") {
    throw new ApiAuthError(
      "A verified email address is required to continue.",
      403,
    );
  }

  const name =
    [profile.first_name, profile.last_name]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(" ")
      .trim() ||
    profile.username?.trim() ||
    email.email_address.split("@")[0] ||
    "AdReach member";

  const adminEmails = new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((address) => address.trim().toLowerCase())
      .filter(Boolean),
  );
  const role = adminEmails.has(email.email_address.toLowerCase())
    ? "admin"
    : "customer";

  const [user] = await db
    .insert(usersTable)
    .values({ id: userId, name, email: email.email_address, role })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: { name, email: email.email_address, role, updatedAt: new Date() },
    })
    .returning();

  return user;
}

export function respondWithApiError(
  req: Request,
  res: Response,
  error: unknown,
): void {
  if (error instanceof ApiAuthError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  req.log.error({ err: error }, "AdReach API request failed");
  res.status(500).json({ error: "The request could not be completed." });
}

async function fetchClerkUser(userId: string): Promise<ClerkUser> {
  const cached = profileCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.profile;
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new ApiAuthError("Authentication is not configured.", 503);
  }

  const response = await fetch(
    `https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    if (response.status === 404) {
      throw new ApiAuthError("The signed-in account was not found.", 401);
    }
    throw new ApiAuthError("Could not verify the signed-in account.", 503);
  }

  const profile = (await response.json()) as ClerkUser;
  profileCache.set(userId, { profile, expiresAt: Date.now() + 30_000 });
  return profile;
}

export async function findAppUserById(userId: string): Promise<AppUser | null> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  return user ?? null;
}
