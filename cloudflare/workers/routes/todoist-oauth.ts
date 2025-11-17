import { Context } from 'hono';
import type { Env, UserConfig } from '../../shared/types';
import { verifyToken, extractToken } from '../../shared/auth';
import { registerTodoistWebhook } from './todoist-webhook';

/**
 * Initiate Todoist OAuth flow
 * Redirects user to Todoist authorization page
 */
export async function initiateTodoistOAuth(c: Context<{ Bindings: Env }>) {
  const token = extractToken(c.req.raw);
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Generate state parameter for CSRF protection
  const state = crypto.randomUUID();

  // Store state temporarily (expires in 10 minutes)
  await c.env.USERS.put(
    `oauth_state:${state}`,
    payload.userId,
    { expirationTtl: 600 }
  );

  // OAuth callback goes to worker domain (app.alexatodoist.com)
  const redirectUri = 'https://app.alexatodoist.com/api/todoist/callback';

  // Build Todoist OAuth URL
  const authUrl = new URL('https://todoist.com/oauth/authorize');
  authUrl.searchParams.set('client_id', c.env.TODOIST_CLIENT_ID);
  authUrl.searchParams.set('scope', 'data:read_write');
  authUrl.searchParams.set('state', state);

  return c.json({ url: authUrl.toString() });
}

/**
 * Handle Todoist OAuth callback
 * Exchange authorization code for access token
 */
export async function handleTodoistCallback(c: Context<{ Bindings: Env }>) {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  // Handle OAuth errors
  if (error) {
    // Redirect to frontend domain
    return c.redirect(`https://alexatodoist.com/dashboard?error=todoist_${error}`);
  }

  if (!code || !state) {
    return c.redirect(`https://alexatodoist.com/dashboard?error=missing_params`);
  }

  // Verify state to prevent CSRF
  const userId = await c.env.USERS.get(`oauth_state:${state}`);
  if (!userId) {
    return c.redirect(`https://alexatodoist.com/dashboard?error=invalid_state`);
  }

  // Clean up state
  await c.env.USERS.delete(`oauth_state:${state}`);

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://todoist.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: c.env.TODOIST_CLIENT_ID,
        client_secret: c.env.TODOIST_CLIENT_SECRET,
        code: code,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange failed:', error);
      return c.redirect(`https://alexatodoist.com/dashboard?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json() as { access_token: string };
    const accessToken = tokenData.access_token;

    // Store token temporarily until user selects project
    await c.env.USERS.put(
      `todoist_token_pending:${userId}`,
      accessToken,
      { expirationTtl: 3600 } // 1 hour to complete setup
    );

    // Redirect to frontend dashboard with success flag
    return c.redirect(`https://alexatodoist.com/dashboard?todoist_connected=true`);
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return c.redirect(`https://alexatodoist.com/dashboard?error=oauth_failed`);
  }
}

/**
 * Get user's Todoist projects
 * Called after OAuth to let user choose which project to sync
 */
export async function getTodoistProjects(c: Context<{ Bindings: Env }>) {
  const token = extractToken(c.req.raw);
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Get pending Todoist token
  const todoistToken = await c.env.USERS.get(`todoist_token_pending:${payload.userId}`);
  if (!todoistToken) {
    return c.json({ error: 'No pending Todoist authorization. Please reconnect.' }, 400);
  }

  // Fetch projects from Todoist API v1
  const projectsResponse = await fetch('https://api.todoist.com/api/v1/projects', {
    headers: { Authorization: `Bearer ${todoistToken}` },
  });

  if (!projectsResponse.ok) {
    return c.json({ error: 'Failed to fetch projects' }, 500);
  }

  const responseData = await projectsResponse.json();

  // API v1 returns { results: [...], next_cursor: null }
  const projects = responseData.results || [];

  // Log all projects for debugging
  console.log(`Fetched ${projects.length} projects from Todoist API`);
  if (projects.length > 0) {
    console.log(`First project FULL object:`, JSON.stringify(projects[0]));
    console.log(`First project ID format: ${projects[0].id} (type: ${typeof projects[0].id})`);
    console.log('All user projects:', projects.map((p: any) => `${p.name} (${p.id})`).join(', '));
  }

  return c.json({ projects });
}

/**
 * Complete Todoist setup by selecting a project
 * This finalizes the OAuth flow
 */
export async function completeTodoistSetup(c: Context<{ Bindings: Env }>) {
  const token = extractToken(c.req.raw);
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { projectId } = await c.req.json();

  if (!projectId) {
    return c.json({ error: 'Project ID required' }, 400);
  }

  // Get pending Todoist token
  const todoistToken = await c.env.USERS.get(`todoist_token_pending:${payload.userId}`);
  if (!todoistToken) {
    return c.json({ error: 'No pending Todoist authorization. Please reconnect.' }, 400);
  }

  // Project ID comes from API v1 (via getTodoistProjects)
  console.log(`Storing project ID: ${projectId} (type: ${typeof projectId}) for user ${payload.userId}`);

  // Update user config
  const configData = await c.env.USERS.get(`config:${payload.userId}`);
  const config: UserConfig = configData ? JSON.parse(configData) : {
    userId: payload.userId,
    alexaToTodoistInterval: 60,
    isActive: false
  };

  config.todoist = { apiToken: todoistToken, projectId: projectId };

  await c.env.USERS.put(`config:${payload.userId}`, JSON.stringify(config));

  // Clean up pending token
  await c.env.USERS.delete(`todoist_token_pending:${payload.userId}`);

  // Register webhook for instant sync (worker domain)
  try {
    const webhookUrl = 'https://app.alexatodoist.com/api/todoist/webhook';
    await registerTodoistWebhook(todoistToken, webhookUrl);
    console.log(`Registered Todoist webhook for user ${payload.userId}`);
  } catch (error: any) {
    console.error('Failed to register Todoist webhook:', error);
    // Continue anyway - webhook can be registered manually
  }

  return c.json({
    success: true,
    message: 'Todoist connected successfully! Webhooks registered for instant sync.'
  });
}
