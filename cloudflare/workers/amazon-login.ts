import puppeteer from '@cloudflare/puppeteer';

/**
 * Login to Amazon and extract session cookies
 */
export async function loginToAmazon(
  email: string,
  password: string,
  browserBinding: Fetcher
): Promise<Array<any>> {
  console.log(`Logging in to Amazon for ${email}`);

  // Launch browser
  const browser = await puppeteer.launch(browserBinding);

  try {
    const page = await browser.newPage();

    // Set realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Navigate to Amazon
    console.log('Navigating to Amazon login page');
    await page.goto('https://www.amazon.com/ap/signin?openid.return_to=https://www.amazon.com/alexaquantum/sp/alexaShoppingList', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Wait a bit for page to stabilize
    await page.waitForTimeout(2000);

    // Fill email
    const emailSelectors = ['#ap_email', '#ap_email_login', 'input[type="email"]', 'input[name="email"]'];
    let emailFilled = false;

    for (const selector of emailSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        await page.type(selector, email, { delay: 50 });
        emailFilled = true;
        console.log(`Email filled using selector: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }

    if (!emailFilled) {
      throw new Error('Could not find email input field');
    }

    // Click continue
    const continueSelectors = ['#continue', 'input#continue', 'input[type="submit"]', '#ap_email_login_continue_id'];
    let continued = false;

    for (const selector of continueSelectors) {
      try {
        await page.click(selector);
        continued = true;
        console.log(`Clicked continue using selector: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }

    if (continued) {
      // Wait for navigation after continue
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }),
        page.waitForTimeout(3000),
      ]);
    }

    // Fill password
    const passwordSelectors = ['#ap_password', 'input[type="password"]', 'input[name="password"]'];
    let passwordFilled = false;

    for (const selector of passwordSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        await page.type(selector, password, { delay: 50 });
        passwordFilled = true;
        console.log(`Password filled using selector: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }

    if (!passwordFilled) {
      throw new Error('Could not find password input field');
    }

    // Submit login
    const submitSelectors = ['#signInSubmit', 'input#signInSubmit', 'input[type="submit"]', '#auth-signin-button'];
    let submitted = false;

    for (const selector of submitSelectors) {
      try {
        await page.click(selector);
        submitted = true;
        console.log(`Clicked submit using selector: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }

    if (!submitted) {
      throw new Error('Could not find submit button');
    }

    // Wait for navigation after login
    await Promise.race([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.waitForTimeout(5000),
    ]);

    // Check if we're still on login page (failed login)
    const url = page.url();
    if (url.includes('/ap/signin') || url.includes('auth-error')) {
      // Check for error message
      const errorElement = await page.$('.a-alert-error, .auth-error-message');
      if (errorElement) {
        const errorText = await page.evaluate(el => el.textContent, errorElement);
        throw new Error(`Amazon login failed: ${errorText}`);
      }
      throw new Error('Amazon login failed - check credentials');
    }

    // Check for 2FA page
    if (url.includes('ap/mfa') || url.includes('ap/cvf')) {
      throw new Error('2FA required - please disable 2FA on your Amazon account or implement 2FA handling');
    }

    console.log('Login successful, extracting cookies');

    // Navigate to shopping list to ensure we have the right cookies
    await page.goto('https://www.amazon.com/alexaquantum/sp/alexaShoppingList', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Get all cookies
    const cookies = await page.cookies();

    console.log(`Extracted ${cookies.length} cookies`);

    return cookies;
  } finally {
    await browser.close();
  }
}
