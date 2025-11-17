#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// Load configuration
let config;
try {
  config = require('./config.json');
} catch (error) {
  console.error('❌ Error: config.json not found. Please copy config.json.template and fill in your credentials.');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const STATE_FILE = path.join(__dirname, config.options.stateFile);
const COOKIES_FILE = path.join(__dirname, 'cookies.json');

// Logging with timestamps
function log(message, emoji = 'ℹ️') {
  const timestamp = new Date().toLocaleString();
  console.log(`[${timestamp}] ${emoji} ${message}`);
}

// Load state from file
async function loadState() {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { syncedItems: {}, lastSync: null };
  }
}

// Save state to file
async function saveState(state) {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

// Load cookies for persistent session
async function loadCookies() {
  try {
    const data = await fs.readFile(COOKIES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

// Save cookies for persistent session
async function saveCookies(cookies) {
  await fs.writeFile(COOKIES_FILE, JSON.stringify(cookies, null, 2));
}

// Navigate to shopping list and handle login if needed
async function navigateAndLogin(page) {
  log('Navigating to Alexa Shopping List...');
  await page.goto('https://www.amazon.com/alexaquantum/sp/alexaShoppingList', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  // Wait a bit for page to settle
  await new Promise(resolve => setTimeout(resolve, 2000));

  const currentUrl = page.url();
  log(`Current URL: ${currentUrl}`);

  // Check if we were redirected to login
  if (currentUrl.includes('signin') || currentUrl.includes('/ap/')) {
    log('Login required, entering credentials...');

    try {
      // Wait for email field - try multiple selectors
      const emailSelectors = [
        '#ap_email_login',
        '#ap_email',
        'input[type="email"]',
        'input[name="email"]',
        'input[autocomplete="username"]'
      ];

      let emailInput = null;
      for (const selector of emailSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          emailInput = selector;
          log(`Found email field with selector: ${selector}`);
          break;
        } catch (e) {
          continue;
        }
      }

      if (!emailInput) {
        throw new Error('Could not find email input field');
      }

      await page.type(emailInput, config.amazon.email);

      // Click continue button - try multiple selectors
      const continueSelectors = [
        '#continue',
        'input[type="submit"]',
        'button[type="submit"]',
        'input.a-button-input'
      ];

      let clicked = false;
      for (const selector of continueSelectors) {
        try {
          await page.click(selector);
          log('Clicked continue button');
          clicked = true;
          break;
        } catch (e) {
          continue;
        }
      }

      if (!clicked) {
        throw new Error('Could not find continue button');
      }

      // Wait for password page to load
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {
        log('Password might be on same page');
      });

      // Wait a moment for page to fully load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Wait for password field - try multiple selectors
      const passwordSelectors = [
        '#ap_password',
        'input[type="password"]',
        'input[name="password"]'
      ];

      let passwordInput = null;
      for (const selector of passwordSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          passwordInput = selector;
          log(`Found password field with selector: ${selector}`);
          break;
        } catch (e) {
          continue;
        }
      }

      if (!passwordInput) {
        throw new Error('Could not find password input field');
      }

      await page.type(passwordInput, config.amazon.password);

      // Click sign in button - try multiple selectors
      const submitSelectors = [
        '#signInSubmit',
        'input[type="submit"]',
        'button[type="submit"]',
        'input.a-button-input'
      ];

      clicked = false;
      for (const selector of submitSelectors) {
        try {
          await page.click(selector);
          log('Clicked sign in button');
          clicked = true;
          break;
        } catch (e) {
          continue;
        }
      }

      if (!clicked) {
        throw new Error('Could not find sign in button');
      }

      // Wait for navigation after login
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {
        log('Navigation timeout - might require 2FA or CAPTCHA', '⚠️');
      });

      // Check if we need 2FA
      const finalUrl = page.url();
      log(`After login URL: ${finalUrl}`);

      if (finalUrl.includes('ap/mfa') || finalUrl.includes('ap/cvf') || finalUrl.includes('verification')) {
        log('Two-factor authentication or verification required!', '🔐');
        log('Please complete the verification in the browser window.');
        log('The script will wait for you to complete authentication...');

        // Wait up to 5 minutes for user to complete 2FA
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 300000 }).catch(() => {
          throw new Error('Authentication timeout - please try again');
        });
      }

      // Navigate to shopping list after successful login
      log('Navigating to shopping list after login...');
      await page.goto('https://www.amazon.com/alexaquantum/sp/alexaShoppingList', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      // Save cookies after successful login
      const cookies = await page.cookies();
      await saveCookies(cookies);
      log('Login successful, cookies saved', '✅');
    } catch (error) {
      log('Login error - you may need to manually login once', '❌');
      throw error;
    }
  } else {
    log('Already logged in (using saved cookies)', '✅');
  }
}

