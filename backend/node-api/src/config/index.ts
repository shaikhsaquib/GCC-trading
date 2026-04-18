import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema — every env var is declared, typed, and has a sensible default or
// throws at startup if required and missing. Nothing is silently undefined.
// ---------------------------------------------------------------------------

const envSchema = z.object({
  NODE_ENV:    z.enum(['development', 'production', 'test']).default('development'),
  PORT:        z.coerce.number().default(3000),
  API_VERSION: z.string().default('v1'),

  // PostgreSQL
  DATABASE_URL:    z.string().min(1, 'DATABASE_URL is required'),
  DB_POOL_MIN:     z.coerce.number().default(2),
  DB_POOL_MAX:     z.coerce.number().default(20),

  // Redis
  REDIS_URL:           z.string().min(1, 'REDIS_URL is required'),
  REDIS_TTL_SESSION:   z.coerce.number().default(604_800), // 7 days
  REDIS_TTL_OTP:       z.coerce.number().default(300),     // 5 min

  // MongoDB
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  // RabbitMQ
  RABBITMQ_URL: z.string().min(1, 'RABBITMQ_URL is required'),

  // JWT
  JWT_SECRET:              z.string().min(32, 'JWT_SECRET must be ≥32 chars'),
  JWT_REFRESH_SECRET:      z.string().min(32, 'JWT_REFRESH_SECRET must be ≥32 chars'),
  JWT_EXPIRES_IN:          z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN:  z.string().default('7d'),

  // Encryption (AES-256-CBC — 32 hex byte key)
  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes)'),

  // Service-to-service auth
  SERVICE_SECRET: z.string().min(16, 'SERVICE_SECRET is required'),

  // CORS
  ALLOWED_ORIGINS: z.string().default('http://localhost:4200,https://gcc-trading.vercel.app'),

  // .NET service URLs
  DOTNET_TRADING_URL: z.string().url().default('http://localhost:5001'),
  DOTNET_AML_URL:     z.string().url().default('http://localhost:5005'),

  // OAuth (optional — leave empty to disable social login)
  GOOGLE_CLIENT_ID:         z.string().default(''),
  GOOGLE_CLIENT_SECRET:     z.string().default(''),
  MICROSOFT_CLIENT_ID:      z.string().default(''),
  MICROSOFT_CLIENT_SECRET:  z.string().default(''),
  MICROSOFT_TENANT_ID:      z.string().default('common'),

  // Third-party integrations (optional in dev)
  SENDGRID_API_KEY:        z.string().default(''),
  SENDGRID_FROM_EMAIL:     z.string().email().default('noreply@gccbond.com'),
  UNIFONIC_API_KEY:        z.string().default(''),
  UNIFONIC_SENDER_ID:      z.string().default('GCCBond'),
  FCM_SERVER_KEY:          z.string().default(''),
  ONFIDO_API_KEY:          z.string().default(''),
  ONFIDO_WEBHOOK_SECRET:   z.string().default(''),
  HYPERPAY_API_KEY:        z.string().default(''),
  HYPERPAY_ENTITY_ID:      z.string().default(''),
  HYPERPAY_WEBHOOK_SECRET: z.string().default(''),
});

// ---------------------------------------------------------------------------
// Parse once at module load — throws with a clear message if invalid.
// ---------------------------------------------------------------------------

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid environment configuration:\n');
  parsed.error.issues.forEach(issue => {
    console.error(`   ${issue.path.join('.')} — ${issue.message}`);
  });
  process.exit(1);
}

const env = parsed.data;

// ---------------------------------------------------------------------------
// Structured config — consumers import `config`, not `process.env`.
// ---------------------------------------------------------------------------

export const config = {
  env:  env.NODE_ENV,
  port: env.PORT,
  api:  { version: env.API_VERSION },

  database: {
    url:     env.DATABASE_URL,
    poolMin: env.DB_POOL_MIN,
    poolMax: env.DB_POOL_MAX,
  },

  redis: {
    url:        env.REDIS_URL,
    ttl: {
      session: env.REDIS_TTL_SESSION,
      otp:     env.REDIS_TTL_OTP,
    },
  },

  mongodb: { uri: env.MONGODB_URI },

  rabbitmq: { url: env.RABBITMQ_URL },

  jwt: {
    secret:         env.JWT_SECRET,
    refreshSecret:  env.JWT_REFRESH_SECRET,
    expiresIn:      env.JWT_EXPIRES_IN,
    refreshExpires: env.JWT_REFRESH_EXPIRES_IN,
  },

  encryption: { key: env.ENCRYPTION_KEY },

  service: { secret: env.SERVICE_SECRET },

  cors: {
    origins: env.ALLOWED_ORIGINS.split(',').map(o => o.trim()),
  },

  dotnet: {
    tradingUrl: env.DOTNET_TRADING_URL,
    amlUrl:     env.DOTNET_AML_URL,
  },

  sendgrid: {
    apiKey:    env.SENDGRID_API_KEY,
    fromEmail: env.SENDGRID_FROM_EMAIL,
  },

  unifonic: {
    apiKey:   env.UNIFONIC_API_KEY,
    senderId: env.UNIFONIC_SENDER_ID,
  },

  fcm: { serverKey: env.FCM_SERVER_KEY },

  onfido: {
    apiKey:        env.ONFIDO_API_KEY,
    webhookSecret: env.ONFIDO_WEBHOOK_SECRET,
  },

  hyperpay: {
    apiKey:        env.HYPERPAY_API_KEY,
    entityId:      env.HYPERPAY_ENTITY_ID,
    webhookSecret: env.HYPERPAY_WEBHOOK_SECRET,
  },

  google: {
    clientId:     env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  },

  microsoft: {
    clientId:     env.MICROSOFT_CLIENT_ID,
    clientSecret: env.MICROSOFT_CLIENT_SECRET,
    tenantId:     env.MICROSOFT_TENANT_ID,
  },

  isDev:  env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
} as const;

export type Config = typeof config;
