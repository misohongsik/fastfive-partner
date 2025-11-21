const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const { isSafeProduct } = require('../utils/Product_Filter');

// =======================================================================
// ▼▼▼ 설정 섹션 ▼▼▼
// =======================================================================

const AMAZON_LOGIN = {
    email: 'misohongsik@gmail.com',
    password: '@calla831031'
};
const COOKIE_FILE = path.join(__dirname, '../config/amazon_session.json');

const USE_PROXY = 0;
const PROXY_CONFIG = {
    host: 'proxy.smartproxy.net',
    port: 3120,
    baseUser: 'smart-ABKHOLDINGS_area-US_life-15',
    pass: 'Calla831031'
};

const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: '@Calla831031',
    database: 'amazon',
    port: 3306,
    connectionLimit: 5
};

const SHOW_BROWSER = 1;
const WAIT_TIME_NAVIGATION = 5000;
const POLL_INTERVAL_MS = 15000;

let dbPool;

function generateSessionId() {
    return Math.random().toString(36).substring(2, 10);
}

// =======================================================================
// ▼▼▼ 데이터베이스 관리 ▼▼▼
// =======================================================================

async function initDatabase() {
    console.log("💾 데이터베이스 연결 및 확인 중...");
    try {
        dbPool = mysql.createPool(DB_CONFIG);
        const [productTable] = await dbPool.query("SHOW TABLES LIKE 'amazon_products'");
        if (productTable.length === 0) {
            console.error("❌ 오류: 'amazon_products' 테이블이 없습니다.");
            process.exit(1);
        }

        const [videoColumns] = await dbPool.query("SHOW COLUMNS FROM amazon_products LIKE 'videos_json'");
        if (videoColumns.length === 0) {
            console.error("❌ 오류: 'videos_json' 컬럼이 없습니다.");
            process.exit(1);
        }
        const [reviewColumns] = await dbPool.query("SHOW COLUMNS FROM amazon_products LIKE 'reviews_json'");
        if (reviewColumns.length === 0) {
            console.error("❌ 오류: 'reviews_json' 컬럼이 없습니다.");
            process.exit(1);
        }

        console.log("   ✅ 데이터베이스 준비 완료.");
    } catch (error) {
        console.error("❌ 데이터베이스 초기화 실패:", error);
        process.exit(1);
    }
}

