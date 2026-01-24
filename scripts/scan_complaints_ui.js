const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    try {
        console.log('Launching browser...');
        // Use default launch options. If this fails, we might need to specify executablePath
        const browser = await puppeteer.launch({
            headless: 'new', // Use new headless mode
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // helpful for some envs
        });
        const page = await browser.newPage();

        // 1. Login
        console.log('Navigating to login page...');
        await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });

        console.log('Filling login credentials...');
        await page.type('#email', 'citizen1@gmail.com');
        await page.type('#password', '12345678');

        console.log('Submitting login form...');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }), // Relaxed wait
            page.click('#login-submit-btn')
        ]);

        console.log('Login successful. Current URL:', page.url());

        // 2. Navigate to File Complaint
        console.log('Navigating to File Complaint page...');
        await page.goto('http://localhost:3000/fileComplaint', { waitUntil: 'networkidle0' });

        console.log('Scanning complaint form...');
        // Wait for the form to be present
        await page.waitForSelector('#complaintForm', { timeout: 5000 });

        // 3. Scan Fields and Buttons
        const elements = await page.evaluate(() => {
            const form = document.querySelector('#complaintForm');
            if (!form) return { error: 'Form not found' };

            const inputs = Array.from(form.querySelectorAll('input, select, textarea, button'));
            return inputs.map(el => {
                const getLabel = (element) => {
                    if (element.labels && element.labels.length > 0) return element.labels[0].innerText;
                    const id = element.id;
                    if (id) {
                        const label = document.querySelector(`label[for="${id}"]`);
                        if (label) return label.innerText;
                    }
                    return null;
                };

                const isVisible = (element) => {
                    return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
                };

                return {
                    tagName: el.tagName.toLowerCase(),
                    type: el.type || null,
                    id: el.id || null,
                    name: el.name || null,
                    placeholder: el.placeholder || null,
                    label: getLabel(el),
                    text: el.innerText || el.value || null,
                    visible: isVisible(el),
                    parentSection: el.closest('.form-step')?.id || 'unknown'
                };
            });
        });

        console.log('--- UI SCAN RESULTS ---');
        fs.writeFileSync('scan_results.json', JSON.stringify(elements, null, 2));
        console.log('Results written to scan_results.json');
        console.log('--- END RESULTS ---');

        await browser.close();

    } catch (error) {
        console.error('An error occurred:', error);
        process.exit(1);
    }
})();
