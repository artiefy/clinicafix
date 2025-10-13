import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    OPENAI_API_KEY: z.string(),
    N8N_LICENSE_KEY: z.string(),
    N8N_WEBHOOK_LOCAL: z.string().url(),
    N8N_WEBHOOK_PROD: z.string().url(),
  },
  client: {},
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    N8N_LICENSE_KEY: process.env.N8N_LICENSE_KEY,
    N8N_WEBHOOK_LOCAL: process.env.N8N_WEBHOOK_LOCAL,
    N8N_WEBHOOK_PROD: process.env.N8N_WEBHOOK_PROD,
  },
});