// Extract items from the shopping list page
async function extractItems(page) {
  log('Extracting items from shopping list...');

  // Wait for the list to load
  try {
    await page.waitForSelector('.item-body, .shopping-list-container', { timeout: 10000 });
  } catch (error) {
    log('No items found or page structure changed', '⚠️');
    return [];
  }

  // Extract item text
  const items = await page.evaluate(() => {
    // Try multiple selectors in case Amazon changes their structure
    const selectors = [
      '.item-body .item-title',
      '[data-item-name]',
      '.shopping-list-item .item-name'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        return Array.from(elements)
          .map(el => {
            // Try data attribute first, then text content
            return el.dataset.itemName || el.textContent.trim();
          })
          .filter(text => text && text.length > 0);
      }
    }

    return [];
  });

  log(`Found ${items.length} item(s)`, '📝');
  return items;
}

// Sync items to Todoist
async function syncToTodoist(items, state) {
  // Filter for items that need to be synced
  const newItems = items.filter(item => {
    // If item doesn't exist in state, it's new
    if (!state.syncedItems[item]) return true;

    // If item was completed on Alexa, it's been re-added - treat as new
    if (state.syncedItems[item].completedOnAlexa) return true;

    // Otherwise it's already synced and active
    return false;
  });

  if (newItems.length === 0) {
    log('No new items to sync', '✓');
    return state;
  }

  log(`Syncing ${newItems.length} new item(s) to Todoist...`, '🔄');

  for (const item of newItems) {
    if (DRY_RUN) {
      log(`[DRY RUN] Would sync: ${item}`, '🔍');
      continue;
    }

    try {
      const response = await fetch('https://api.todoist.com/rest/v2/tasks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.todoist.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: item,
          project_id: config.todoist.projectId
        })
      });

      if (response.ok) {
        const task = await response.json();
        // If this was a re-added item, log it differently
        const isReAdded = state.syncedItems[item]?.completedOnAlexa;

        state.syncedItems[item] = {
          todoistId: task.id,
          syncedAt: new Date().toISOString(),
          completedOnAlexa: false // Reset completion status
        };

        if (isReAdded) {
          log(`✅ Re-synced (re-added item): ${item}`, '🔄');
        } else {
          log(`✅ Synced: ${item}`, '✓');
        }
      } else {
        const errorText = await response.text();
        log(`Failed to sync "${item}": ${response.status} - ${errorText}`, '❌');
      }
    } catch (error) {
      log(`Error syncing "${item}": ${error.message}`, '❌');
    }
  }

  state.lastSync = new Date().toISOString();
  return state;
}

// Check if we should poll Todoist for completed tasks
function shouldCheckTodoistCompletions(state) {
  // If never checked, check now
  if (!state.lastTodoistCheck) {
    return true;
  }

  // Calculate hours since last check
  const lastCheck = new Date(state.lastTodoistCheck);
  const now = new Date();
  const hoursSinceLastCheck = (now - lastCheck) / (1000 * 60 * 60);

  const checkInterval = config.options.todoistCheckIntervalHours || 24;

  return hoursSinceLastCheck >= checkInterval;
}

// Get completed tasks from Todoist
async function getCompletedTodoistTasks(state) {
  log('Checking Todoist for completed tasks...', '🔍');

  const completedItems = [];

  // Check each synced item to see if it's been completed in Todoist
  for (const [itemName, itemData] of Object.entries(state.syncedItems)) {
    // Skip if we've already marked it complete on Alexa
    if (itemData.completedOnAlexa) {
      continue;
    }

    if (!itemData.todoistId) {
      continue;
    }

    try {
      // Fetch the task from Todoist
      const response = await fetch(`https://api.todoist.com/rest/v2/tasks/${itemData.todoistId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.todoist.apiToken}`
        }
      });

      // If task is not found (404), it was completed and archived
      if (response.status === 404) {
        log(`Task "${itemName}" completed in Todoist (archived/404)`, '✓');
        completedItems.push(itemName);
      } else if (response.ok) {
        const task = await response.json();
        // Check if task is marked as completed (checking all possible fields)
        const isComplete = task.isCompleted || task.completed || task.is_completed || task.checked;
        log(`Task "${itemName}" - Status: ${isComplete ? 'COMPLETED' : 'active'}`);

        if (isComplete) {
          log(`Task "${itemName}" marked as completed in Todoist`, '✓');
          completedItems.push(itemName);
        }
      } else {
        log(`Unexpected response for "${itemName}": ${response.status}`, '⚠️');
      }
    } catch (error) {
      log(`Error checking task "${itemName}": ${error.message}`, '❌');
    }
  }

  if (completedItems.length > 0) {
    log(`Found ${completedItems.length} completed item(s) in Todoist`, '📋');
  } else {
    log('No completed items found in Todoist', '✓');
  }

  return completedItems;
}

