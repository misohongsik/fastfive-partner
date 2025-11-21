const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

// ASINs to debug
const ASINS = ['B09V8FHNJ5', 'B01N1FV7KS'];

async function debugVideoExtraction() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--lang=en-US,en'
        ]
    });

    const page = await browser.newPage();

    // Load cookies if available
    const cookiePath = path.join(__dirname, '../config/amazon_session.json');
    if (fs.existsSync(cookiePath)) {
        const cookies = JSON.parse(fs.readFileSync(cookiePath));
        await page.setCookie(...cookies);
    }

    for (const asin of ASINS) {
        console.log(`\n🔍 Debugging ASIN: ${asin}`);
        const url = `https://www.amazon.com/dp/${asin}`;

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

            // 1. Check for videoGalleryData
            const scriptContent = await page.evaluate(() => {
                const scripts = document.querySelectorAll('script');
                let foundData = [];
                scripts.forEach(s => {
                    if (s.textContent.includes('videoGalleryData')) {
                        foundData.push({ type: 'videoGalleryData', content: s.textContent.substring(0, 500) + '...' });
                    }
                    if (s.textContent.includes('videos')) {
                        foundData.push({ type: 'videos_keyword', content: s.textContent.substring(0, 500) + '...' });
                    }
                    if (s.textContent.includes('vse-video-container')) {
                        foundData.push({ type: 'vse_container', content: s.textContent.substring(0, 500) + '...' });
                    }
                });
                return foundData;
            });

            console.log('   📄 Script Tags Analysis:');
            if (scriptContent.length > 0) {
                scriptContent.forEach(item => {
                    console.log(`      - Found [${item.type}]: ${item.content.substring(0, 100)}...`);
                });
            } else {
                console.log('      - No standard video data patterns found in scripts.');
            }

            // 2. Check DOM for video elements
            const domAnalysis = await page.evaluate(() => {
                const videos = document.querySelectorAll('video');
                const videoContainers = document.querySelectorAll('.vse-video-container');
                const imageBlock = document.querySelector('#imageBlock');

                return {
                    videoTagCount: videos.length,
                    vseContainerCount: videoContainers.length,
                    imageBlockHTML: imageBlock ? imageBlock.innerHTML.substring(0, 1000) : 'Not Found'
                };
            });

            console.log('   DOM Analysis:');
            console.log(`      - <video> tags: ${domAnalysis.videoTagCount}`);
            console.log(`      - .vse-video-container: ${domAnalysis.vseContainerCount}`);

            // Save HTML for offline inspection
            const html = await page.content();
            fs.writeFileSync(path.join(__dirname, `debug_${asin}.html`), html);
            console.log(`   💾 Saved HTML to debug_${asin}.html`);

        } catch (error) {
            console.error(`   ❌ Error processing ${asin}:`, error.message);
        }
    }

    await browser.close();
}

debugVideoExtraction();