async function getNextTask() {
    const connection = await dbPool.getConnection();
    await connection.beginTransaction();
    try {
        const [rows] = await connection.query(
            `SELECT id, product_url, asin, category_id, rank_in_bsr
             FROM amazon_product_queue
             WHERE status = 'PENDING'
             ORDER BY created_at ASC LIMIT 1 FOR UPDATE`
        );

        if (rows.length > 0) {
            const task = rows[0];
            await connection.query(
                `UPDATE amazon_product_queue SET status = 'PROCESSING', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [task.id]
            );
            await connection.commit();
            return task;
        }

        await connection.commit();
        return null;
    } catch (error) {
        await connection.rollback();
        console.error("❌ 작업 큐 조회 실패:", error);
        return null;
    } finally {
        connection.release();
    }
}

async function markTaskStatus(taskId, status) {
    if (status !== 'COMPLETED' && status !== 'FAILED') return;
    try {
        await dbPool.query(
            `UPDATE amazon_product_queue SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [status, taskId]
        );
    } catch (error) { }
}

async function resetProcessingTasks() {
    try {
        const [result] = await dbPool.query(
            `UPDATE amazon_product_queue SET status = 'PENDING', updated_at = CURRENT_TIMESTAMP WHERE status = 'PROCESSING'`
        );
        if (result.affectedRows > 0) {
            console.log(`   ⏪ ${result.affectedRows}개의 진행 중인 작업을 PENDING으로 복구했습니다.`);
        }
    } catch (error) { }
}

async function saveProductData(data, sourceInfo) {
    const p = data.상품정보;
    if (!p.ASIN || !p.상품명) {
        return { saved: false, reason: 'ASIN 또는 상품명 누락' };
    }

    const filterCheck = isSafeProduct(p.상품명);
    if (!filterCheck.safe) {
        return { saved: false, reason: filterCheck.reason };
    }

    try {
        const query = `
            INSERT INTO amazon_products(
                asin, source_category_id, last_rank_in_bsr, title, brand, price_usd, shipping_usd,
                is_direct_shipping, availability, bullet_points, main_image_url, all_image_urls,
                rating, review_count, videos_json, reviews_json
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                source_category_id = VALUES(source_category_id),
                last_rank_in_bsr = VALUES(last_rank_in_bsr),
                title = VALUES(title),
                price_usd = VALUES(price_usd),
                shipping_usd = VALUES(shipping_usd),
                is_direct_shipping = VALUES(is_direct_shipping),
                availability = VALUES(availability),
                videos_json = VALUES(videos_json),
                reviews_json = VALUES(reviews_json),
                updated_at = CURRENT_TIMESTAMP
        `;

        const params = [
            p.ASIN,
            sourceInfo.category_id || null,
            sourceInfo.rank_in_bsr || null,
            p.상품명,
            p.브랜드 || null,
            p.가격_USD,
            p.배송비_USD,
            p.직배송가능여부 || false,
            p.재고상태 || 'Unknown',
            JSON.stringify(p.특징 || []),
            p.이미지.대표이미지 || null,
            JSON.stringify(p.이미지.썸네일 || []),
            p.평점.점수 || null,
            p.평점.리뷰수 || null,
            JSON.stringify(p.동영상 || []),
            JSON.stringify(p.리뷰_텍스트 || [])
        ];

        const [result] = await dbPool.query(query, params);
        return { saved: result.affectedRows > 0, reason: '' };

    } catch (error) {
        console.error(`❌ 상품 데이터 저장 실패(ASIN: ${p.ASIN}):`, error.message);
        return { saved: false, reason: `DB 오류: ${error.message}` };
    }
}

// =======================================================================
// ▼▼▼ 브라우저 초기화 ▼▼▼
// =======================================================================

async function launchBrowser(sessionId) {
    const args = [
        '--no-sandbox', '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--lang=en-US,en'
    ];
    if (USE_PROXY === 1) {
        args.push(`--proxy-server=http://${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`);
    }
    const browser = await puppeteer.launch({
        headless: SHOW_BROWSER === 0 ? "new" : false,
        args: args,
        ignoreDefaultArgs: ["--enable-automation"],
    });
    const page = await browser.newPage();
    if (USE_PROXY === 1) {
        const proxyUser = `${PROXY_CONFIG.baseUser}_session-${sessionId}`;
        await page.authenticate({ username: proxyUser, password: PROXY_CONFIG.pass });
    }
    return { browser, page };
}

async function saveCookies(page) {
    const cookies = await page.cookies();
    fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2));
}

async function loadCookies(page) {
    if (fs.existsSync(COOKIE_FILE)) {
        try {
            const cookiesString = fs.readFileSync(COOKIE_FILE);
            const cookies = JSON.parse(cookiesString);
            await page.setCookie(...cookies);
            return true;
        } catch (error) { return false; }
    }
    return false;
}

async function checkLoginStatus(page) {
    try {
        await page.goto("https://www.amazon.com", { waitUntil: "domcontentloaded", timeout: 45000 });
        const isBotCheck = await page.evaluate(() => {
            return document.title.includes("Robot Check") || !!document.querySelector('form[action*="/errors/validateCaptcha"]');
        });
        if (isBotCheck) {
            console.log("⚠️ 봇 탐지(Captcha) 감지됨.");
            return false;
        }
        const signInText = await page.$eval('#nav-link-accountList-nav-line-1', el => el.textContent || '').catch(() => '');
        if (signInText && !signInText.includes("sign in") && !signInText.includes("로그인")) {
            console.log("✅ 로그인 상태 확인됨.");
            return true;
        }
    } catch (error) {
        console.error("❌ 로그인 상태 확인 중 에러:", error.message);
    }
    return false;
}

