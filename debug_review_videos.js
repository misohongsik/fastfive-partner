const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const TARGET_URL = 'https://www.amazon.com/dp/B091PZDB8X';

async function debugReviewVideos() {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    try {
        console.log(`🔍 Loading: ${TARGET_URL}`);
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 3000));

        const reviewData = await page.evaluate(() => {
            const results = {
                totalReviews: 0,
                reviewsWithMedia: 0,
                videoContainers: [],
                htmlSamples: []
            };

            const reviewElements = document.querySelectorAll('[data-hook="review"]');
            results.totalReviews = reviewElements.length;

            reviewElements.forEach((reviewEl, index) => {
                // Check for video container
                const videoContainer = reviewEl.querySelector('.vse-video-container');
                if (videoContainer) {
                    results.reviewsWithMedia++;

                    const videoInfo = {
                        index: index,
                        outerHTML: videoContainer.outerHTML.substring(0, 500),
                        hasVideoTag: !!videoContainer.querySelector('video'),
                        hasSourceTag: !!videoContainer.querySelector('video source'),
                        videoSrc: null,
                        sourceSrc: null,
                        dataVideoUrl: videoContainer.getAttribute('data-video-url'),
                        className: videoContainer.className,
                        allAttributes: {}
                    };

                    // Get all attributes
                    for (let attr of videoContainer.attributes) {
                        videoInfo.allAttributes[attr.name] = attr.value;
                    }

                    const video = videoContainer.querySelector('video');
                    if (video) {
                        videoInfo.videoSrc = video.src;
                        const source = video.querySelector('source');
                        if (source) {
                            videoInfo.sourceSrc = source.src;
                        }
                    }

                    results.videoContainers.push(videoInfo);

                    if (index < 2) {
                        results.htmlSamples.push({
                            index: index,
                            html: reviewEl.outerHTML.substring(0, 1000)
                        });
                    }
                }
            });

            return results;
        });

        console.log('\n📊 Review Video Analysis:');
        console.log(`Total Reviews: ${reviewData.totalReviews}`);
        console.log(`Reviews with Media: ${reviewData.reviewsWithMedia}`);
        console.log(`\n🎥 Video Containers Found: ${reviewData.videoContainers.length}`);

        reviewData.videoContainers.forEach((info, idx) => {
            console.log(`\n--- Video Container ${idx + 1} (Review #${info.index + 1}) ---`);
            console.log(`Class Name: ${info.className}`);
            console.log(`Has <video> tag: ${info.hasVideoTag}`);
            console.log(`Has <source> tag: ${info.hasSourceTag}`);
            console.log(`Video.src: ${info.videoSrc || 'null'}`);
            console.log(`Source.src: ${info.sourceSrc || 'null'}`);
            console.log(`data-video-url: ${info.dataVideoUrl || 'null'}`);
            console.log(`\nAll Attributes:`);
            console.log(JSON.stringify(info.allAttributes, null, 2));
            console.log(`\nHTML Preview:`);
            console.log(info.outerHTML);
        });

        console.log(`\n📄 HTML Samples (first 2 reviews with videos):`);
        reviewData.htmlSamples.forEach(sample => {
            console.log(`\n--- Review #${sample.index + 1} HTML ---`);
            console.log(sample.html);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await browser.close();
    }
}

debugReviewVideos();
