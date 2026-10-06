import { z } from "zod";

export const registerSchema = z.object({
  businessName: z.string().trim().min(2, "Enter your business name").max(200),
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password"),
  /** Cloudflare Turnstile response; required by the server only when Turnstile is configured. */
  turnstileToken: z.string().max(4096).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
});

/** What the server action accepts: the raw token from the emailed link plus the new password. */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "This reset link is missing its token"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

/** Client-side form schema: adds a confirmation field that must match. */
export const resetPasswordFormSchema = resetPasswordSchema
  .extend({ confirmPassword: z.string().min(1, "Confirm your new password") })
  .refine((v) => v.password === v.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ResetPasswordFormInput = z.infer<typeof resetPasswordFormSchema>;
