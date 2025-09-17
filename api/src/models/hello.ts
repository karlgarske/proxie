import { z } from 'zod';

export const HelloRequestSchema = z.object({
  name: z.string().min(1).optional(),
});

export type HelloRequest = z.infer<typeof HelloRequestSchema>;

export const HelloResponseSchema = z.object({
  message: z.string(),
});

export type HelloResponse = z.infer<typeof HelloResponseSchema>;

