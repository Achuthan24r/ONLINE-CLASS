const { z } = require('zod');
require('dotenv').config();

const envSchema = z.object({
  PORT: z.string().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(10, 'Valid MONGODB_URI is required'),
  SESSION_SECRET: z.string().min(16).default('classorbit-jwt-session-secret-change-in-production-min-32-chars'),
  LIVEKIT_URL: z.string().default('http://127.0.0.1:7880'),
  LIVEKIT_API_KEY: z.string().default('devkey'),
  LIVEKIT_API_SECRET: z.string().default('secret'),
  CLEANUP_TIMEZONE: z.string().default('Asia/Kolkata'),
  STORAGE_WARNING_THRESHOLD_MB: z.coerce.number().default(80),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

module.exports = {
  env: parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
};