async function performAmazonLogin(page) {
    console.log("🔑 아마존 로그인 시도 중...");
    try {
        await page.goto('https://www.amazon.com/ap/signin?open id.pape.max_auth_age=0&openid.return_to=https%3A%2F%2Fwww.amazon.com%2F&openid.assoc_handle=usflex&openid.mode=checkid_setup&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0', { waitUntil: 'networkidle0' });

        await page.waitForSelector('#ap_email', { visible: true, timeout: 15000 });
        await page.type('#ap_email', AMAZON_LOGIN.email, { delay: 50 });
        await page.click('#continue');

        await page.waitForSelector('#ap_password', { visible: true, timeout: 15000 });
        await page.type('#ap_password', AMAZON_LOGIN.password, { delay: 50 });
        await page.evaluate(() => {
            const checkbox = document.querySelector('input[name="rememberMe"]');
            if (checkbox && !checkbox.checked) checkbox.click();
        });
        await page.click('#signInSubmit');

        console.log("===================================================================");
        console.log(" 🛑 2단계 인증(OTP) 또는 캡챠가 나타나면, 90초 내에 수동으로 처리해주세요.");
        console.log('===================================================================');
        try {
            await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 90000 });
            const url = page.url();
            if (url.includes('/ap/mfa') || url.includes('/ap/cvf')) {
                console.log("⚠️ 2단계 인증 감지됨. 추가 입력 대기 중...");
                await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 90000 });
            }
        } catch (error) {
            const url = page.url();
            if (url.includes('validateCaptcha') || url.includes('signin')) {
                console.error("❌ 로그인 실패: 시간 초과 (90초).");
                return false;
            }
        }

        const finalCheck = await checkLoginStatus(page);
        if (finalCheck) {
            await saveCookies(page);
            return true;
        }
        return false;

    } catch (error) {
        console.error("❌ 로그인 중 에러 발생:", error.message);
        return false;
    }
}

// =======================================================================
// ▼▼▼ 크롤링 스크립트 (리뷰 비디오 URL 수집 포함) ▼▼▼
// =======================================================================

