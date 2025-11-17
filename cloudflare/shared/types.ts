export interface Env {
  BROWSER: Fetcher;
  SESSIONS: KVNamespace;
  USERS: KVNamespace;
  SYNC_QUEUE: Queue;
  ENCRYPTION_KEY: string;
  JWT_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  TODOIST_CLIENT_ID: string;
  TODOIST_CLIENT_SECRET: string;
}

export type SubscriptionTier = 'free' | 'fast' | 'faster';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  subscriptionTier: SubscriptionTier;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt: string;
}

export interface AmazonSession {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }>;
  encryptedAt: string;
}

export interface TodoistConfig {
  apiToken: string;
  projectId: string;
}

export interface UserConfig {
  userId: string;
  amazonSession?: AmazonSession;
  todoist?: TodoistConfig;
  // Alexa → Todoist sync interval (polling)
  alexaToTodoistInterval: number; // minutes - poll Amazon (default: 60 for free tier)
  // Todoist → Alexa is instant via webhooks (no interval needed)
  isActive: boolean;
  lastAlexaToTodoistSync?: string;
}

export interface SyncJob {
  userId: string;
  jobType: 'alexa-to-todoist' | 'todoist-to-alexa' | 'amazon-login';
}
