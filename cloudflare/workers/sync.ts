import puppeteer from '@cloudflare/puppeteer';
import type { Env, UserConfig, AmazonSession } from '../shared/types';
import { decrypt } from '../shared/crypto';

/**
 * Scrape Amazon shopping list items
 */
async function scrapeAmazonShoppingList(
  amazonSession: AmazonSession,
  browserBinding: Fetcher
): Promise<string[]> {
  console.log('Scraping Amazon shopping list');

  const browser = await puppeteer.launch(browserBinding);

  try {
    const page = await browser.newPage();

    // Set user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set cookies
    await page.setCookie(...amazonSession.cookies);

    // Navigate to shopping list
    await page.goto('https://www.amazon.com/alexaquantum/sp/alexaShoppingList', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Check if redirected to login (session expired)
    const url = page.url();
    if (url.includes('/ap/signin') || url.includes('/ap/')) {
      throw new Error('Amazon session expired - please reconnect your Amazon account');
    }

    // Wait for shopping list items
    await page.waitForSelector('.item-body, .shopping-list-container, [data-item-name]', {
      timeout: 10000,
    }).catch(() => {
      console.log('No items found on shopping list');
    });

    // Extract items
    const items = await page.evaluate(() => {
      const selectors = [
        '.item-body .item-title',
        '[data-item-name]',
        '.shopping-list-item .item-name',
        '.a-list-item span[class*="item"]',
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          return Array.from(elements)
            .map((el: any) => {
              return el.dataset?.itemName || el.textContent?.trim() || '';
            })
            .filter((text) => text && text.length > 0);
        }
      }

      return [];
    });

    console.log(`Found ${items.length} items on shopping list`);

    return items;
  } finally {
    await browser.close();
  }
}

/**
 * Sync items to Todoist using local state tracking (like macOS app)
 */
async function syncToTodoist(
  items: string[],
  todoistToken: string,
  todoistProjectId: string,
  syncedItems: { [itemName: string]: string }
): Promise<{ [itemName: string]: string }> {
  console.log(`Syncing ${items.length} items to Todoist`);

  const updatedSyncedItems = { ...syncedItems };
  let added = 0;

  // Add new items that aren't in our synced state
  for (const item of items) {
    const itemLower = item.toLowerCase();

    if (updatedSyncedItems[itemLower]) {
      console.log(`Skipping already synced: ${item}`);
      continue;
    }

    const response = await fetch('https://api.todoist.com/rest/v2/tasks', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${todoistToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: item,
        project_id: todoistProjectId,
      }),
    });

    if (response.ok) {
      const task = await response.json() as { id: string };
      updatedSyncedItems[itemLower] = task.id;
      added++;
      console.log(`Added: ${item} (task ${task.id})`);
    } else {
      console.error(`Failed to add: ${item}`);
    }
  }

  console.log(`Sync complete: added ${added} new items`);
  return updatedSyncedItems;
}

/**
 * Perform sync for a user (either direction)
 */
export async function performSync(
  userId: string,
  env: Env,
  direction: 'alexa-to-todoist' | 'todoist-to-alexa'
): Promise<void> {
  console.log(`Starting ${direction} sync for user ${userId}`);

  // Get user config
  const configData = await env.USERS.get(`config:${userId}`);
  if (!configData) {
    throw new Error('User config not found');
  }

  const config: UserConfig = JSON.parse(configData);

  if (!config.amazonSession || !config.todoist) {
    throw new Error('Missing Amazon or Todoist configuration');
  }

  // Get encrypted Amazon session
  const encryptedSession = await env.SESSIONS.get(`amazon:${userId}`);
  if (!encryptedSession) {
    throw new Error('Amazon session not found');
  }

  // Decrypt session
  const decryptedData = await decrypt(encryptedSession, env.ENCRYPTION_KEY);
  const amazonSession: AmazonSession = JSON.parse(decryptedData);

  if (direction === 'alexa-to-todoist') {
    // Scrape Amazon and push to Todoist
    const items = await scrapeAmazonShoppingList(amazonSession, env.BROWSER);

    if (items.length > 0) {
      // Use local state tracking instead of fetching all Todoist tasks
      const syncedItems = config.syncedItems || {};
      const updatedSyncedItems = await syncToTodoist(
        items,
        config.todoist.apiToken,
        config.todoist.projectId,
        syncedItems
      );
      config.syncedItems = updatedSyncedItems;
    }

    // Update last sync time
    config.lastAlexaToTodoistSync = new Date().toISOString();
  } else {
    // Check Todoist for completed tasks and mark them in Amazon
    // TODO: Implement Todoist → Amazon sync
    // This would involve checking completed tasks in Todoist
    // and removing them from Amazon shopping list via Puppeteer
    console.log('Todoist → Amazon sync not yet implemented');
  }

  await env.USERS.put(`config:${userId}`, JSON.stringify(config));

  console.log(`${direction} sync complete for user ${userId}`);
}
