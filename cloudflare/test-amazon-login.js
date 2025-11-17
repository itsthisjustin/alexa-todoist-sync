/**
 * Local test script for Amazon login
 * Run with: node test-amazon-login.js <email> <password>
 */

import puppeteer from 'puppeteer';

async function testAmazonLogin(email, password) {
  console.log(`Testing Amazon login for ${email}`);

  // Launch browser with headless: false so you can see it
  const browser = await puppeteer.launch({
    headless: false, // Set to true to run headless
    slowMo: 100, // Slow down actions by 100ms to see what's happening
    args: ['--start-maximized'],
    defaultViewport: null,
  });

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

    console.log('Page loaded, waiting for page to stabilize...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Take a screenshot to see what we got
    await page.screenshot({ path: 'amazon-login-page.png', fullPage: true });
    console.log('Screenshot saved to amazon-login-page.png');

    // Try to find email field
    const emailSelectors = ['#ap_email', '#ap_email_login', 'input[type="email"]', 'input[name="email"]'];
    let emailFilled = false;

    for (const selector of emailSelectors) {
      try {
        console.log(`Trying email selector: ${selector}`);
        await page.waitForSelector(selector, { timeout: 3000 });
        console.log(`✓ Found email field with selector: ${selector}`);
        await page.type(selector, email, { delay: 50 });
        emailFilled = true;
        console.log('✓ Email filled');
        break;
      } catch (e) {
        console.log(`✗ Selector ${selector} not found`);
        continue;
      }
    }

    if (!emailFilled) {
      // Get all input fields on the page for debugging
      const inputs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input')).map(input => ({
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
        }));
      });
      console.log('\nAll input fields on page:', JSON.stringify(inputs, null, 2));
      throw new Error('Could not find email input field');
    }

    // Click continue
    const continueSelectors = ['#continue', 'input#continue', 'input[type="submit"]', '#ap_email_login_continue_id'];
    let continued = false;

    for (const selector of continueSelectors) {
      try {
        console.log(`Trying continue button selector: ${selector}`);
        const element = await page.$(selector);
        if (element) {
          console.log(`✓ Found continue button with selector: ${selector}`);
          await page.click(selector);
          continued = true;
          console.log('✓ Clicked continue');
          break;
        }
      } catch (e) {
        console.log(`✗ Selector ${selector} not found`);
        continue;
      }
    }

    if (continued) {
      console.log('Waiting for navigation after continue...');
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }),
        new Promise(resolve => setTimeout(resolve, 3000)),
      ]);
      await page.screenshot({ path: 'amazon-password-page.png', fullPage: true });
      console.log('Screenshot saved to amazon-password-page.png');
    }

    // Fill password
    const passwordSelectors = ['#ap_password', 'input[type="password"]', 'input[name="password"]'];
    let passwordFilled = false;

    for (const selector of passwordSelectors) {
      try {
        console.log(`Trying password selector: ${selector}`);
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found password field with selector: ${selector}`);
        await page.type(selector, password, { delay: 50 });
        passwordFilled = true;
        console.log('✓ Password filled');
        break;
      } catch (e) {
        console.log(`✗ Selector ${selector} not found`);
        continue;
      }
    }

    if (!passwordFilled) {
      const inputs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input')).map(input => ({
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
        }));
      });
      console.log('\nAll input fields on page:', JSON.stringify(inputs, null, 2));
      throw new Error('Could not find password input field');
    }

    // Submit login
    const submitSelectors = ['#signInSubmit', 'input#signInSubmit', 'input[type="submit"]', '#auth-signin-button'];
    let submitted = false;

    for (const selector of submitSelectors) {
      try {
        console.log(`Trying submit button selector: ${selector}`);
        const element = await page.$(selector);
        if (element) {
          console.log(`✓ Found submit button with selector: ${selector}`);
          await page.click(selector);
          submitted = true;
          console.log('✓ Clicked submit');
          break;
        }
      } catch (e) {
        console.log(`✗ Selector ${selector} not found`);
        continue;
      }
    }

    if (!submitted) {
      const buttons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button, input[type="submit"]')).map(btn => ({
          tagName: btn.tagName,
          type: btn.type,
          id: btn.id,
          name: btn.name,
          textContent: btn.textContent?.trim(),
        }));
      });
      console.log('\nAll buttons on page:', JSON.stringify(buttons, null, 2));
      throw new Error('Could not find submit button');
    }

    // Wait for navigation after login
    console.log('Waiting for navigation after login...');
    await Promise.race([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      new Promise(resolve => setTimeout(resolve, 5000)),
    ]);

    await page.screenshot({ path: 'amazon-after-login.png', fullPage: true });
    console.log('Screenshot saved to amazon-after-login.png');

    // Check if we're still on login page (failed login)
    const url = page.url();
    console.log(`Current URL: ${url}`);

    if (url.includes('/ap/signin') || url.includes('auth-error')) {
      const errorElement = await page.$('.a-alert-error, .auth-error-message');
      if (errorElement) {
        const errorText = await page.evaluate(el => el.textContent, errorElement);
        throw new Error(`Amazon login failed: ${errorText}`);
      }
      throw new Error('Amazon login failed - check credentials');
    }

    // Check for 2FA page
    if (url.includes('ap/mfa') || url.includes('ap/cvf')) {
      console.log('⚠️  2FA detected');

      // Check the "remember device" checkbox if it exists
      const rememberDeviceCheckbox = await page.$('#auth-mfa-remember-device');
      if (rememberDeviceCheckbox) {
        const isChecked = await page.evaluate(el => el.checked, rememberDeviceCheckbox);
        if (!isChecked) {
          await page.click('#auth-mfa-remember-device');
          console.log('✓ Checked "remember device" checkbox');
        }
      } else {
        console.log('⚠️  Remember device checkbox not found');
      }

      await page.screenshot({ path: 'amazon-2fa-page.png', fullPage: true });
      console.log('Screenshot saved to amazon-2fa-page.png');

      // Keep browser open for manual 2FA entry
      console.log('\n⚠️  Please enter your 2FA code in the browser');
      console.log('Browser will stay open for 120 seconds for manual 2FA entry...\n');
      await new Promise(resolve => setTimeout(resolve, 120000));
    }

    console.log('✓ Login successful, extracting cookies');

    // Navigate to shopping list to ensure we have the right cookies
    await page.goto('https://www.amazon.com/alexaquantum/sp/alexaShoppingList', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    await page.screenshot({ path: 'amazon-shopping-list.png', fullPage: true });
    console.log('Screenshot saved to amazon-shopping-list.png');

    // Get all cookies
    const cookies = await page.cookies();
    console.log(`✓ Extracted ${cookies.length} cookies`);
    console.log('\nCookies:', cookies.map(c => ({ name: c.name, domain: c.domain })));

    // Keep browser open for inspection
    console.log('\n✓ SUCCESS! Browser will stay open for 10 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    return cookies;
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.log('\nBrowser will stay open for 30 seconds for debugging...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    throw error;
  } finally {
    await browser.close();
  }
}

// Get email and password from command line
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('Usage: node test-amazon-login.js <email> <password>');
  process.exit(1);
}

testAmazonLogin(email, password)
  .then(() => {
    console.log('\n✓ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });
