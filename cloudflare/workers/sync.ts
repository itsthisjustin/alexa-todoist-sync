import puppeteer from '@cloudflare/puppeteer';
import type { Env, UserConfig, AmazonSession } from '../shared/types';
import { decrypt, encrypt } from '../shared/crypto';

/**
 * Scrape Amazon shopping list items
 * Returns both items and refreshed cookies
 */
async function scrapeAmazonShoppingList(
  amazonSession: AmazonSession,
  browserBinding: Fetcher
): Promise<{ items: string[], refreshedCookies: any[] }> {
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

    // Get refreshed cookies after successful interaction
    const refreshedCookies = await page.cookies();
    console.log(`Refreshed ${refreshedCookies.length} cookies after successful Amazon access`);

    return { items, refreshedCookies };
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
  syncedItems: { [itemName: string]: { todoistId: string; completedOnAlexa: boolean } }
): Promise<{ [itemName: string]: { todoistId: string; completedOnAlexa: boolean } }> {
  console.log(`Syncing ${items.length} items to Todoist`);

  const updatedSyncedItems = { ...syncedItems };
  let added = 0;

  // Filter for items that need to be synced
  const newItems = items.filter(item => {
    const itemLower = item.toLowerCase();

    // If item doesn't exist in state, it's new
    if (!updatedSyncedItems[itemLower]) return true;

    // If item was completed on Alexa, it's been re-added - treat as new
    if (updatedSyncedItems[itemLower].completedOnAlexa) return true;

    // Otherwise it's already synced and active
    return false;
  });

  if (newItems.length === 0) {
    console.log('No new items to sync');
    return updatedSyncedItems;
  }

  // Add new items to Todoist
  for (const item of newItems) {
    const itemLower = item.toLowerCase();
    const isReAdded = updatedSyncedItems[itemLower]?.completedOnAlexa;

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
      updatedSyncedItems[itemLower] = {
        todoistId: task.id,
        completedOnAlexa: false
      };
      added++;

      if (isReAdded) {
        console.log(`Re-synced (re-added item): ${item} (task ${task.id})`);
      } else {
        console.log(`Added: ${item} (task ${task.id})`);
      }
    } else {
      console.error(`Failed to add: ${item}`);
    }
  }

  console.log(`Sync complete: added ${added} new items`);
  return updatedSyncedItems;
}

/**
 * Mark multiple items as complete on Amazon Alexa shopping list (batched)
 */
export async function markMultipleItemsCompleteOnAlexa(
  itemNames: string[],
  userId: string,
  env: Env
): Promise<void> {
  if (itemNames.length === 0) return;

  console.log(`markMultipleItemsCompleteOnAlexa for ${itemNames.length} items (user: ${userId})`);

  // Get user config
  const configData = await env.USERS.get(`config:${userId}`);
  if (!configData) {
    throw new Error('User config not found');
  }

  const config: UserConfig = JSON.parse(configData);

  if (!config.amazonSession) {
    throw new Error('No Amazon session');
  }

  // Get encrypted Amazon session
  const encryptedSession = await env.SESSIONS.get(`amazon:${userId}`);
  if (!encryptedSession) {
    throw new Error('Amazon session not found');
  }

  // Decrypt session
  const decryptedData = await decrypt(encryptedSession, env.ENCRYPTION_KEY);
  const amazonSession: AmazonSession = JSON.parse(decryptedData);

  // Launch browser once for all items
  const browser = await puppeteer.launch(env.BROWSER);
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

    // Mark each item complete
    const completedItems: string[] = [];
    for (const itemName of itemNames) {
      const result = await page.evaluate((name) => {
        const searchName = name.toLowerCase().trim();

        const selectors = [
          '.item-body .item-title',
          '[data-item-name]',
          '.shopping-list-item .item-name',
          '.a-list-item span[class*="item"]',
        ];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            const text = (element.dataset?.itemName || element.textContent)?.trim() || '';
            const normalizedText = text.toLowerCase();

            if (normalizedText === searchName) {
              let container = element.closest('.shopping-list-item, .item-row, [data-item-id], .item-body, .a-row');
              if (!container) container = element.parentElement;

              const row = element.closest('div.a-row, li, [role="listitem"]') || container;
              if (!row) return { success: false, error: 'No row found' };

              let checkbox = row.querySelector('.custom-control-input, input[type="checkbox"]');
              if (!checkbox && row.previousElementSibling) {
                checkbox = row.previousElementSibling.querySelector('.custom-control-input, input[type="checkbox"]');
              }
              if (!checkbox && row.parentElement) {
                checkbox = row.parentElement.querySelector('.custom-control-input, input[type="checkbox"]');
              }

              if (!checkbox) return { success: false, error: 'No checkbox found' };
              if (checkbox.checked) return { success: false, error: 'Already checked' };

              const label = checkbox.parentElement?.querySelector(`label[for="${checkbox.id}"], .custom-control-label`) ||
                           document.querySelector(`label[for="${checkbox.id}"]`);
              if (label) {
                label.click();
              } else {
                checkbox.click();
              }
              return { success: true };
            }
          }
        }
        return { success: false, error: 'Item not found' };
      }, itemName);

      if (result.success) {
        completedItems.push(itemName);
        console.log(`✓ Marked complete: ${itemName}`);
        // Small delay between clicks
        await page.waitForTimeout(500);
      } else {
        console.log(`✗ Could not mark complete: ${itemName} (${result.error || 'unknown error'})`);
      }
    }

    // Update syncedItems for all completed items
    if (completedItems.length > 0) {
      if (!config.syncedItems) config.syncedItems = {};

      for (const itemName of completedItems) {
        const itemLower = itemName.toLowerCase();
        if (config.syncedItems[itemLower]) {
          config.syncedItems[itemLower].completedOnAlexa = true;
        }
      }

      await env.USERS.put(`config:${userId}`, JSON.stringify(config));
      console.log(`Updated state for ${completedItems.length} items marked as completedOnAlexa`);
    }
  } finally {
    await browser.close();
  }
}

/**
 * Mark item as complete on Amazon Alexa shopping list (wrapper for batched version)
 */
export async function markItemCompleteOnAlexa(
  itemName: string,
  userId: string,
  env: Env
): Promise<void> {
  return markMultipleItemsCompleteOnAlexa([itemName], userId, env);
}

/**
 * Perform Alexa to Todoist sync for a user
 */
export async function performSync(
  userId: string,
  env: Env
): Promise<void> {
  console.log(`Starting alexa-to-todoist sync for user ${userId}`);

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

  // Scrape Amazon and push to Todoist
  const { items, refreshedCookies } = await scrapeAmazonShoppingList(amazonSession, env.BROWSER);

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

  // CRITICAL: Save refreshed cookies to extend session life
  // Amazon refreshes cookies on each request, so we need to save them back
  if (config.amazonSession && refreshedCookies.length > 0) {
    console.log('Updating stored cookies with refreshed session');
    config.amazonSession.cookies = refreshedCookies;
    config.amazonSession.encryptedAt = new Date().toISOString();

    // Re-encrypt and store updated session
    const updatedSession = {
      cookies: refreshedCookies,
      encryptedAt: new Date().toISOString(),
    };
    const encrypted = await encrypt(JSON.stringify(updatedSession), env.ENCRYPTION_KEY);
    await env.SESSIONS.put(`amazon:${userId}`, encrypted);
  }

  await env.USERS.put(`config:${userId}`, JSON.stringify(config));

  console.log(`alexa-to-todoist sync complete for user ${userId}`);
}
