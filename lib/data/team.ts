import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { businesses, invitations, sessions, users, type Invitation, type UserRole } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import type { AcceptInvitationValues, InviteMemberValues } from "@/lib/validation/team";

/**
 * Team data access: members of a business, their roles, and invitations.
 * Every function takes `businessId` first and scopes all reads and writes to
 * it, so an admin can never touch another business's users.
 */

/** How long an emailed invitation link stays valid. */
export const INVITATION_TTL_DAYS = 7;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashToken(raw), expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000) };
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
  disabledAt: Date | null;
  createdAt: Date;
}

export async function listTeamMembers(businessId: string): Promise<TeamMember[]> {
  return db
    .select({ id: users.id, name: users.name, email: users.email, roles: users.roles, disabledAt: users.disabledAt, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.businessId, businessId))
    .orderBy(asc(users.createdAt));
}

export interface PendingInvitation extends Invitation {
  invitedByName: string | null;
  expired: boolean;
}

/** Open invitations (not accepted, not revoked), newest first; expired ones are included and flagged. */
export async function listPendingInvitations(businessId: string): Promise<PendingInvitation[]> {
  const inviter = alias(users, "inviter");
  const rows = await db
    .select({ invitation: invitations, invitedByName: inviter.name })
    .from(invitations)
    .leftJoin(inviter, eq(inviter.id, invitations.invitedByUserId))
    .where(and(eq(invitations.businessId, businessId), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)))
    .orderBy(desc(invitations.createdAt));
  const now = Date.now();
  return rows.map((r) => ({ ...r.invitation, invitedByName: r.invitedByName, expired: r.invitation.expiresAt.getTime() < now }));
}

export interface CreatedInvitation {
  invitationId: string;
  /** Raw token for the emailed link; never stored. */
  token: string;
  email: string;
  name: string | null;
  roles: UserRole[];
  expiresAt: Date;
}

/**
 * Invites an email address to join the business. Fails when that email
 * already belongs to a user (an account belongs to exactly one business).
 * An earlier open invitation for the same email is replaced.
 */
export async function createInvitation(businessId: string, invitedByUserId: string, values: InviteMemberValues): Promise<CreatedInvitation> {
  const [existingUser] = await db.select({ id: users.id, businessId: users.businessId }).from(users).where(eq(users.email, values.email)).limit(1);
  if (existingUser) {
    throw new Error(
      existingUser.businessId === businessId
        ? "That person is already a member of your team."
        : "An account with this email already exists in another business. Each account belongs to one business.",
    );
  }

  const token = newToken();
  const invitationId = await db.transaction(async (tx) => {
    await tx
      .update(invitations)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(invitations.businessId, businessId), eq(invitations.email, values.email), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)));
    const [row] = await tx
      .insert(invitations)
      .values({
        businessId,
        email: values.email,
        name: values.name ?? null,
        roles: values.roles,
        tokenHash: token.hash,
        invitedByUserId,
        expiresAt: token.expiresAt,
      })
      .returning({ id: invitations.id });
    return row.id;
  });

  return { invitationId, token: token.raw, email: values.email, name: values.name ?? null, roles: values.roles, expiresAt: token.expiresAt };
}

/** Issues a fresh token and expiry for an open invitation (resend / copy link). */
export async function refreshInvitation(businessId: string, invitationId: string): Promise<CreatedInvitation> {
  const token = newToken();
  const [row] = await db
    .update(invitations)
    .set({ tokenHash: token.hash, expiresAt: token.expiresAt, updatedAt: new Date() })
    .where(and(eq(invitations.businessId, businessId), eq(invitations.id, invitationId), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)))
    .returning({ id: invitations.id, email: invitations.email, name: invitations.name, roles: invitations.roles });
  if (!row) throw new Error("Invitation not found or no longer open.");
  return { invitationId: row.id, token: token.raw, email: row.email, name: row.name, roles: row.roles, expiresAt: token.expiresAt };
}

export async function revokeInvitation(businessId: string, invitationId: string): Promise<void> {
  const [row] = await db
    .update(invitations)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(invitations.businessId, businessId), eq(invitations.id, invitationId), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)))
    .returning({ id: invitations.id });
  if (!row) throw new Error("Invitation not found or no longer open.");
}

export interface InvitationPreview {
  id: string;
  email: string;
  name: string | null;
  roles: UserRole[];
  businessName: string;
  invitedByName: string | null;
  expiresAt: Date;
}

