const puppeteer = require('puppeteer');

(async () => {
    try {
        console.log('Launching browser...');
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // 1. Login
        console.log('Navigating to login page...');
        await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });

        console.log('Filling login credentials...');
        await page.type('#email', 'citizen1@gmail.com');
        await page.type('#password', '12345678');

        console.log('Submitting login form...');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
            page.click('#login-submit-btn')
        ]);

        console.log('Login successful.');

        // 2. Call the failing API endpoint
        console.log('Testing /api/complaints/my endpoint...');

        const response = await page.evaluate(async () => {
            try {
                const res = await fetch('/api/complaints/my');
                return {
                    status: res.status,
                    statusText: res.statusText,
                    body: await res.text() // Get text to avoid parsing error if 500 html
                };
            } catch (e) {
                return { error: e.toString() };
            }
        });

        console.log('--- API RESPONSE ---');
        console.log(`Status: ${response.status} ${response.statusText}`);

        if (response.status === 200) {
            console.log('SUCCESS: API call succeeded. Recursion fixed.');
            // Try to parse JSON to be sure
            try {
                const data = JSON.parse(response.body);
                console.log('Data records:', data.data ? data.data.length : 'N/A');
            } catch (e) {
                console.log('Response body (not JSON):', response.body.substring(0, 100));
            }
        } else {
            console.log('FAILURE: API call failed.');
            console.log('Error Body:', response.body);
        }
        console.log('--- END RESPONSE ---');

        await browser.close();

        if (response.status === 200) {
            process.exit(0);
        } else {
            process.exit(1);
        }

    } catch (error) {
        console.error('An error occurred:', error);
        process.exit(1);
    }
})();
