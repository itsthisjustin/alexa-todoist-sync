import { Context } from 'hono';
import type { Env, User, UserConfig } from '../../shared/types';
import { verifyToken, extractToken } from '../../shared/auth';
import { validateInterval, PRICING_TIERS } from '../../shared/pricing';

/**
 * Update sync intervals
 */
export async function updateIntervals(c: Context<{ Bindings: Env }>) {
  const token = extractToken(c.req.raw);
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { alexaToTodoistInterval } = await c.req.json();

  // Validate interval is a number
  if (typeof alexaToTodoistInterval !== 'number' || alexaToTodoistInterval < 1) {
    return c.json({ error: 'Invalid interval value' }, 400);
  }

  // Get user to check subscription tier
  const userData = await c.env.USERS.get(`user:${payload.userId}`);
  if (!userData) {
    return c.json({ error: 'User not found' }, 404);
  }

  const user: User = JSON.parse(userData);

  // Validate interval against subscription limits
  const validation = validateInterval(alexaToTodoistInterval, user.subscriptionTier);

  if (!validation.valid) {
    return c.json({ error: validation.error }, 403);
  }

  // Update config
  const configData = await c.env.USERS.get(`config:${payload.userId}`);
  if (!configData) {
    return c.json({ error: 'Config not found' }, 404);
  }

  const config: UserConfig = JSON.parse(configData);
  config.alexaToTodoistInterval = alexaToTodoistInterval;

  await c.env.USERS.put(`config:${payload.userId}`, JSON.stringify(config));

  return c.json({
    success: true,
    alexaToTodoistInterval,
  });
}

/**
 * Get pricing tiers
 */
export async function getPricingTiers(c: Context<{ Bindings: Env }>) {
  return c.json({ tiers: PRICING_TIERS });
}
