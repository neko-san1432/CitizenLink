const puppeteer = require('puppeteer');

(async () => {
    console.log('🚀 Starting Map Interaction Test...');

    // Launch browser (Headless false so user can see it if they want, but true is faster)
    // We'll use headless: "new" for now to just get the result.
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    try {
        // 1. Login
        console.log('Tumutungo sa Login page...');
        await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });

        await page.type('#email', 'citizen1@gmail.com');
        await page.type('#password', '12345678');

        console.log('Signing in...');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button[type="submit"]')
        ]);

        console.log('✅ Login Successful');

        // 2. Navigate to File Complaint
        console.log('Navigating to File Complaint...');
        await page.goto('http://localhost:3000/fileComplaint', { waitUntil: 'networkidle0' });

        // 3. Fill Step 1 (Details)
        console.log('Filling Step 1...');
        await page.type('#description', 'Automated Test: Pin Location');

        // Click Next
        await page.click('#btn-next');

        // Wait for animation/transition
        await new Promise(r => setTimeout(r, 1000));

        console.log('Moved to Location Step.');

        // 4. Test Map Pinning
        console.log('Attempting to click the map...');

        // Get the map container
        const mapSelector = '#complaint-map';
        await page.waitForSelector(mapSelector);

        // Click in the center of the map
        const mapElement = await page.$(mapSelector);
        const box = await mapElement.boundingBox();
        const clickX = box.x + box.width / 2;
        const clickY = box.y + box.height / 2;

        await page.mouse.click(clickX, clickY);
        await new Promise(r => setTimeout(r, 1000)); // Wait for geocoding/update

        // 5. Check Input Value
        const locationValue = await page.$eval('#location', el => el.value);
        const latValue = await page.$eval('#latitude', el => el.value);
        const lngValue = await page.$eval('#longitude', el => el.value);

        console.log('-----------------------------------');
        console.log('📍 Result:');
        console.log(`Address Field: "${locationValue}"`);
        console.log(`Latitude:      ${latValue}`);
        console.log(`Longitude:     ${lngValue}`);
        console.log('-----------------------------------');

        if (locationValue && latValue && lngValue) {
            console.log('✅ TEST PASSED: Pin successfully dropped and coordinates captured.');
        } else {
            console.error('❌ TEST FAILED: Location inputs are empty.');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Test Failed with Error:', error);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
