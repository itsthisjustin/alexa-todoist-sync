import puppeteer from '@cloudflare/puppeteer';

/**
 * Login to Amazon and extract session cookies
 */
export async function loginToAmazon(
  email: string,
  password: string,
  browserBinding: Fetcher,
  tfaCode?: string
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
    await page.goto('https://www.amazon.com/ap/signin?openid.pape.max_auth_age=0&openid.return_to=https%3A%2F%2Fwww.amazon.com%2F%3Fref_%3Dnav_signin&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.assoc_handle=usflex&openid.mode=checkid_setup&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Wait a bit for page to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));

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
        new Promise(resolve => setTimeout(resolve, 3000)),
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
      new Promise(resolve => setTimeout(resolve, 5000)),
    ]);

    // Check if we're still on login page (failed login)
    let url = page.url();
    console.log(`Current URL after login: ${url}`);

    // Check for account picker (multiple Amazon accounts)
    if (url.includes('/ap/signin') && url.includes('switch_account=picker')) {
      console.log('Account picker detected - selecting first account');

      // Try to click the first account option
      const accountSelectors = [
        '.cvf-account-switcher-card:first-child',
        'div[data-testid="account-list-item"]:first-child',
        '.cvf-account-switcher-claim:first-child',
        'button[name="switchAccount"]:first-child',
      ];

      let accountSelected = false;
      for (const selector of accountSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.click(selector);
          accountSelected = true;
          console.log(`Clicked account using selector: ${selector}`);
          break;
        } catch (e) {
          continue;
        }
      }

      if (!accountSelected) {
        throw new Error('Could not select account from account picker');
      }

      // Wait for navigation after account selection
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        new Promise(resolve => setTimeout(resolve, 5000)),
      ]);

      url = page.url();
      console.log(`URL after account selection: ${url}`);
    }

    if (url.includes('/ap/signin') || url.includes('auth-error')) {
      // Check for error message
      const errorElement = await page.$('.a-alert-error, .auth-error-message');
      if (errorElement) {
        const errorText = await page.evaluate(el => el.textContent, errorElement);
        console.log(`Amazon error message: ${errorText}`);
        throw new Error(`Amazon login failed: ${errorText}`);
      }

      // Check for any visible text that might indicate the issue
      const bodyText = await page.evaluate(() => document.body.innerText);
      console.log(`Page content preview: ${bodyText.substring(0, 500)}`);

      throw new Error('Amazon login failed - check credentials');
    }

    // Check for 2FA page
    if (url.includes('ap/mfa') || url.includes('ap/cvf')) {
      console.log('2FA/Verification detected');

      // Capture what type of verification Amazon is asking for
      const pageTitle = await page.evaluate(() => document.title);
      const bodyText = await page.evaluate(() => document.body.innerText);
      console.log(`Page title: ${pageTitle}`);
      console.log(`Page content (first 1000 chars): ${bodyText.substring(0, 1000)}`);

      // Check the "remember device" checkbox if it exists
      const rememberDeviceCheckbox = await page.$('#auth-mfa-remember-device');
      if (rememberDeviceCheckbox) {
        const isChecked = await page.evaluate(el => el.checked, rememberDeviceCheckbox);
        if (!isChecked) {
          await page.click('#auth-mfa-remember-device');
          console.log('Checked "remember device" checkbox');
        }
      }

      // If no 2FA code provided, throw error indicating 2FA is needed
      if (!tfaCode) {
        throw new Error('2FA_REQUIRED');
      }

      // Fill in 2FA code
      console.log('Filling in 2FA code');
      const tfaSelectors = ['#auth-mfa-otpcode', 'input[name="otpCode"]'];
      let tfaFilled = false;

      for (const selector of tfaSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.type(selector, tfaCode, { delay: 50 });
          tfaFilled = true;
          console.log(`2FA code filled using selector: ${selector}`);
          break;
        } catch (e) {
          continue;
        }
      }

      if (!tfaFilled) {
        throw new Error('Could not find 2FA code input field');
      }

      // Submit 2FA
      const tfaSubmitSelectors = ['#auth-signin-button', 'input[type="submit"]'];
      let tfaSubmitted = false;

      for (const selector of tfaSubmitSelectors) {
        try {
          await page.click(selector);
          tfaSubmitted = true;
          console.log(`Clicked 2FA submit using selector: ${selector}`);
          break;
        } catch (e) {
          continue;
        }
      }

      if (!tfaSubmitted) {
        throw new Error('Could not find 2FA submit button');
      }

      // Wait for navigation after 2FA
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        new Promise(resolve => setTimeout(resolve, 5000)),
      ]);

      // Check if 2FA failed
      const urlAfter2FA = page.url();
      if (urlAfter2FA.includes('ap/mfa') || urlAfter2FA.includes('ap/cvf')) {
        throw new Error('2FA code incorrect or expired');
      }
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

    // Fix session cookies (expires: -1) by giving them a 1-year expiry
    // This prevents them from being treated as browser-session-only
    const oneYearFromNow = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60);
    const fixedCookies = cookies.map(cookie => {
      // If cookie has no expiry or expires is -1, set it to 1 year from now
      if (!cookie.expires || cookie.expires === -1) {
        return { ...cookie, expires: oneYearFromNow };
      }
      return cookie;
    });

    // Log important session cookies for debugging
    const sessionCookies = fixedCookies.filter(c =>
      c.name.includes('session') ||
      c.name.includes('ubid') ||
      c.name.includes('x-main') ||
      c.name.includes('at-main')
    );
    console.log('Important cookies:', sessionCookies.map(c => ({
      name: c.name,
      domain: c.domain,
      expires: c.expires ? new Date(c.expires * 1000).toISOString() : 'session',
      httpOnly: c.httpOnly,
      secure: c.secure
    })));

    return fixedCookies;
  } finally {
    await browser.close();
  }
}
