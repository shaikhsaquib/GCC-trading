import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character');

export const registerSchema = z.object({
  email:       z.string().email('Invalid email address'),
  password:    passwordSchema,
  firstName:   z.string().min(2).max(50),
  lastName:    z.string().min(2).max(50),
  phone:       z.string().regex(/^\+[1-9]\d{7,14}$/, 'Phone must be E.164 format, e.g. +971501234567'),
  nationality: z.string().length(2, 'Nationality must be ISO 3166-1 alpha-2'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  currency:    z.enum(['AED', 'SAR', 'KWD', 'QAR', 'OMR', 'BHD', 'USD']).default('AED'),
});

export const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

export const verify2FASchema = z.object({
  tempToken: z.string().min(1),
  totpCode:  z.string().length(6, 'TOTP code must be 6 digits').regex(/^\d+$/),
});

export const enable2FASchema = z.object({
  totpCode: z.string().length(6).regex(/^\d+$/),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const resetRequestSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token:       z.string().min(1),
  newPassword: passwordSchema,
});
