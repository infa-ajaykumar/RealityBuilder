import puppeteer, { Browser, Page } from 'puppeteer';
import amqp from 'amqplib';
import os from 'os';

// --- Configuration (from Environment Variables or Defaults) ---
const TARGET_URL = process.env.TARGET_URL || 'https://example-dynamic-realestate.com/listings';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://user:password@rabbitmq_server';
const RABBITMQ_QUEUE = process.env.RABBITMQ_QUEUE || 'property_listings_raw';
const SOURCE_NAME = process.env.SOURCE_NAME || 'DynamicSiteScraper';
const HEADLESS_MODE = process.env.PUPPETEER_HEADLESS !== 'false';

// Proxy Configuration
const HTTP_PROXIES_STRING = process.env.HTTP_PROXIES || '';
const PROXIES_LIST = HTTP_PROXIES_STRING.split(',').map(p => p.trim()).filter(p => p);
let selectedProxy: string | null = null;

if (PROXIES_LIST.length > 0) {
    selectedProxy = PROXIES_LIST[Math.floor(Math.random() * PROXIES_LIST.length)];
    console.log(`Advanced Scraper: Using proxy: ${selectedProxy}`);
} else {
    console.log("Advanced Scraper: No proxies configured or list is empty. Using direct connection.");
}

// --- Helper: Random Delay ---
function randomDelay(min = 1000, max = 3000) {
    return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
}

// --- RabbitMQ Connection Function ---
async function setupRabbitMQ(): Promise<amqp.Channel | null> {
    try {
        console.log(`Connecting to RabbitMQ at ${RABBITMQ_URL}...`);
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        await channel.assertQueue(RABBITMQ_QUEUE, { durable: true });
        console.log(`RabbitMQ connected and queue '${RABBITMQ_QUEUE}' asserted.`);

        const gracefulShutdownRabbit = async () => {
            console.log('Closing RabbitMQ connection...');
            try {
                if (channel && !channel.connection?.closeForced) await channel.close();
                if (connection && !connection.closeForced) await connection.close();
            } catch (e) {
                console.error("Error closing RabbitMQ resources", e);
            }
        };

        process.on('SIGINT', gracefulShutdownRabbit);
        process.on('SIGTERM', gracefulShutdownRabbit);

        return channel;
    } catch (error) {
        console.error('Failed to setup RabbitMQ:', error);
        return null;
    }
}

