const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const path = require('path');

const htmlPath = path.join(__dirname, 'debug_B09V8FHNJ5.html');
const fileUrl = `file://${htmlPath.replace(/\\/g, '/')}`;

async function testExtraction() {
    const browser = await puppeteer.launch({
        headless: "new"
    });
    const page = await browser.newPage();
    await page.goto(fileUrl);

    const extractedVideos = await page.evaluate(() => {
        const videos = [];

        // New Logic for .video-items-metadata
        const metadataEl = document.querySelector('.video-items-metadata');
        if (metadataEl) {
            const dataVideoItems = metadataEl.getAttribute('data-video-items');
            if (dataVideoItems) {
                try {
                    const items = JSON.parse(dataVideoItems);
                    items.forEach(item => {
                        let videoUrl = item.videoURL;

                        // Try to find mp4 in videoPreviewAssets
                        if (item.videoPreviewAssets) {
                            // videoPreviewAssets is a comma separated string: url, label, mime, ...
                            const parts = item.videoPreviewAssets.split(',');
                            for (let i = 0; i < parts.length; i += 3) {
                                const url = parts[i];
                                const mime = parts[i + 2];
                                if (mime && mime.trim() === 'video/mp4') {
                                    videoUrl = url;
                                    break; // Prefer the first mp4 found
                                }
                            }
                        }

                        // Parse duration
                        let durationSeconds = 0;
                        if (item.formattedDuration) {
                            const timeParts = item.formattedDuration.split(':').map(Number);
                            if (timeParts.length === 2) {
                                durationSeconds = timeParts[0] * 60 + timeParts[1];
                            } else if (timeParts.length === 3) {
                                durationSeconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
                            }
                        }

                        videos.push({
                            title: item.title,
                            duration: durationSeconds,
                            thumbnail: item.videoImageUrl,
                            url: videoUrl
                        });
                    });
                } catch (e) {
                    console.error("JSON parse error", e);
                }
            }
        }
        return videos;
    });

    console.log("Extracted Videos:", JSON.stringify(extractedVideos, null, 2));
    await browser.close();
}

testExtraction();
