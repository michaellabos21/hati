import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.'));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Tell us what to call you.')
    .max(60, 'Keep it under 60 characters.'),
  email,
  password: z.string().min(8, 'Use at least 8 characters.').max(72, 'Use at most 72 characters.'),
});
export type SignupValues = z.infer<typeof signupSchema>;

// Same rule as the database: 09XXXXXXXXX or +639XXXXXXXXX. Blank means "not set".
const mobile = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .refine((value) => value === '' || /^(09|\+639)\d{9}$/.test(value), {
    message: 'Use the format 09XXXXXXXXX.',
  });

export const profileFormSchema = z.object({
  displayName: signupSchema.shape.displayName,
  gcashNumber: mobile,
  mayaNumber: mobile,
});
export type ProfileValues = z.infer<typeof profileFormSchema>;

export const newPasswordSchema = z
  .object({
    password: signupSchema.shape.password,
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    path: ['confirm'],
    message: 'The two passwords do not match.',
  });
export type NewPasswordValues = z.infer<typeof newPasswordSchema>;

export const emailSchema = z.object({ email });
export type EmailValues = z.infer<typeof emailSchema>;
