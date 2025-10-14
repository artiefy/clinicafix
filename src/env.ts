import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string(),
  OPENAI_API_KEY: z.string(),
  N8N_LICENSE_KEY: z.string(),
  // Webhook URLs are optional in deploy environments (e.g. Vercel) where they may be
  // provided via project secrets. Make them optional so build doesn't fail.
  N8N_SYO_WEBHOOK_LOCAL: z.string().optional(),
  N8N_SYO_WEBHOOK_PROD: z.string().optional(),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  N8N_LICENSE_KEY: process.env.N8N_LICENSE_KEY,
  // keep undefined when not provided so optional schema passes
  N8N_SYO_WEBHOOK_LOCAL: process.env.N8N_SYO_WEBHOOK_LOCAL ?? undefined,
  N8N_SYO_WEBHOOK_PROD: process.env.N8N_SYO_WEBHOOK_PROD ?? undefined,
});
