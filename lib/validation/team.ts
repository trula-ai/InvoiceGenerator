import { z } from "zod";

import { USER_ROLES } from "@/lib/auth/permissions";

const rolesList = z.array(z.enum(USER_ROLES)).min(1, "Choose at least one role").transform((roles) => USER_ROLES.filter((r) => roles.includes(r)));

/** Admin invites a colleague by email with one or more roles. */
export const inviteMemberSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  name: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : undefined)),
  roles: rolesList,
});

/** Admin changes a member's roles. */
export const memberRolesSchema = z.object({
  userId: z.uuid(),
  roles: rolesList,
});

/** What the server accepts when an invitation is redeemed. */
export const acceptInvitationSchema = z.object({
  token: z.string().min(1, "This invitation link is missing its token"),
  name: z.string().trim().min(2, "Enter your name").max(120),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

/** Client-side form schema: adds a confirmation field that must match. */
export const acceptInvitationFormSchema = acceptInvitationSchema
  .extend({ confirmPassword: z.string().min(1, "Confirm your password") })
  .refine((v) => v.password === v.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

export type InviteMemberInput = z.input<typeof inviteMemberSchema>;
export type InviteMemberValues = z.output<typeof inviteMemberSchema>;
export type MemberRolesInput = z.input<typeof memberRolesSchema>;
export type MemberRolesValues = z.output<typeof memberRolesSchema>;
export type AcceptInvitationInput = z.input<typeof acceptInvitationSchema>;
export type AcceptInvitationValues = z.output<typeof acceptInvitationSchema>;
export type AcceptInvitationFormInput = z.input<typeof acceptInvitationFormSchema>;