/** Looks up an open, unexpired invitation by its raw token, for the accept page. */
export async function getInvitationByToken(rawToken: string): Promise<InvitationPreview | null> {
  const token = rawToken.trim();
  if (!token) return null;
  const inviter = alias(users, "inviter");
  const [row] = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      name: invitations.name,
      roles: invitations.roles,
      expiresAt: invitations.expiresAt,
      businessName: businesses.name,
      invitedByName: inviter.name,
    })
    .from(invitations)
    .innerJoin(businesses, eq(businesses.id, invitations.businessId))
    .leftJoin(inviter, eq(inviter.id, invitations.invitedByUserId))
    .where(and(eq(invitations.tokenHash, hashToken(token)), isNull(invitations.acceptedAt), isNull(invitations.revokedAt), gt(invitations.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

/**
 * Redeems an invitation: creates the user in the inviting business with the
 * invited roles and marks the invitation accepted. The accept is atomic on
 * the invitation row, so one link can never create two accounts. Returns the
 * new user id, or null when the token is unusable.
 */
export async function acceptInvitation(values: AcceptInvitationValues): Promise<string | null> {
  const now = new Date();
  const passwordHash = await hashPassword(values.password);

  return db.transaction(async (tx) => {
    const [inv] = await tx
      .select()
      .from(invitations)
      .where(and(eq(invitations.tokenHash, hashToken(values.token.trim())), isNull(invitations.acceptedAt), isNull(invitations.revokedAt), gt(invitations.expiresAt, now)))
      .for("update")
      .limit(1);
    if (!inv) return null;

    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, inv.email)).limit(1);
    if (existing) throw new Error("An account with this email already exists. Sign in instead.");

    const [user] = await tx
      .insert(users)
      .values({ businessId: inv.businessId, name: values.name, email: inv.email, passwordHash, roles: inv.roles })
      .returning({ id: users.id });
    await tx.update(invitations).set({ acceptedAt: now, acceptedUserId: user.id, updatedAt: now }).where(eq(invitations.id, inv.id));
    return user.id;
  });
}

async function countActiveAdmins(tx: Pick<typeof db, "select">, businessId: string, excludingUserId?: string): Promise<number> {
  const conditions = [eq(users.businessId, businessId), isNull(users.disabledAt), sql`'admin' = any(${users.roles})`];
  if (excludingUserId) conditions.push(ne(users.id, excludingUserId));
  const [row] = await tx
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(users)
    .where(and(...conditions));
  return row?.count ?? 0;
}

/**
 * Changes a member's roles. The business must always keep at least one
 * active admin, so the last admin cannot drop the admin role.
 */
export async function updateMemberRoles(businessId: string, userId: string, roles: UserRole[]): Promise<void> {
  await db.transaction(async (tx) => {
    const [member] = await tx
      .select({ id: users.id, roles: users.roles, disabledAt: users.disabledAt })
      .from(users)
      .where(and(eq(users.businessId, businessId), eq(users.id, userId)))
      .for("update")
      .limit(1);
    if (!member) throw new Error("Member not found.");

    const losesAdmin = member.roles.includes("admin") && !roles.includes("admin") && !member.disabledAt;
    if (losesAdmin && (await countActiveAdmins(tx, businessId, userId)) === 0) {
      throw new Error("Your business needs at least one admin. Make someone else an admin first.");
    }

    await tx.update(users).set({ roles, updatedAt: new Date() }).where(eq(users.id, userId));
  });
}

/**
 * Deactivates or reactivates a member. Deactivating deletes every session the
 * member has, so they are signed out at once. The last active admin cannot be
 * deactivated and nobody can deactivate themselves.
 */
export async function setMemberDisabled(businessId: string, actorUserId: string, userId: string, disabled: boolean): Promise<void> {
  if (disabled && actorUserId === userId) throw new Error("You cannot deactivate your own account.");
  await db.transaction(async (tx) => {
    const [member] = await tx
      .select({ id: users.id, roles: users.roles, disabledAt: users.disabledAt })
      .from(users)
      .where(and(eq(users.businessId, businessId), eq(users.id, userId)))
      .for("update")
      .limit(1);
    if (!member) throw new Error("Member not found.");

    if (disabled && member.roles.includes("admin") && !member.disabledAt && (await countActiveAdmins(tx, businessId, userId)) === 0) {
      throw new Error("Your business needs at least one active admin.");
    }

    await tx
      .update(users)
      .set({ disabledAt: disabled ? (member.disabledAt ?? new Date()) : null, updatedAt: new Date() })
      .where(eq(users.id, userId));
    if (disabled) await tx.delete(sessions).where(eq(sessions.userId, userId));
  });
}