const crawlScript = `
async function crawlProductData() {
    async function waitForElement(selector, timeout = 15000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            const element = document.querySelector(selector);
            if (element) return element;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return null;
    }

    const productData = {
        URL: window.location.href,
        상품정보: {}
    };

    try {
        const titleElement = await waitForElement('#productTitle', 15000);
        if (!titleElement) {
            if (document.title.includes("Robot Check")) {
                throw new Error('BOT_DETECTED');
            }
            if (document.querySelector('#g') || document.title.includes("Page Not Found")) {
                throw new Error('PRODUCT_UNAVAILABLE');
            }
            throw new Error('상품명을 찾을 수 없습니다');
        }

        window.scrollBy(0, Math.floor(Math.random() * 800) + 500);
        await new Promise(resolve => setTimeout(resolve, 1000));

        productData.상품정보.상품명 = titleElement.textContent.trim();

        const asinMatch = window.location.pathname.match(/\\/dp\\/([A-Z0-9]{10})/);
        productData.상품정보.ASIN = asinMatch ? asinMatch[1] : null;

        const brandElement = document.querySelector('#bylineInfo');
        productData.상품정보.브랜드 = brandElement ? brandElement.textContent.trim() : '';

        const priceElement = document.querySelector('#corePrice_feature_div .a-price .a-offscreen') ||
                             document.querySelector('.a-price[data-a-color="base"] .a-offscreen');

        let productPrice = null;
        productData.상품정보.가격_USD = null;

        if (priceElement) {
            const priceText = priceElement.textContent.trim();
            const priceNumber = parseFloat(priceText.replace(/[^0-9.]/g, ''));
            if (!isNaN(priceNumber)) {
                productPrice = priceNumber;
                productData.상품정보.가격_USD = priceNumber;
            }
        }

        const availabilityElement = document.querySelector('#availability span');
        productData.상품정보.재고상태 = availabilityElement ? availabilityElement.textContent.trim() : 'Unknown';

        let deliveryMessageElement = document.querySelector('#deliveryMessageMirId') ||
                                     document.querySelector('#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE');

        let shippingText = deliveryMessageElement ? deliveryMessageElement.textContent.trim() : '';

        const isDirectShipping = shippingText.includes('Korea') || shippingText.includes('대한민국');
        productData.상품정보.직배송가능여부 = isDirectShipping;
        productData.상품정보.배송비_USD = null;

        if (isDirectShipping) {
            let shippingCostExtracted = false;

            if (shippingText.match(/(FREE|무료)/i)) {
                productData.상품정보.배송비_USD = 0;
                shippingCostExtracted = true;
            } else {
                const shippingMatch = shippingText.match(/\\$([0-9.]+)\\s*(delivery|shipping|import fees deposit)/i);
                if (shippingMatch) {
                    const shippingNumber = parseFloat(shippingMatch[1]);
                    if (!isNaN(shippingNumber)) {
                        productData.상품정보.배송비_USD = shippingNumber;
                        shippingCostExtracted = true;
                    }
                }
            }
            
            if (!shippingCostExtracted) {
                productData.상품정보.배송비_USD = (productPrice !== null && productPrice >= 49) ? 0 : 10;
            }
        }

        const ratingElement = document.querySelector('#acrPopover .a-icon-alt');
        const ratingCountElement = document.querySelector('#acrCustomerReviewText');
        productData.상품정보.평점 = {
            점수: ratingElement ? ratingElement.textContent.trim() : '',
            리뷰수: ratingCountElement ? ratingCountElement.textContent.trim() : ''
        };

        productData.상품정보.이미지 = { 썸네일: [], 대표이미지: '' };
        productData.상품정보.동영상 = [];
        const imageUrls = new Set();

        const scripts = document.querySelectorAll('script[type="text/javascript"]');
        let imagesFound = false;
        let videosFound = false;

        for (const script of scripts) {
            if (!script.textContent) continue;
            const text = script.textContent;

            if (!imagesFound && text.includes('colorImages')) {
                try {
                    const imgRegex = /['"]colorImages['"]\\s*:\\s*{\\s*['"]initial['"]\\s*:\\s*(\\[[\\s\\S]*?\\])/;
                    const imgMatch = text.match(imgRegex);
                    if (imgMatch && imgMatch[1]) {
                        try {
                            const imagesData = JSON.parse(imgMatch[1]);
                            imagesData.forEach(imgData => {
                                if (imgData.hiRes) imageUrls.add(imgData.hiRes);
                                else if (imgData.large) imageUrls.add(imgData.large);
                            });
                            if (imageUrls.size > 0) imagesFound = true;
                        } catch (e) {}
                    }
                } catch (e) {}
            }

            if (!videosFound && text.includes('videoGalleryData')) {
                try {
                    const regex = /['"]videoGalleryData['"]\\s*:\\s*(\\{[\\s\\S]*?\\})(?=\\s*,\\s*['"]|$|\\s*\\);|\\s*\\}\\);)/;
                    const match = text.match(regex);
                    
                    if (match && match[1]) {
                        try {
                            let jsonString = match[1].trim();
                            // Trailing comma 제거 (JSON 파싱 강화)  
                            jsonString = jsonString.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
                            if (jsonString.startsWith('{') && jsonString.endsWith('}')) {
                                const galleryData = JSON.parse(jsonString);
                                if (galleryData.videos && Array.isArray(galleryData.videos)) {
                                    galleryData.videos.forEach(video => {
                                        productData.상품정보.동영상.push({
                                            title: video.title || '',
                                            duration: video.durationSeconds || '',
                                            thumbnail: video.thumbUrl || '',
                                            url: video.videoUrl || null
                                        });
                                    });
                                    if (productData.상품정보.동영상.length > 0) videosFound = true;
                                }
                            }
                        } catch(e) {}
                    }
                } catch (e) {}
            }

            if (imagesFound && videosFound) break;
        }
        // New Logic: Check for .video-items-metadata (vse-video-items)
        if (!videosFound) {
            const metadataEl = document.querySelector('.video-items-metadata');
            if (metadataEl) {
                const dataVideoItems = metadataEl.getAttribute('data-video-items');
                if (dataVideoItems) {
                    try {
                        const items = JSON.parse(dataVideoItems);
                        if (Array.isArray(items) && items.length > 0) {
                            items.forEach(item => {
                                let videoUrl = item.videoURL;
                                
                                // Try to find mp4 in videoPreviewAssets
                                if (item.videoPreviewAssets) {
                                    const parts = item.videoPreviewAssets.split(',');
                                    for (let i = 0; i < parts.length; i += 3) {
                                        const url = parts[i];
                                        const mime = parts[i+2];
                                        if (mime && mime.trim() === 'video/mp4') {
                                            videoUrl = url;
                                            break; 
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

                                productData.상품정보.동영상.push({
                                    title: item.title || '',
                                    duration: durationSeconds || '',
                                    thumbnail: item.videoImageUrl || '',
                                    url: videoUrl
                                });
                            });
                            if (productData.상품정보.동영상.length > 0) videosFound = true;
                        }
                    } catch (e) {}
                }
            }
        }

                    // Fallback 1: .mp4 URL 직접 검색 (videoGalleryData가 없을 때)
        if (!videosFound) {
            for (const script of scripts) {
                if (!script.textContent) continue;
                const mp4Regex = /https?:\\/\\/[^\\s"']+\\.mp4/g;
                const mp4Urls = script.textContent.match(mp4Regex);
                if (mp4Urls && mp4Urls.length > 0) {
                    mp4Urls.forEach(url => {
                        productData.상품정보.동영상.push({
                            title: '',
                            duration: '',
                            thumbnail: '',
                            url: url
                        });
                    });
                    videosFound = true;
                    break;
                }
            }
        }

        // Fallback 2: DOM <video> 태그 직접 검색
        if (!videosFound) {
            const videoElements = document.querySelectorAll('video');
            videoElements.forEach(video => {
                let videoUrl = video.src;
                if (!videoUrl) {
                    const sourceEl = video.querySelector('source');
                    if (sourceEl) videoUrl = sourceEl.src;
                }
                if (videoUrl && !videoUrl.startsWith('blob:')) {
                    productData.상품정보.동영상.push({
                        title: '',
                        duration: '',
                        thumbnail: video.poster || '',
                        url: videoUrl
                    });
                }
            });
        }


        if (imageUrls.size === 0) {
            const thumbnailList = document.querySelectorAll('#altImages img');
            thumbnailList.forEach(img => {
                if (img.src && img.src.includes('images/I/')) {
                    let highResUrl = img.src.replace(/\\._.*_\\./g, '.');
                    imageUrls.add(highResUrl);
                }
            });
        }

        productData.상품정보.이미지.썸네일 = Array.from(imageUrls);
        if (productData.상품정보.이미지.썸네일.length > 0) {
            productData.상품정보.이미지.대표이미지 = productData.상품정보.이미지.썸네일[0];
        }

        productData.상품정보.특징 = [];
        const descriptionElements = document.querySelectorAll('#feature-bullets ul li span.a-list-item');
        descriptionElements.forEach(span => {
            if (span.textContent.trim()) {
                productData.상품정보.특징.push(span.textContent.trim());
            }
        });

        // 리뷰 수집 (비디오 URL 포함)
        productData.상품정보.리뷰_텍스트 = [];
        const multimediaReviews = [];
        const textOnlyReviews = [];

        const reviewElements = document.querySelectorAll('[data-hook="review"]');
        
        reviewElements.forEach(reviewEl => {
            const titleEl = reviewEl.querySelector('[data-hook="review-title"]');
            const bodyEl = reviewEl.querySelector('[data-hook="review-body"] span');
            const ratingEl = reviewEl.querySelector('[data-hook="review-star-rating"] .a-icon-alt');

            if (titleEl && bodyEl && ratingEl) {
                let titleText = titleEl.textContent.trim();
                titleText = titleText.replace(/^[0-5]\\.[0-9] out of 5 stars/i, '').trim();

                const media_urls = [];
                
                // 리뷰 이미지 수집
                const imageElements = reviewEl.querySelectorAll('[data-hook="review-image-tile"] img');
                imageElements.forEach(img => {
                    if (img.src) {
                        let highResUrl = img.src.replace(/\\._.*_\\./g, '.');
                        media_urls.push({ type: 'image', url: highResUrl });
                    }
                });

                // 리뷰 비디오 URL 수집
                const videoContainer = reviewEl.querySelector('.vse-video-container');
                if (videoContainer) {
                    const videoSource = videoContainer.querySelector('video source');
                    if (videoSource && videoSource.src) {
                        media_urls.push({ type: 'video', url: videoSource.src });
                    } else {
                        const videoElement = videoContainer.querySelector('video');
                        if (videoElement && videoElement.src) {
                            media_urls.push({ type: 'video', url: videoElement.src });
                        } else {
                            const videoUrl = videoContainer.getAttribute('data-video-url');
                            if (videoUrl) {
                                media_urls.push({ type: 'video', url: videoUrl });
                            } else {
                                const videoThumbnail = videoContainer.querySelector('img');
                                if (videoThumbnail && videoThumbnail.src) {
                                    let highResUrl = videoThumbnail.src.replace(/\\._.*_\\./g, '.');
                                    media_urls.push({ type: 'video_thumbnail', url: highResUrl });
                                }
                            }
                        }
                    }
                }

                const reviewData = {
                    title: titleText,
                    text: bodyEl.textContent.trim(),
                    rating: ratingEl.textContent.trim(),
                    media_url: media_urls.length > 0 ? media_urls : null
                };

                if (media_urls.length > 0) {
                    multimediaReviews.push(reviewData);
                } else {
                    textOnlyReviews.push(reviewData);
                }
            }
        });

        productData.상품정보.리뷰_텍스트 = [...multimediaReviews, ...textOnlyReviews].slice(0, 3);

        return productData;

    } catch (error) {
        return { error: error.message };
    }
}
crawlProductData();
`;

