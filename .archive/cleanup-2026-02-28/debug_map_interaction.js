const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    try {
        console.log('Launching browser...');
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Log console messages
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));

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

        // 2. Navigate to File Complaint
        console.log('Navigating to File Complaint page...');
        await page.goto('http://localhost:3000/fileComplaint', { waitUntil: 'networkidle0' });

        // 3. Fill Step 1
        console.log('Filling Step 1...');
        await page.type('#description', 'Test complaint description');
        console.log('Clicking Next...');
        await page.click('#btn-next');

        // 4. Wait for Step 2 and Map
        console.log('Waiting for Step 2 and Map...');
        await page.waitForSelector('#step-location', { visible: true });

        // Wait for map to initialize (marker to appear)
        // We'll check for the marker class
        try {
            await page.waitForSelector('.leaflet-marker-icon', { timeout: 10000 });
            console.log('Initial marker found.');
        } catch (e) {
            console.error('Initial marker NOT found.');
        }

        // 5. Click the map
        console.log('Clicking the map...');
        // Click center of map
        const mapBox = await page.$('#complaint-map');
        const box = await mapBox.boundingBox();
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

        await new Promise(r => setTimeout(r, 2000)); // Wait for animation/update

        // 6. Check for marker again
        const markerCount = await page.$$eval('.leaflet-marker-icon', els => els.length);
        console.log(`Marker count after click: ${markerCount}`);

        const validMarkerCount = await page.$$eval('.valid-location-marker', els => els.length);
        console.log(`Valid marker class count: ${validMarkerCount}`);

        const invalidMarkerCount = await page.$$eval('.invalid-location-marker', els => els.length);
        console.log(`Invalid marker class count: ${invalidMarkerCount}`);

        // Capture HTML of map pane
        const mapHtml = await page.$eval('#complaint-map', el => el.innerHTML);
        fs.writeFileSync('map_dump.html', mapHtml);
        console.log('Map HTML dumped to map_dump.html');

        await browser.close();

    } catch (error) {
        console.error('An error occurred:', error);
        process.exit(1);
    }
})();
