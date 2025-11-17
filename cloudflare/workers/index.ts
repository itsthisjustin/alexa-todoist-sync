import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, User, UserConfig, SyncJob } from '../shared/types';
import { hashPassword, verifyPassword, encrypt, decrypt } from '../shared/crypto';
import { createToken, verifyToken, extractToken } from '../shared/auth';
import { loginToAmazon } from './amazon-login';
import { performSync } from './sync';
import { validateInterval, getDefaultInterval, PRICING_TIERS } from '../shared/pricing';
import { updateIntervals, getPricingTiers } from './routes/intervals';
import { createCheckoutSession, handleStripeWebhook, cancelSubscription } from './routes/stripe';
import { handleTodoistWebhook, registerTodoistWebhook } from './routes/todoist-webhook';
import { initiateTodoistOAuth, handleTodoistCallback, getTodoistProjects, completeTodoistSetup } from './routes/todoist-oauth';

const app = new Hono<{ Bindings: Env }>();

// CORS middleware - allow requests from frontend domain
app.use('/*', cors({
  origin: ['https://alexatodoist.com', 'https://www.alexatodoist.com'],
  credentials: true,
}));

// Health check (keep for monitoring)
app.get('/api/health', (c) => c.json({ status: 'ok' }));

// ==================== AUTH ROUTES ====================

/**
 * Sign up
 */
app.post('/api/auth/signup', async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password || password.length < 8) {
      return c.json({ error: 'Invalid email or password' }, 400);
    }

    // Check if user exists
    const existingUser = await c.env.USERS.get(`email:${email}`);
    if (existingUser) {
      return c.json({ error: 'User already exists' }, 400);
    }

    // Create user
    const userId = crypto.randomUUID();
    const user: User = {
      id: userId,
      email,
      passwordHash: await hashPassword(password),
      subscriptionTier: 'free',
      createdAt: new Date().toISOString(),
    };

    // Store user
    await c.env.USERS.put(`user:${userId}`, JSON.stringify(user));
    await c.env.USERS.put(`email:${email}`, userId);

    // Create initial config with free tier defaults
    const defaultInterval = getDefaultInterval('free');
    const config: UserConfig = {
      userId,
      alexaToTodoistInterval: defaultInterval,
      isActive: false,
    };
    await c.env.USERS.put(`config:${userId}`, JSON.stringify(config));

    // Create token
    const token = await createToken(user, c.env.JWT_SECRET);

    return c.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error('Signup error:', error);
    return c.json({ error: 'Signup failed' }, 500);
  }
});

/**
 * Login
 */
app.post('/api/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    // Get user
    const userId = await c.env.USERS.get(`email:${email}`);
    if (!userId) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const userData = await c.env.USERS.get(`user:${userId}`);
    if (!userData) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const user: User = JSON.parse(userData);

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Create token
    const token = await createToken(user, c.env.JWT_SECRET);

    return c.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Login failed' }, 500);
  }
});

// ==================== CONFIG ROUTES ====================

/**
 * Get user config
 */
app.get('/api/config', async (c) => {
  const token = extractToken(c.req.raw);
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const configData = await c.env.USERS.get(`config:${payload.userId}`);
  if (!configData) {
    return c.json({ error: 'Config not found' }, 404);
  }

  const config: UserConfig = JSON.parse(configData);

  // Get user for subscription tier
  const userData = await c.env.USERS.get(`user:${payload.userId}`);
  const user: User = userData ? JSON.parse(userData) : null;

  // Don't send sensitive data
  return c.json({
    userId: config.userId,
    hasAmazonSession: !!config.amazonSession,
    hasTodoist: !!config.todoist,
    alexaToTodoistInterval: config.alexaToTodoistInterval,
    isActive: config.isActive,
    lastAlexaToTodoistSync: config.lastAlexaToTodoistSync,
    subscriptionTier: user?.subscriptionTier || 'free',
  });
});

/**
 * Todoist OAuth - Initiate flow
 */
app.get('/api/todoist/connect', initiateTodoistOAuth);

/**
 * Todoist OAuth - Callback
 */
app.get('/api/todoist/callback', handleTodoistCallback);

/**
 * Get Todoist projects (for project selection after OAuth)
 */
app.get('/api/todoist/projects', getTodoistProjects);

/**
 * Complete Todoist setup (select project)
 */
app.post('/api/todoist/complete', completeTodoistSetup);

/**
 * Connect Amazon - login and save session
 */