// =======================================================================
// ▼▼▼ 메인 실행 로직 ▼▼▼
// =======================================================================

async function runDetailCrawler() {
    await initDatabase();

    let browser;
    let page;
    let processedCount = 0;

    async function initializeBrowser() {
        console.log("\n🔄 브라우저 시작/재시작 및 초기화 중...");
        await resetProcessingTasks();

        if (browser) {
            try { await browser.close(); } catch (e) { }
        }

        const sessionId = generateSessionId();

        if (USE_PROXY === 1) {
            console.log(`   🔑 새 Proxy Session ID: ${sessionId}`);
        } else {
            console.log(`   🔑 로컬 IP로 브라우저 시작 중...`);
        }

        try {
            const launched = await launchBrowser(sessionId);
            browser = launched.browser;
            page = launched.page;
        } catch (error) {
            console.error("❌ 브라우저 실행 실패:", error.message);
            return false;
        }

        await loadCookies(page);
        if (!(await checkLoginStatus(page))) {
            console.log("⚠️ 로그인 세션 만료 또는 봇 탐지됨. 재로그인 시도.");
            if (!(await performAmazonLogin(page))) {
                return false;
            }
        }
        return true;
    }

    if (!(await initializeBrowser())) {
        if (!(await initializeBrowser())) {
            console.error("🛑 최종 로그인 실패로 스크립트를 종료합니다.");
            if (browser) await browser.close();
            if (dbPool) await dbPool.end();
            return;
        }
    }

    console.log("\n🚀 3단계: 상세 크롤링 시작 (작업 큐 폴링 중)...");
    let currentTask;

    while (true) {
        currentTask = await getNextTask();

        if (currentTask === null) {
            console.log(`\n💤 대기 중: 처리할 작업이 없습니다. ${POLL_INTERVAL_MS / 1000}초 후 다시 확인합니다.`);
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
            continue;
        }

        processedCount++;
        console.log(`\n[${processedCount}] 처리 중: ASIN ${currentTask.asin} (Queue ID: ${currentTask.id})`);

        try {
            await page.goto(currentTask.product_url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await new Promise(resolve => setTimeout(resolve, WAIT_TIME_NAVIGATION));

            const data = await page.evaluate(crawlScript);

            if (data && data.상품정보 && data.상품정보.ASIN) {
                if (data.상품정보.ASIN !== currentTask.asin) {
                    throw new Error("ASIN_MISMATCH");
                }

                if (data.상품정보.직배송가능여부 === true) {
                    const saveResult = await saveProductData(data, currentTask);

                    if (saveResult.saved) {
                        console.log(`   ✅ 저장 성공 (직배송 O): ${data.상품정보.상품명.substring(0, 60)}...`);

                        const videoCount = data.상품정보.동영상 ? data.상품정보.동영상.length : 0;
                        const reviewCount = data.상품정보.리뷰_텍스트 ? data.상품정보.리뷰_텍스트.length : 0;
                        const priceLog = data.상품정보.가격_USD !== null ? `$${data.상품정보.가격_USD}` : 'N/A';
                        const shippingLog = data.상품정보.배송비_USD !== null ? `$${data.상품정보.배송비_USD}` : 'N/A';

                        console.log(`      💰 가격: ${priceLog} | 🚚 배송비: ${shippingLog} | 🎬 동영상: ${videoCount}개 | 📝 리뷰: ${reviewCount}개`);

                        // 리뷰 비디오 URL 로깅
                        if (data.상품정보.리뷰_텍스트 && data.상품정보.리뷰_텍스트.length > 0) {
                            let reviewVideoCount = 0;
                            let reviewImageCount = 0;
                            let reviewVideoThumbnailCount = 0;

                            data.상품정보.리뷰_텍스트.forEach(review => {
                                if (review.media_url && Array.isArray(review.media_url)) {
                                    review.media_url.forEach(media => {
                                        if (media.type === 'video') {
                                            reviewVideoCount++;
                                        } else if (media.type === 'image') {
                                            reviewImageCount++;
                                        } else if (media.type === 'video_thumbnail') {
                                            reviewVideoThumbnailCount++;
                                        }
                                    });
                                }
                            });

                            if (reviewVideoCount > 0 || reviewImageCount > 0 || reviewVideoThumbnailCount > 0) {
                                const parts = [];
                                if (reviewImageCount > 0) parts.push(`이미지 ${reviewImageCount}개`);
                                if (reviewVideoCount > 0) parts.push(`🎥 비디오 ${reviewVideoCount}개`);
                                if (reviewVideoThumbnailCount > 0) parts.push(`썸네일 ${reviewVideoThumbnailCount}개`);
                                console.log(`      📸 리뷰 미디어: ${parts.join(' | ')}`);
                            }
                        }

                        await markTaskStatus(currentTask.id, 'COMPLETED');
                    } else {
                        console.log(`   🚫 저장 실패: ${saveResult.reason}`);
                        console.log(`      상품명: ${data.상품정보.상품명.substring(0, 60)}...`);
                        await markTaskStatus(currentTask.id, 'COMPLETED');
                    }
                } else {
                    console.log(`   ℹ️ 저장 건너뜀 (직배송 X): ${data.상품정보.상품명.substring(0, 60)}...`);
                    await markTaskStatus(currentTask.id, 'COMPLETED');
                }

            } else if (data && data.error) {
                if (data.error === 'BOT_DETECTED') {
                    throw new Error("BOT_DETECTED");
                } else if (data.error === 'PRODUCT_UNAVAILABLE') {
                    console.log("   ⚠️ 상품 판매 중지 또는 삭제됨. FAILED 처리 후 다음 작업 진행.");
                    await markTaskStatus(currentTask.id, 'FAILED');
                } else {
                    throw new Error(`CRAWL_FAILED: ${data.error}`);
                }
            } else {
                throw new Error("CRAWL_FAILED: 데이터 누락");
            }

        } catch (error) {
            console.error(`   ❌ 오류 발생: ${error.message}`);

            if (error.message?.includes('ERR_PROXY') || error.name === 'TimeoutError' || error.message?.includes('net::ERR') || error.message === 'BOT_DETECTED') {
                console.log("🌐 네트워크 오류 또는 봇 탐지. 브라우저 재시작.");

                if (!(await initializeBrowser())) {
                    console.error("🛑 브라우저 재시작 실패. 스크립트 종료.");
                    if (browser) await browser.close();
                    if (dbPool) await dbPool.end();
                    return;
                }

            } else {
                console.log("   ⚠️ 처리 실패 (재시도 안함). FAILED 처리 후 다음 작업 진행.");
                await markTaskStatus(currentTask.id, 'FAILED');
            }
        }
    }
}

runDetailCrawler();