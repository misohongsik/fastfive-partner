const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const TARGET_URL = 'https://www.amazon.com/dp/B091PZDB8X';

async function debugReviewVideosBeforePlay() {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    try {
        console.log(`🔍 Loading: ${TARGET_URL}`);
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 5000));

        const reviewData = await page.evaluate(() => {
            const results = {
                reviewContainersWithVideo: [],
                directVideoTags: [],
                dataVideoUrls: [],
                allScriptData: []
            };

            // Find all reviews
            const reviewElements = document.querySelectorAll('[data-hook="review"]');
            console.log(`Found ${reviewElements.length} reviews`);

            reviewElements.forEach((reviewEl, index) => {
                // Look for any element with data-video-url
                const elementsWithDataVideoUrl = reviewEl.querySelectorAll('[data-video-url]');
                if (elementsWithDataVideoUrl.length > 0) {
                    elementsWithDataVideoUrl.forEach(el => {
                        results.dataVideoUrls.push({
                            reviewIndex: index,
                            tagName: el.tagName,
                            className: el.className,
                            dataVideoUrl: el.getAttribute('data-video-url'),
                            allDataAttributes: Array.from(el.attributes)
                                .filter(attr => attr.name.startsWith('data-'))
                                .map(attr => ({ name: attr.name, value: attr.value })),
                            outerHTML: el.outerHTML.substring(0, 800)
                        });
                    });
                }

                // Look for .vse-video-container BEFORE clicking
                const vseContainer = reviewEl.querySelector('.vse-video-container');
                if (vseContainer) {
                    results.reviewContainersWithVideo.push({
                        reviewIndex: index,
                        className: vseContainer.className,
                        innerHTML: vseContainer.innerHTML.substring(0, 1000),
                        allAttributes: Array.from(vseContainer.attributes).map(attr => ({ name: attr.name, value: attr.value }))
                    });
                }

                // Look for any video or img tags with video-related classes
                const videoRelatedElements = reviewEl.querySelectorAll('img[class*="video"], div[class*="video"], button[class*="video"]');
                if (videoRelatedElements.length > 0) {
                    results.reviewContainersWithVideo.push({
                        reviewIndex: index,
                        elements: Array.from(videoRelatedElements).map(el => ({
                            tagName: el.tagName,
                            className: el.className,
                            src: el.src || null,
                            poster: el.getAttribute('poster') || null,
                            outerHTML: el.outerHTML.substring(0, 500)
                        }))
                    });
                }
            });

            // Search all script tags for video data
            const scripts = document.querySelectorAll('script[type="text/javascript"]');
            scripts.forEach((script, idx) => {
                const text = script.textContent;
                if (text.includes('reviewsState') || text.includes('videoUrl') || text.includes('vse-') || text.includes('.mp4')) {
                    results.allScriptData.push({
                        scriptIndex: idx,
                        sample: text.substring(0, 2000),
                        hasReviewsState: text.includes('reviewsState'),
                        hasVideoUrl: text.includes('videoUrl'),
                        hasMp4: text.includes('.mp4')
                    });
                }
            });

            return results;
        });

        console.log('\n📊 Review Video Analysis (BEFORE CLICKING PLAY):');
        console.log(`\n🎬 Elements with data-video-url: ${reviewData.dataVideoUrls.length}`);
        reviewData.dataVideoUrls.forEach((info, idx) => {
            console.log(`\n--- Element ${idx + 1} (Review #${info.reviewIndex + 1}) ---`);
            console.log(`Tag: <${info.tagName}>`);
            console.log(`Class: ${info.className}`);
            console.log(`data-video-url: ${info.dataVideoUrl}`);
            console.log(`All data-* attributes:`);
            console.log(JSON.stringify(info.allDataAttributes, null, 2));
            console.log(`\nHTML Preview:`);
            console.log(info.outerHTML);
        });

        console.log(`\n📦 .vse-video-container elements: ${reviewData.reviewContainersWithVideo.length}`);
        reviewData.reviewContainersWithVideo.forEach((info, idx) => {
            console.log(`\n--- Container ${idx + 1} ---`);
            console.log(JSON.stringify(info, null, 2));
        });

        console.log(`\n📜 Script tags with video data: ${reviewData.allScriptData.length}`);
        reviewData.allScriptData.forEach((info, idx) => {
            console.log(`\n--- Script ${idx + 1} ---`);
            console.log(`Has reviewsState: ${info.hasReviewsState}`);
            console.log(`Has videoUrl: ${info.hasVideoUrl}`);
            console.log(`Has .mp4: ${info.hasMp4}`);
            console.log(`\nSample:`);
            console.log(info.sample);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        // Keep browser open for manual inspection
        console.log('\n⏸️ Browser will stay open for manual inspection. Close it when done.');
        await new Promise(resolve => setTimeout(resolve, 60000));
        await browser.close();
    }
}

debugReviewVideosBeforePlay();
