import { Context } from 'hono';
import type { Env, UserConfig } from '../../shared/types';
import { decrypt } from '../../shared/crypto';
import puppeteer from '@cloudflare/puppeteer';

/**
 * Handle Todoist webhook for item completions
 * This eliminates the need for polling Todoist
 */
export async function handleTodoistWebhook(c: Context<{ Bindings: Env }>) {
  try {
    const body = await c.req.json();

    // Todoist webhook signature verification (optional but recommended)
    const signature = c.req.header('x-todoist-hmac-sha256');
    const deliveryId = c.req.header('x-todoist-delivery-id');

    // Log webhook receipt
    console.log(`Todoist webhook received: ${deliveryId}`, {
      eventName: body.event_name,
      hasSignature: !!signature,
    });

    // Event types from Todoist
    const eventName = body.event_name;
    const eventData = body.event_data;

    // Only handle item:completed events
    if (eventName !== 'item:completed') {
      console.log(`Ignoring event type: ${eventName}`);
      return c.json({ received: true });
    }

    // Find the user who owns this project
    const projectId = eventData.project_id;
    const itemId = eventData.id;
    const itemContent = eventData.content;

    // Find user config with this project ID
    const userId = await findUserByProjectId(c.env.USERS, projectId);
    if (!userId) {
      console.log(`No user found for project ${projectId}`);
      return c.json({ received: true });
    }

    // Get user config
    const configData = await c.env.USERS.get(`config:${userId}`);
    if (!configData) {
      return c.json({ error: 'Config not found' }, 404);
    }

    const config: UserConfig = JSON.parse(configData);

    // Skip if not active or missing Amazon session
    if (!config.isActive || !config.amazonSession) {
      console.log(`User ${userId} not active or missing Amazon session`);
      return c.json({ received: true });
    }

    // Delete the completed item from Amazon Alexa shopping list
    await deleteFromAlexaList(itemContent, config, c.env);

    console.log(`Deleted "${itemContent}" from Alexa list for user ${userId}`);

    return c.json({ received: true });
  } catch (error: any) {
    console.error('Todoist webhook error:', error);
    return c.json({ error: error.message }, 500);
  }
}

/**
 * Find user ID by Todoist project ID
 */
async function findUserByProjectId(
  kv: KVNamespace,
  projectId: string
): Promise<string | null> {
  const { keys } = await kv.list({ prefix: 'config:' });

  for (const key of keys) {
    const configData = await kv.get(key.name);
    if (!configData) continue;

    const config: UserConfig = JSON.parse(configData);
    if (config.todoist?.projectId === projectId) {
      return config.userId;
    }
  }

  return null;
}

/**
 * Delete item from Amazon Alexa shopping list
 */
async function deleteFromAlexaList(
  itemName: string,
  config: UserConfig,
  env: Env
): Promise<void> {
  if (!config.amazonSession) {
    throw new Error('No Amazon session');
  }

  // Decrypt session
  const encryptedSession = await env.SESSIONS.get(`amazon:${config.userId}`);
  if (!encryptedSession) {
    throw new Error('Amazon session not found');
  }

  const decryptedData = await decrypt(encryptedSession, env.ENCRYPTION_KEY);
  const amazonSession = JSON.parse(decryptedData);

  // Launch browser and delete the item
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();

    // Set cookies
    await page.setCookie(...amazonSession.cookies);

    // Go to shopping list
    await page.goto('https://www.amazon.com/alexaquantum/sp/alexaShoppingList', {
      waitUntil: 'networkidle0',
    });

    // Find and delete the item
    // This selector targets the item by text content, then finds its delete button
    const deleted = await page.evaluate((itemText) => {
      // Find all list items
      const items = Array.from(document.querySelectorAll('[data-item-name]'));

      for (const item of items) {
        const nameEl = item.querySelector('[data-item-name]');
        if (nameEl && nameEl.textContent?.trim().toLowerCase() === itemText.toLowerCase()) {
          // Find the delete/complete button for this item
          const deleteBtn = item.querySelector('[aria-label*="delete"], [aria-label*="complete"], button[data-action="delete"]');
          if (deleteBtn) {
            (deleteBtn as HTMLElement).click();
            return true;
          }
        }
      }
      return false;
    }, itemName);

    if (deleted) {
      // Wait for the deletion to complete
      await page.waitForTimeout(1000);
      console.log(`Deleted "${itemName}" from Alexa list`);
    } else {
      console.log(`Item "${itemName}" not found in Alexa list (may have been already deleted)`);
    }
  } finally {
    await browser.close();
  }
}

/**
 * Register Todoist webhook for a user
 * Called after Todoist config is saved
 *
 * Note: Webhooks can also be registered manually in Todoist App Console:
 * https://todoist.com/app/settings/integrations
 */
export async function registerTodoistWebhook(
  apiToken: string,
  callbackUrl: string
): Promise<void> {
  // Register webhook using Todoist Sync API v9
  const response = await fetch('https://api.todoist.com/sync/v9/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`,
    },
    body: JSON.stringify({
      commands: [
        {
          type: 'webhook_add',
          temp_id: crypto.randomUUID(),
          args: {
            url: callbackUrl,
            event_name: 'item:completed',
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Webhook registration failed:', error);
    throw new Error(`Failed to register webhook: ${error}`);
  }

  const result = await response.json();
  console.log('Todoist webhook registered:', result);
}