app.post('/api/config/amazon', async (c) => {
  const token = extractToken(c.req.raw);
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { email, password, tfaCode } = await c.req.json();

  try {
    // Login to Amazon and get session cookies
    const cookies = await loginToAmazon(email, password, c.env.BROWSER, tfaCode);

    // Encrypt and store session
    const amazonSession = {
      cookies,
      encryptedAt: new Date().toISOString(),
    };

    const encrypted = await encrypt(JSON.stringify(amazonSession), c.env.ENCRYPTION_KEY);
    await c.env.SESSIONS.put(`amazon:${payload.userId}`, encrypted);

    // Update config
    const configData = await c.env.USERS.get(`config:${payload.userId}`);
    const config: UserConfig = configData ? JSON.parse(configData) : {
      userId: payload.userId,
      alexaToTodoistInterval: 60,
      isActive: false
    };

    config.amazonSession = amazonSession;
    config.isActive = true; // Activate syncing once both are configured

    await c.env.USERS.put(`config:${payload.userId}`, JSON.stringify(config));

    // Enqueue first Alexa → Todoist sync
    // Todoist → Alexa is handled via webhooks (instant)
    if (config.todoist) {
      await c.env.SYNC_QUEUE.send({ userId: payload.userId, jobType: 'alexa-to-todoist' } as SyncJob);
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Amazon login error:', error);

    // Special handling for 2FA required
    if (error.message === '2FA_REQUIRED') {
      return c.json({ needs2FA: true, message: 'Two-factor authentication code required' }, 200);
    }

    return c.json({ error: error.message || 'Failed to login to Amazon' }, 500);
  }
});

/**
 * Disconnect Todoist
 */
app.delete('/api/config/todoist', async (c) => {
  const token = extractToken(c.req.raw);
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const configData = await c.env.USERS.get(`config:${payload.userId}`);
    if (!configData) {
      return c.json({ error: 'Config not found' }, 404);
    }

    const config: UserConfig = JSON.parse(configData);

    // Remove Todoist configuration
    delete config.todoist;

    // If no Amazon session either, mark as inactive
    if (!config.amazonSession) {
      config.isActive = false;
    }

    await c.env.USERS.put(`config:${payload.userId}`, JSON.stringify(config));

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Todoist disconnect error:', error);
    return c.json({ error: 'Failed to disconnect Todoist' }, 500);
  }
});

/**
 * Disconnect Amazon
 */
app.delete('/api/config/amazon', async (c) => {
  const token = extractToken(c.req.raw);
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const configData = await c.env.USERS.get(`config:${payload.userId}`);
    if (!configData) {
      return c.json({ error: 'Config not found' }, 404);
    }

    const config: UserConfig = JSON.parse(configData);

    // Remove Amazon session from config
    delete config.amazonSession;

    // Delete encrypted session from SESSIONS KV
    await c.env.SESSIONS.delete(`amazon:${payload.userId}`);

    // If no Todoist either, mark as inactive
    if (!config.todoist) {
      config.isActive = false;
    }

    await c.env.USERS.put(`config:${payload.userId}`, JSON.stringify(config));

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Amazon disconnect error:', error);
    return c.json({ error: 'Failed to disconnect Amazon' }, 500);
  }
});

/**
 * Delete Account
 * Permanently deletes user account and all associated data
 */
app.delete('/api/account', async (c) => {
  const token = extractToken(c.req.raw);
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // Get user email before deleting
    const userData = await c.env.USERS.get(`user:${payload.userId}`);
    if (!userData) {
      return c.json({ error: 'User not found' }, 404);
    }

    const user: User = JSON.parse(userData);

    // Cancel Stripe subscription if active
    if (user.stripeSubscriptionId) {
      try {
        await fetch(`https://api.stripe.com/v1/subscriptions/${user.stripeSubscriptionId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY}`,
          },
        });
        console.log(`Cancelled Stripe subscription for user ${payload.userId}`);
      } catch (stripeError) {
        console.error('Failed to cancel Stripe subscription:', stripeError);
        // Continue with account deletion even if Stripe cancellation fails
      }
    }

    // Delete all user data
    await Promise.all([
      // Delete user record
      c.env.USERS.delete(`user:${payload.userId}`),
      // Delete email mapping
      c.env.USERS.delete(`email:${user.email}`),
      // Delete config
      c.env.USERS.delete(`config:${payload.userId}`),
      // Delete Amazon session
      c.env.SESSIONS.delete(`amazon:${payload.userId}`),
    ]);

    console.log(`Deleted account for user ${payload.userId} (${user.email})`);

    return c.json({ success: true, message: 'Account deleted successfully' });
  } catch (error: any) {
    console.error('Account deletion error:', error);
    return c.json({ error: 'Failed to delete account' }, 500);
  }
});

