const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

const ASIN = 'B0CT891T9W';
const URL = `https://www.amazon.com/dp/${ASIN}`;

async function runDebug() {
    console.log(`🔍 Debugging video extraction for ASIN: ${ASIN}`);

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=en-US,en']
    });
    const page = await browser.newPage();

    // Load cookies if available
    const COOKIE_FILE = path.join(__dirname, 'amazon_session.json');
    if (fs.existsSync(COOKIE_FILE)) {
        const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE));
        await page.setCookie(...cookies);
    }

    try {
        await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // 1. Check for videoGalleryData in scripts
        const scripts = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('script')).map(s => s.textContent);
        });

        let foundData = false;
        scripts.forEach((script, index) => {
            if (script.includes('videoGalleryData') || script.includes('.mp4')) {
                console.log(`\n📜 Script #${index} contains video keywords:`);
                // Log a snippet around the keyword
                const keywordIndex = script.indexOf('videoGalleryData');
                if (keywordIndex !== -1) {
                    console.log('   ... ' + script.substring(keywordIndex - 50, keywordIndex + 300) + ' ...');
                }

                const mp4Index = script.indexOf('.mp4');
                if (mp4Index !== -1) {
                    console.log('   ... ' + script.substring(mp4Index - 100, mp4Index + 50) + ' ...');
                }
                foundData = true;
            }
        });

        if (!foundData) {
            console.log("❌ 'videoGalleryData' or '.mp4' not found in any script tags.");
        }

        // 2. Check for DOM elements
        const videoElements = await page.evaluate(() => {
            const videos = [];
            document.querySelectorAll('video, .vse-video-container').forEach(el => {
                videos.push({
                    tagName: el.tagName,
                    src: el.src || el.querySelector('source')?.src,
                    class: el.className,
                    outerHTML: el.outerHTML.substring(0, 200)
                });
            });
            return videos;
        });

        if (videoElements.length > 0) {
            console.log("\n🎥 Video Elements found in DOM:");
            console.log(JSON.stringify(videoElements, null, 2));
        } else {
            console.log("\n❌ No <video> elements found in DOM.");
        }

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await browser.close();
    }
}

runDebug();
