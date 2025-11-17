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
    console.log(`Looking for user with project ID: ${projectId}`);
    const userId = await findUserByProjectId(c.env.USERS, projectId);
    if (!userId) {
      console.log(`No user found for project ${projectId}`);
      return c.json({ received: true });
    }
    console.log(`Found user: ${userId}`);

    // Get user config
    const configData = await c.env.USERS.get(`config:${userId}`);
    if (!configData) {
      console.log(`Config not found for user ${userId}`);
      return c.json({ error: 'Config not found' }, 404);
    }

    const config: UserConfig = JSON.parse(configData);
    console.log(`User config loaded, isActive: ${config.isActive}, hasAmazonSession: ${!!config.amazonSession}`);

    // Skip if not active or missing Amazon session
    if (!config.isActive || !config.amazonSession) {
      console.log(`User ${userId} not active or missing Amazon session`);
      return c.json({ received: true });
    }

    // Mark the completed item as complete on Amazon Alexa shopping list
    console.log(`Starting to mark "${itemContent}" complete on Alexa list`);
    await markItemCompleteOnAlexa(itemContent, config, c.env);

    console.log(`Marked "${itemContent}" complete on Alexa list for user ${userId}`);

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

  // Debug: log all stored project IDs for comparison
  const storedProjectIds: Array<{ userId: string, projectId: string | undefined, type: string }> = [];

  for (const key of keys) {
    const configData = await kv.get(key.name);
    if (!configData) continue;

    const config: UserConfig = JSON.parse(configData);

    // Track all project IDs for debugging
    if (config.todoist?.projectId) {
      storedProjectIds.push({
        userId: config.userId,
        projectId: config.todoist.projectId,
        type: typeof config.todoist.projectId
      });
    }

    if (config.todoist?.projectId === projectId) {
      console.log(`✓ Match found! Stored: ${config.todoist.projectId} === Webhook: ${projectId}`);
      return config.userId;
    }
  }

  // If no match, log what we found for debugging
  console.log(`✗ No match for webhook project_id: ${projectId} (type: ${typeof projectId})`);
  console.log(`Stored project IDs:`, storedProjectIds);

  return null;
}

/**
 * Mark item as complete on Amazon Alexa shopping list
 * Uses the same logic as the macOS app - finds the checkbox and clicks it
 */
async function markItemCompleteOnAlexa(
  itemName: string,
  config: UserConfig,
  env: Env
): Promise<void> {
  console.log(`markItemCompleteOnAlexa called for item: "${itemName}"`);

  if (!config.amazonSession) {
    throw new Error('No Amazon session');
  }

  // Decrypt session
  console.log(`Fetching encrypted session for user: ${config.userId}`);
  const encryptedSession = await env.SESSIONS.get(`amazon:${config.userId}`);
  if (!encryptedSession) {
    throw new Error('Amazon session not found');
  }

  console.log(`Decrypting Amazon session`);
  const decryptedData = await decrypt(encryptedSession, env.ENCRYPTION_KEY);
  const amazonSession = JSON.parse(decryptedData);

  // Launch browser and delete the item
  console.log(`Launching browser to delete item`);
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();

    // Set user agent (required for Amazon to serve correct page)
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set cookies
    await page.setCookie(...amazonSession.cookies);

    // Go to shopping list
    console.log(`Navigating to Amazon shopping list`);
    await page.goto('https://www.amazon.com/alexaquantum/sp/alexaShoppingList', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Check if redirected to login (session expired)
    const url = page.url();
    if (url.includes('/ap/signin') || url.includes('/ap/')) {
      throw new Error('Amazon session expired - please reconnect your Amazon account');
    }

    // Wait for shopping list items to load
    await page.waitForSelector('.item-body, .shopping-list-container, [data-item-name]', {
      timeout: 10000,
    }).catch(() => {
      console.log('No items found on shopping list');
    });

    // Find and mark the item complete (exact copy from macOS app)
    console.log(`Searching for item "${itemName}" in shopping list`);
    const result = await page.evaluate((name) => {
      // Normalize the search name (case-insensitive, trimmed)
      const searchName = name.toLowerCase().trim();

      // Try multiple selectors to find the item (same as sync.ts)
      const selectors = [
        '.item-body .item-title',
        '[data-item-name]',
        '.shopping-list-item .item-name',
        '.a-list-item span[class*="item"]',
      ];

      // Debug: list all items found on page
      const allItems = [];
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const text = (element.dataset.itemName || element.textContent).trim();
          if (text && text.length > 0 && text.length < 100) {
            allItems.push(text);
          }
        }
      }

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const text = (element.dataset.itemName || element.textContent).trim();
          const normalizedText = text.toLowerCase();

          // Case-insensitive comparison
          if (normalizedText === searchName) {
            // Find the associated checkbox - try multiple container levels
            let container = element.closest('.shopping-list-item, .item-row, [data-item-id], .item-body, .a-row');

            // If no container, try parent elements
            if (!container) {
              container = element.parentElement;
            }

            // Try to find the entire row by going up more levels
            const row = element.closest('div.a-row, li, [role="listitem"]') || container;

            if (!row) {
              return { success: false, foundItems: allItems, error: 'No row/container found for item' };
            }

            // Try to find checkbox input - search in the row and all siblings
            let checkbox = row.querySelector('.custom-control-input, input[type="checkbox"]');

            // If not found, try looking in previous siblings (checkbox might be before the text)
            if (!checkbox && row.previousElementSibling) {
              checkbox = row.previousElementSibling.querySelector('.custom-control-input, input[type="checkbox"]');
            }

            // Try looking in the entire parent container
            if (!checkbox && row.parentElement) {
              checkbox = row.parentElement.querySelector('.custom-control-input, input[type="checkbox"]');
            }

            if (!checkbox) {
              return { success: false, foundItems: allItems, error: 'No checkbox found in row or siblings' };
            }

            // If checkbox found, click it (or its label)
            if (checkbox.checked) {
              return { success: false, foundItems: allItems, error: 'Checkbox already checked' };
            }

            // Try to click the label for better reliability
            const label = checkbox.parentElement?.querySelector(`label[for="${checkbox.id}"], .custom-control-label`) ||
                         document.querySelector(`label[for="${checkbox.id}"]`);
            if (label) {
              label.click();
              return { success: true, foundItems: allItems };
            } else {
              checkbox.click();
              return { success: true, foundItems: allItems };
            }
          }
        }
      }
      return { success: false, foundItems: allItems };
    }, itemName);

    if (result.success) {
      // Wait for the action to complete
      await page.waitForTimeout(1000);
      console.log(`Successfully marked "${itemName}" complete on Alexa list`);
    } else {
      console.log(`Could not find item to mark complete: ${itemName}`);
      if (result.error) {
        console.log(`Reason: ${result.error}`);
      }
      if (result.foundItems && result.foundItems.length > 0) {
        console.log(`Items found on page: ${result.foundItems.join(', ')}`);
      } else {
        console.log(`No items found on page`);
      }
    }
  } finally {
    console.log(`Closing browser`);
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