// --- Property Detail Scraping Function ---
async function scrapePropertyDetails(
    detailPageUrl: string,
    browser: Browser, // Pass browser instance to open new pages
    rabbitmqChannel: amqp.Channel
): Promise<void> {
    let detailPage: Page | null = null;
    console.log(`Scraping details from: ${detailPageUrl}`);
    try {
        detailPage = await browser.newPage();
        await detailPage.setUserAgent(`Mozilla/5.0 (${os.platform()} ${os.release()}; ${os.arch()}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.85 Safari/537.36`);
        await detailPage.goto(detailPageUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await detailPage.waitForSelector('.property-title', { timeout: 30000 });

        const title = await detailPage.$eval('.property-title', el => el.textContent?.trim() || '').catch(() => null);
        const price = await detailPage.$eval('.property-price', el => el.textContent?.trim() || '').catch(() => null);
        const location = await detailPage.$eval('.property-location', el => el.textContent?.trim() || '').catch(() => null);
        const bedroomsText = await detailPage.$eval('.property-bedrooms', el => el.textContent?.trim() || '').catch(() => null);
        const bathroomsText = await detailPage.$eval('.property-bathrooms', el => el.textContent?.trim() || '').catch(() => null);
        const areaText = await detailPage.$eval('.property-area', el => el.textContent?.trim() || '').catch(() => null);
        const images = await detailPage.$$eval('.property-image', imgs => imgs.map(img => (img as HTMLImageElement).src)).catch(() => []);
        const description = await detailPage.$eval('.property-description', el => el.innerHTML.trim() || '').catch(() => null);
        const datePostedText = await detailPage.$eval('.property-date-posted', el => el.textContent?.trim() || '').catch(() => null);

        const bedrooms = bedroomsText ? parseInt(bedroomsText.match(/\d+/)?.[0] || '0') : null;
        const bathrooms = bathroomsText ? parseFloat(bathroomsText.match(/[\d.]+/)?.[0] || '0') : null;
        let date_posted: string | null = null;
        if (datePostedText) { try { date_posted = new Date(datePostedText).toISOString(); } catch (e) { /* ignore */ } }

        const propertyData = {
            title, price_text: price, location_text: location, bedrooms, bathrooms,
            area_text: areaText, images, description, source_url: detailPageUrl,
            date_posted, source_name: SOURCE_NAME, scrape_timestamp: new Date().toISOString(),
        };

        rabbitmqChannel.sendToQueue(RABBITMQ_QUEUE, Buffer.from(JSON.stringify(propertyData)), { persistent: true });
        console.log(`Sent to RabbitMQ: ${propertyData.title?.substring(0,50)}...`);

    } catch (error) {
        console.error(`Error scraping detail page ${detailPageUrl}:`, error);
    } finally {
        if (detailPage && !detailPage.isClosed()) await detailPage.close().catch(e => console.error("Error closing detail page", e));
        await randomDelay();
    }
}

// --- Main Scraping Logic ---
async function scrapeSite(rabbitmqChannel: amqp.Channel): Promise<void> {
    console.log(`Starting scrape for target URL: ${TARGET_URL}`);

    const launchArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
    ];
    if (selectedProxy) {
        launchArgs.push(`--proxy-server=${selectedProxy}`);
    }

    const browser = await puppeteer.launch({
        headless: HEADLESS_MODE,
        args: launchArgs,
    });

    let mainPage: Page | null = null;

    try {
        mainPage = await browser.newPage();
        await mainPage.setUserAgent(`Mozilla/5.0 (${os.platform()} ${os.release()}; ${os.arch()}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.85 Safari/537.36`);
        await mainPage.setViewport({ width: 1280, height: 800 });

        let currentPageUrl: string | null = TARGET_URL;
        let pageNum = 1;

        while (currentPageUrl) {
            console.log(`Scraping listing page ${pageNum}: ${currentPageUrl}`);
            await mainPage.goto(currentPageUrl, { waitUntil: 'networkidle2', timeout: 60000 });
            await mainPage.waitForSelector('.property-item', { timeout: 30000 });

            const propertyItems = await mainPage.$$('.property-item');
            console.log(`Found ${propertyItems.length} property items on page ${pageNum}.`);

            for (const item of propertyItems) {
                try {
                    const detailLinkSelector = 'a.property-link';
                    await item.waitForSelector(detailLinkSelector, {visible: true, timeout: 5000 });
                    const detailPageUrl = await item.$eval(detailLinkSelector, el => (el as HTMLAnchorElement).href);
                    if (detailPageUrl) {
                        await scrapePropertyDetails(detailPageUrl, browser, rabbitmqChannel);
                    } else { console.warn('Could not find detail page URL.'); }
                } catch (e) { console.error('Error extracting detail link:', e); }
            }

            try {
                const nextButtonSelector = '.pagination .next a';
                const nextButton = await mainPage.$(nextButtonSelector);
                if (nextButton) {
                    currentPageUrl = await mainPage.$eval(nextButtonSelector, el => (el as HTMLAnchorElement).href);
                    console.log(`Found next page link: ${currentPageUrl}`);
                    pageNum++;
                    await randomDelay(2000,5000);
                } else { console.log('No next page button. Ending pagination.'); currentPageUrl = null; }
            } catch (e) { console.log('Error finding next page. Ending pagination.', e); currentPageUrl = null; }
        }
        console.log('Finished scraping all pages.');
    } catch (error) {
        console.error('Error in main scraping site logic:', error);
    } finally {
        if (mainPage && !mainPage.isClosed()) await mainPage.close().catch(e => console.error("Error closing main page", e));
        if (browser) await browser.close().catch(e => console.error("Error closing browser", e));
        console.log('Browser closed.');
    }
}

// --- Main Execution Block ---
async function main() {
    console.log(`Advanced Puppeteer scraper starting... (Headless: ${HEADLESS_MODE}, Proxy: ${selectedProxy || 'None'})`);
    const rabbitmqChannel = await setupRabbitMQ();

    if (rabbitmqChannel) {
        try {
            await scrapeSite(rabbitmqChannel);
        } catch (error) {
            console.error('Critical error during scraping process:', error);
        } finally {
            // RabbitMQ connection is closed via SIGINT/SIGTERM handlers in setupRabbitMQ
             console.log("Scraping process complete. RabbitMQ connection will be closed on process exit.");
        }
    } else {
        console.error('Could not establish RabbitMQ channel. Scraper cannot run.');
        process.exit(1);
    }
    console.log('Advanced Puppeteer scraper finished main execution block.');
}

main().catch(err => {
    console.error('Unhandled error in main execution:', err);
    process.exit(1);
});