/**
 * Manual Sync - Trigger immediate sync
 */
app.post('/api/sync/manual', async (c) => {
  const token = extractToken(c.req.raw);
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const configData = await c.env.USERS.get(`config:${payload.userId}`);
    if (!configData) {
      return c.json({ error: 'Config not found' }, 404);
    }

    const config: UserConfig = JSON.parse(configData);

    // Check if user has both services connected
    if (!config.amazonSession) {
      return c.json({ error: 'Amazon not connected' }, 400);
    }

    if (!config.todoist) {
      return c.json({ error: 'Todoist not connected' }, 400);
    }

    if (!config.isActive) {
      return c.json({ error: 'Sync is not active. Please connect both Amazon and Todoist.' }, 400);
    }

    // Check if a sync is already in progress to prevent spam
    const syncInProgress = await c.env.USERS.get(`sync_in_progress:${payload.userId}`);
    if (syncInProgress) {
      return c.json({ error: 'A sync is already in progress. Please wait.' }, 429);
    }

    // Mark sync as in progress (2 minute expiry)
    await c.env.USERS.put(`sync_in_progress:${payload.userId}`, 'true', { expirationTtl: 120 });

    // Enqueue immediate Alexa → Todoist sync
    await c.env.SYNC_QUEUE.send({
      userId: payload.userId,
      jobType: 'alexa-to-todoist',
    } as SyncJob);

    console.log(`Manual sync triggered for user ${payload.userId}`);

    return c.json({ success: true, message: 'Sync started. This may take 30-60 seconds.' });
  } catch (error: any) {
    console.error('Manual sync error:', error);
    return c.json({ error: 'Failed to start sync' }, 500);
  }
});

// ==================== INTERVALS & PRICING ====================

/**
 * Update sync intervals
 */
app.post('/api/config/intervals', updateIntervals);

/**
 * Get pricing tiers
 */
app.get('/api/pricing', getPricingTiers);

// ==================== STRIPE ====================

/**
 * Create Stripe Checkout Session
 */
app.post('/api/stripe/checkout', createCheckoutSession);

/**
 * Stripe webhook handler
 */
app.post('/api/stripe/webhook', handleStripeWebhook);

/**
 * Cancel Stripe subscription
 */
app.post('/api/stripe/cancel', cancelSubscription);

// ==================== TODOIST WEBHOOK ====================

/**
 * Todoist webhook handler for instant sync
 */
app.post('/api/todoist/webhook', handleTodoistWebhook);

// ==================== CRON TRIGGER ====================

export default {
  // HTTP requests
  fetch: app.fetch,

  // Cron trigger - enqueue sync jobs for active users
  // Note: Only handles Alexa → Todoist polling
  // Todoist → Alexa is instant via webhooks
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log('Running scheduled sync enqueuer');

    // List all config keys
    const { keys } = await env.USERS.list({ prefix: 'config:' });

    const now = Date.now();

    for (const key of keys) {
      const configData = await env.USERS.get(key.name);
      if (!configData) continue;

      const config: UserConfig = JSON.parse(configData);

      // Skip if not active or missing required config
      if (!config.isActive || !config.amazonSession || !config.todoist) {
        continue;
      }

      // Check Alexa → Todoist sync
      const lastAlexaSync = config.lastAlexaToTodoistSync
        ? new Date(config.lastAlexaToTodoistSync).getTime()
        : 0;
      const alexaIntervalMs = config.alexaToTodoistInterval * 60 * 1000;

      if (now - lastAlexaSync >= alexaIntervalMs) {
        await env.SYNC_QUEUE.send({
          userId: config.userId,
          jobType: 'alexa-to-todoist',
        } as SyncJob);
        console.log(`Enqueued Alexa→Todoist sync for user ${config.userId}`);
      }
    }
  },

  // Queue consumer
  async queue(batch: MessageBatch<SyncJob>, env: Env, ctx: ExecutionContext) {
    for (const message of batch.messages) {
      const { userId, jobType } = message.body;

      try {
        console.log(`Processing ${jobType} job for user ${userId}`);

        if (jobType === 'alexa-to-todoist') {
          await performSync(userId, env, 'alexa-to-todoist');
        } else if (jobType === 'todoist-to-alexa') {
          await performSync(userId, env, 'todoist-to-alexa');
        }

        message.ack();
      } catch (error) {
        console.error('Queue processing error:', error);
        message.retry();
      } finally {
        // Clear sync lock when job completes (success or failure)
        await env.USERS.delete(`sync_in_progress:${userId}`);
      }
    }
  },
};