// Mark items as complete on Alexa shopping list
async function markItemsCompleteOnAlexa(page, itemsToComplete, state) {
  if (itemsToComplete.length === 0) {
    return state;
  }

  log(`Marking ${itemsToComplete.length} item(s) complete on Alexa shopping list...`, '🔄');

  for (const itemName of itemsToComplete) {
    if (DRY_RUN) {
      log(`[DRY RUN] Would mark complete: ${itemName}`, '🔍');
      continue;
    }

    try {
      // Find and click the checkbox for this item
      const result = await page.evaluate((name) => {
        // Normalize the search name (case-insensitive, trimmed)
        const searchName = name.toLowerCase().trim();

        // Try multiple selectors to find the item
        const selectors = [
          '.item-body .item-title',
          '[data-item-name]',
          '.shopping-list-item .item-name',
          'h3', // The "ace" text appears to be in an h3
          '.item-name'
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

      const completed = result.success;

      if (completed) {
        state.syncedItems[itemName].completedOnAlexa = true;
        state.syncedItems[itemName].completedAt = new Date().toISOString();
        log(`✅ Marked complete: ${itemName}`, '✓');
      } else {
        log(`Could not find item to mark complete: ${itemName}`, '⚠️');
        if (result.error) {
          log(`Reason: ${result.error}`, '🔍');
        }
        log(`Items found on page: ${result.foundItems.join(', ')}`, '🔍');
      }

      // Small delay between clicks
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      log(`Error marking "${itemName}" complete: ${error.message}`, '❌');
    }
  }

  return state;
}

// Main function
async function main() {
  log('Starting Alexa to Todoist sync...', '🚀');

  if (DRY_RUN) {
    log('Running in DRY RUN mode - no items will be synced', '🔍');
  }

  // Validate configuration
  if (!config.amazon.email || !config.amazon.password) {
    log('Amazon credentials not configured. Please update config.json', '❌');
    process.exit(1);
  }

  if (!config.todoist.apiToken || !config.todoist.projectId) {
    log('Todoist credentials not configured. Please update config.json', '❌');
    process.exit(1);
  }

  let browser;
  try {
    // Load previous state
    let state = await loadState();

    // Launch browser
    log('Launching browser...');
    browser = await puppeteer.launch({
      headless: config.options.headless ? 'new' : false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    const page = await browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Load saved cookies if they exist
    const cookies = await loadCookies();
    if (cookies) {
      await page.setCookie(...cookies);
      log('Loaded saved cookies', '🍪');
    }

    // Navigate to shopping list and login if needed
    await navigateAndLogin(page);

    // Extract items from Alexa
    const items = await extractItems(page);

    // Sync new items from Alexa to Todoist
    state = await syncToTodoist(items, state);

    // Check Todoist for completed tasks (but only if enough time has passed)
    const shouldCheckTodoist = shouldCheckTodoistCompletions(state);

    if (shouldCheckTodoist) {
      log('Time to check Todoist for completions', '⏰');
      const completedInTodoist = await getCompletedTodoistTasks(state);

      // Mark those items complete on Alexa
      state = await markItemsCompleteOnAlexa(page, completedInTodoist, state);

      // Update last check time
      state.lastTodoistCheck = new Date().toISOString();
    } else {
      const lastCheck = state.lastTodoistCheck ? new Date(state.lastTodoistCheck).toLocaleString() : 'never';
      log(`Skipping Todoist check (last checked: ${lastCheck})`, '⏭️');
    }

    // Save state
    if (!DRY_RUN) {
      await saveState(state);
      log('State saved', '💾');
    }

    log('Sync completed successfully!', '✅');

  } catch (error) {
    log(`Error: ${error.message}`, '❌');
    console.error(error);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run main function
main();
