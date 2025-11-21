const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process'); // 외부 스크립트 실행을 위해 추가

// =======================================================================
// ▼▼▼ 설정 섹션 (수정됨) ▼▼▼
// =======================================================================

// --- 로그인 설정 ---
const AMAZON_LOGIN = {
    email: 'misohongsik@gmail.com',
    password: '@calla831031'
};
const COOKIE_FILE = path.join(__dirname, '../config/amazon_session.json');

// --- IP 변경 설정 (프록시 대체) ---
// 외부 스크립트 경로 설정 (Windows 경로 표기 시 \\ 사용)
const IP_CHANGE_SCRIPT_PATH = 'C:\\Users\\misoh\\Coupang_NaverBlog_Project\\Amazon\\utils\\change-ip_basic.js';
// 기존 프록시 설정(USE_PROXY, PROXY_CONFIG)은 제거되었습니다.

// --- DB 설정 (Connection Pool 사용) ---
const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: '@Calla831031',
    database: 'amazon',
    port: 3306,
    connectionLimit: 5
};

// --- 크롤링 설정 ---
const SHOW_BROWSER = 1;
const WAIT_TIME_NAVIGATION = 5000; // 페이지 로드 후 대기 시간 (ms)
const POLL_INTERVAL_MS = 15000; // 큐에 작업이 없을 때 대기 시간 (15초)

// =======================================================================
// ▲▲▲ 설정 섹션 종료 ▲▲▲
// =======================================================================

let dbPool;
let browser; // initializeBrowser에서 접근하기 위해 전역 범위로 이동
let page;    // initializeBrowser에서 접근하기 위해 전역 범위로 이동


// [신규] IP 변경 스크립트 실행 함수
function executeIpChangeScript() {
    console.log(`\n📞 IP 변경 스크립트 실행 중... (${IP_CHANGE_SCRIPT_PATH})`);
    try {
        // 스크립트를 동기적으로 실행합니다. (완료될 때까지 대기)
        // stdio: 'inherit'는 외부 스크립트의 출력을 현재 콘솔에 표시합니다.
        execSync(`node "${IP_CHANGE_SCRIPT_PATH}"`, { stdio: 'inherit' });
        console.log("✅ IP 변경 스크립트 실행 완료.");
        return true;
    } catch (error) {
        console.error("❌ IP 변경 스크립트 실행 실패:", error);
        // 스크립트 실행 실패 시 (예: 파일을 찾을 수 없거나 스크립트 자체 오류)
        return false;
    }
}


// =======================================================================
// ▼▼▼ 데이터베이스 관리 및 작업 큐 처리 (핵심 로직) ▼▼▼
// =======================================================================

async function initDatabase() {
    console.log("💾 데이터베이스 연결 및 확인 중...");
    try {
        dbPool = mysql.createPool(DB_CONFIG);
        const [productTable] = await dbPool.query("SHOW TABLES LIKE 'amazon_products'");
        if (productTable.length === 0) {
            console.error("❌ 오류: 'amazon_products' 테이블이 없습니다. SQL 스크립트를 먼저 실행해주세요.");
            process.exit(1);
        }

        // [신규] videos_json 컬럼 존재 확인
        const [columns] = await dbPool.query("SHOW COLUMNS FROM amazon_products LIKE 'videos_json'");
        if (columns.length === 0) {
            console.error("❌ 오류: 'amazon_products' 테이블에 'videos_json' 컬럼이 없습니다. 상단의 ALTER TABLE 쿼리를 실행해주세요.");
            process.exit(1);
        }

        console.log("   ✅ 데이터베이스 준비 완료.");
    } catch (error) {
        console.error("❌ 데이터베이스 초기화 실패:", error);
        process.exit(1);
    }
}

// 다음 작업 가져오기 (원자적 처리: PENDING -> PROCESSING)
async function getNextTask() {
    const connection = await dbPool.getConnection();
    await connection.beginTransaction();
    try {
        // 1. PENDING 상태인 작업을 하나 선택하고 잠금 (FOR UPDATE)
        const [rows] = await connection.query(
            `SELECT id, product_url, asin, category_id, rank_in_bsr
             FROM amazon_product_queue
             WHERE status = 'PENDING'
             ORDER BY created_at ASC LIMIT 1 FOR UPDATE`
        );

        if (rows.length > 0) {
            const task = rows[0];
            // 2. 상태를 PROCESSING으로 변경
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

// 작업 상태 업데이트 (COMPLETED 또는 FAILED)
async function markTaskStatus(taskId, status) {
    if (status !== 'COMPLETED' && status !== 'FAILED') return;
    try {
        await dbPool.query(
            `UPDATE amazon_product_queue SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [status, taskId]
        );
    } catch (error) {
        console.error("❌ 작업 상태 업데이트 실패:", error);
    }
}

// [장애 복구] 작업 상태 되돌리기 (브라우저 재시작/스크립트 시작 시 호출)
async function resetProcessingTasks() {
    try {
        const [result] = await dbPool.query(
            `UPDATE amazon_product_queue SET status = 'PENDING', updated_at = CURRENT_TIMESTAMP WHERE status = 'PROCESSING'`
        );
        if (result.affectedRows > 0) {
            console.log(`   ⏪ ${result.affectedRows}개의 진행 중인 작업을 PENDING으로 복구했습니다.`);
        }
    } catch (error) {
        console.error("❌ 작업 상태 복구 실패:", error);
    }
}


// 상품 데이터 저장 (최종 DB 저장)
// [수정됨] 동영상 정보(videos_json) 저장 추가
async function saveProductData(data, sourceInfo) {
    const p = data.상품정보;
    if (!p.ASIN || !p.상품명) return false;

    try {
        // INSERT ... ON DUPLICATE KEY UPDATE: 이미 존재하면 최신 정보로 갱신
        // videos_json 컬럼 추가됨
        const query = `
            INSERT INTO amazon_products (
                asin, source_category_id, last_rank_in_bsr, title, brand, price_usd, shipping_usd,
                is_direct_shipping, availability, bullet_points, main_image_url, all_image_urls,
                rating, review_count, videos_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                source_category_id = VALUES(source_category_id),
                last_rank_in_bsr = VALUES(last_rank_in_bsr),
                title = VALUES(title),
                price_usd = VALUES(price_usd),
                shipping_usd = VALUES(shipping_usd),
                is_direct_shipping = VALUES(is_direct_shipping),
                availability = VALUES(availability),
                videos_json = VALUES(videos_json),
                updated_at = CURRENT_TIMESTAMP
        `;

        const params = [
            p.ASIN,
            sourceInfo.category_id || null,
            sourceInfo.rank_in_bsr || null,
            p.상품명,
            p.브랜드 || null,
            p.가격_USD || null,
            p.배송비_USD || null,
            p.직배송가능여부 || false,
            p.재고상태 || 'Unknown',
            JSON.stringify(p.특징 || []),
            p.이미지.대표이미지 || null,
            JSON.stringify(p.이미지.썸네일 || []),
            p.평점.점수 || null,
            p.평점.리뷰수 || null,
            JSON.stringify(p.동영상 || []) // [신규] 동영상 정보 추가
        ];

        const [result] = await dbPool.query(query, params);
        return result.affectedRows > 0;

    } catch (error) {
        console.error(`❌ 상품 데이터 저장 실패 (ASIN: ${p.ASIN}):`, error.message);
        return false;
    }
}

// =======================================================================
// ▼▼▼ 브라우저 초기화 및 로그인 관리 (수정됨) ▼▼▼
// =======================================================================

// [수정됨] 프록시 설정 제거, SessionId 인자 제거
async function launchBrowser() {
    const args = [
        '--no-sandbox', '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--lang=en-US,en'
    ];

    // 프록시 관련 코드(USE_PROXY 체크 및 --proxy-server 추가) 제거됨

    const browser = await puppeteer.launch({
        headless: SHOW_BROWSER === 0 ? "new" : false,
        args: args,
        ignoreDefaultArgs: ["--enable-automation"],
    });
    const page = await browser.newPage();

    // 프록시 인증 코드(page.authenticate) 제거됨

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
        // 타임아웃을 45초로 넉넉하게 설정
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
        await page.goto('https://www.amazon.com/ap/signin?openid.pape.max_auth_age=0&openid.return_to=https%3A%2F%2Fwww.amazon.com%2F&openid.assoc_handle=usflex&openid.mode=checkid_setup&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0', { waitUntil: 'networkidle0' });

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
// ▼▼▼ 3단계: 상세 크롤링 스크립트 (핵심 로직) ▼▼▼
// =======================================================================
// 주의: 이 스크립트는 브라우저 컨텍스트(page.evaluate) 내에서 실행됩니다.
// [수정됨] 동영상 정보 추출 로직 추가
const crawlScript = `
async function crawlProductData() {

    // 요소 대기 함수 (내부용)
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
            // 상품 페이지가 아닌 경우 (예: 품절, 삭제된 상품, 404)
            if (document.querySelector('#g') || document.title.includes("Page Not Found")) {
                 throw new Error('PRODUCT_UNAVAILABLE');
            }
            throw new Error('상품명을 찾을 수 없습니다 (페이지 로드 실패 가능성)');
        }

        // 랜덤 스크롤
        window.scrollBy(0, Math.floor(Math.random() * 500) + 300);
        await new Promise(resolve => setTimeout(resolve, 500));


        // 1. 제품명
        productData.상품정보.상품명 = titleElement.textContent.trim();

        // 2. ASIN (URL에서 재확인)
        // ⚠️ 이스케이프 주의: /\\/dp\\/([A-Z0-9]{10})/
        const asinMatch = window.location.pathname.match(/\\/dp\\/([A-Z0-9]{10})/);
        productData.상품정보.ASIN = asinMatch ? asinMatch[1] : null;

        // 3. 브랜드
        const brandElement = document.querySelector('#bylineInfo');
        productData.상품정보.브랜드 = brandElement ? brandElement.textContent.trim() : '';

        // 4. 가격 정보 (숫자 형식으로 추출)
        const priceElement = document.querySelector('#corePrice_feature_div .a-price .a-offscreen') ||
                             document.querySelector('.a-price[data-a-color="base"] .a-offscreen');

        if (priceElement) {
            const priceText = priceElement.textContent.trim();
            const priceNumber = parseFloat(priceText.replace(/[^0-9.]/g, ''));
            if (!isNaN(priceNumber)) {
                productData.상품정보.가격_USD = priceNumber;
            }
        }

        // 5. 재고 상태
        const availabilityElement = document.querySelector('#availability span');
        productData.상품정보.재고상태 = availabilityElement ? availabilityElement.textContent.trim() : 'Unknown';


        // 6. 배송 정보 및 배송비 (로그인되어 한국으로 설정된 기준)
        let deliveryMessageElement = document.querySelector('#deliveryMessageMirId') ||
                                     document.querySelector('#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE');

        let shippingText = deliveryMessageElement ? deliveryMessageElement.textContent.trim() : '';

        // 직배송 가능 여부 추정
        const isDirectShipping = shippingText.includes('Korea') || shippingText.includes('대한민국');
        productData.상품정보.직배송가능여부 = isDirectShipping;

        if (isDirectShipping) {
            // ⚠️ 이스케이프 주의: /\\$([0-9.]+)\\s*(delivery|shipping)/i
            const shippingMatch = shippingText.match(/\\$([0-9.]+)\\s*(delivery|shipping)/i);
            if (shippingMatch) {
                const shippingNumber = parseFloat(shippingMatch[1]);
                if (!isNaN(shippingNumber)) {
                    productData.상품정보.배송비_USD = shippingNumber;
                }
            }
        }


        // 7. 평점 및 리뷰 수
        const ratingElement = document.querySelector('#acrPopover .a-icon-alt');
        const ratingCountElement = document.querySelector('#acrCustomerReviewText');
        productData.상품정보.평점 = {
            점수: ratingElement ? ratingElement.textContent.trim() : '',
            리뷰수: ratingCountElement ? ratingCountElement.textContent.trim() : ''
        };

        // 8. 이미지 및 동영상 수집 (스크립트 태그 파싱)
        productData.상품정보.이미지 = { 썸네일: [], 대표이미지: '' };
        productData.상품정보.동영상 = []; // [신규] 동영상 배열 초기화
        const imageUrls = new Set();

        // 스크립트 태그에서 데이터 JSON 파싱 시도 (이미지와 동영상은 보통 같은 스크립트에 있음)
        // XPath를 사용하여 'colorImages' 또는 'videos': 키워드를 포함하는 스크립트 탐색
        const dataScript = document.evaluate(
            "//script[contains(text(), 'colorImages') or contains(text(), \"'videos':\")]/text()",
            document, null, XPathResult.STRING_TYPE, null
        ).stringValue;

        if (dataScript) {
            // 8-1. 이미지 파싱
            try {
                // ⚠️ 이스케이프 주의: 'colorImages': { 'initial': [...] } 구조 파싱
                const imgRegex = /'colorImages':\\s*{\\s*'initial':\\s*(\\[.*?\\])/;
                const imgMatch = dataScript.match(imgRegex);
                if (imgMatch && imgMatch[1]) {
                    const imagesData = JSON.parse(imgMatch[1]);
                    imagesData.forEach(imgData => {
                        if (imgData.hiRes) imageUrls.add(imgData.hiRes);
                        else if (imgData.large) imageUrls.add(imgData.large);
                    });
                }
            } catch (e) {}

            // 8-2. 동영상 파싱
            try {
                // ⚠️ 이스케이프 주의: 'videos': [...] 구조 파싱
                // 아마존은 때때로 'videos' 또는 "videos"를 사용하므로 양쪽 다 대응할 수 있도록 정규식 수정
                const videoRegex = /['"]videos['"]:\\s*(\\[.*?\\])/;
                const videoMatch = dataScript.match(videoRegex);
                if (videoMatch && videoMatch[1]) {
                    const videosData = JSON.parse(videoMatch[1]);
                    videosData.forEach(video => {
                        productData.상품정보.동영상.push({
                            title: video.title || '',
                            duration: video.duration || '',
                            // 썸네일 이미지 (thumb 또는 slateUrl 사용)
                            thumbnail: video.thumb || video.slateUrl || '',
                            // 실제 비디오 URL(videoUrl)은 동적으로 로드되거나 추출이 복잡할 수 있어 메타데이터 위주로 수집
                        });
                    });
                }
            } catch (e) {
                 // 동영상 파싱 실패 시 무시하고 진행
                 // console.log("동영상 메타데이터 파싱 실패 (무시 가능):", e.message);
            }
        }

        // 이미지 대체 로직 (썸네일 URL 변환)
        if (imageUrls.size === 0) {
            const thumbnailList = document.querySelectorAll('#altImages img');
            thumbnailList.forEach(img => {
                if (img.src && img.src.includes('images/I/')) {
                    // ⚠️ 이스케이프 주의: ._AC_US40_.jpg -> .jpg (원본 해상도)
                    let highResUrl = img.src.replace(/\\._.*_\\./g, '.');
                    imageUrls.add(highResUrl);
                }
            });
        }

        productData.상품정보.이미지.썸네일 = Array.from(imageUrls);
        if (productData.상품정보.이미지.썸네일.length > 0) {
            productData.상품정보.이미지.대표이미지 = productData.상품정보.이미지.썸네일[0];
        }


        // 9. 상품 설명 (About this item - Bullet Points)
        productData.상품정보.특징 = [];
        const descriptionElements = document.querySelectorAll('#feature-bullets ul li span.a-list-item');
        descriptionElements.forEach(span => {
            if (span.textContent.trim()) {
                productData.상품정보.특징.push(span.textContent.trim());
            }
        });

        return productData;

    } catch (error) {
        return { error: error.message }; // 에러 발생 시 객체 반환
    }
}
// 실행
crawlProductData();
`;

// =======================================================================
// ▼▼▼ 메인 실행 로직 (Queue 기반 작업자) ▼▼▼
// =======================================================================


// [핵심] 브라우저 시작 및 재시작 관리 함수 (장애 복구 및 IP 변경 포함)
// [수정됨] forceIpChange 플래그를 추가하여 IP 변경 실행 여부를 제어
async function initializeBrowser(forceIpChange = false) {
    console.log("\n🔄 브라우저 및 네트워크 환경 초기화 중...");

    // 중요: 브라우저 재시작 전, 진행 중이던 작업을 PENDING으로 복구 (작업 유실 방지)
    await resetProcessingTasks();

    // 1. 기존 브라우저 종료
    if (browser) {
        console.log("   🧹 기존 브라우저 종료 중...");
        try { await browser.close(); } catch (e) { }
    }

    // 2. IP 변경 실행 (필요한 경우)
    if (forceIpChange) {
        if (!executeIpChangeScript()) {
            console.error("🛑 IP 변경 실패로 브라우저를 초기화할 수 없습니다.");
            return false;
        }
        // IP 변경 후 네트워크 안정화를 위한 약간의 대기 시간 (권장)
        console.log("   ⏳ 네트워크 안정화 대기 중 (5초)...");
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // 3. 새 브라우저 시작
    console.log("   🌐 새 브라우저 시작 중...");
    try {
        // 프록시 세션 ID 생성 로직 제거됨
        const launched = await launchBrowser();
        browser = launched.browser;
        page = launched.page;
    } catch (error) {
        console.error("❌ 브라우저 실행 실패:", error.message);
        return false;
    }


    // 4. 로그인 처리
    await loadCookies(page);
    if (!(await checkLoginStatus(page))) {
        console.log("⚠️ 로그인 세션 만료 또는 봇 탐지됨. 재로그인 시도.");
        if (!(await performAmazonLogin(page))) {
            return false;
        }
    }
    return true;
}


async function runDetailCrawler() {
    await initDatabase();

    let processedCount = 0;

    // 초기 브라우저 실행 및 로그인 시도 (실패 시 IP 변경 후 1회 재시도)
    // 초기 실행 (forceIpChange = false)
    if (!(await initializeBrowser(false))) {
        console.log("⚠️ 초기 접속 실패. IP 변경 후 재시도합니다.");
        // 실패 시 재시도 (forceIpChange = true)
        if (!(await initializeBrowser(true))) {
            console.error("🛑 최종 초기화 실패로 스크립트를 종료합니다.");
            if (browser) await browser.close();
            if (dbPool) await dbPool.end();
            return;
        }
    }

    console.log("\n🚀 3단계: 상세 크롤링 시작 (작업 큐 폴링 중)...");
    let currentTask;

    // 메인 루프 (작업 큐 처리)
    while (true) {
        // 1. 다음 작업 가져오기 (원자적 처리)
        currentTask = await getNextTask();

        if (currentTask === null) {
            // 큐가 비었을 경우 대기 후 다시 확인
            console.log(`\n💤 대기 중: 처리할 작업이 없습니다. ${POLL_INTERVAL_MS / 1000}초 후 다시 확인합니다.`);
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
            continue;
        }

        processedCount++;
        console.log(`\n[${processedCount}] 처리 중: ASIN ${currentTask.asin} (Queue ID: ${currentTask.id})`);

        try {
            // 2. 상품 페이지 이동
            await page.goto(currentTask.product_url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await new Promise(resolve => setTimeout(resolve, WAIT_TIME_NAVIGATION));

            // 3. 크롤링 스크립트 실행
            const data = await page.evaluate(crawlScript);

            // 4. 결과 검증 및 처리
            if (data && data.상품정보 && data.상품정보.ASIN) {
                // ASIN 검증 (리디렉션 방지)
                if (data.상품정보.ASIN !== currentTask.asin) {
                    throw new Error("ASIN_MISMATCH");
                }

                // 데이터 저장
                const saved = await saveProductData(data, currentTask);
                if (saved) {
                    console.log(`   ✅ 저장 성공: ${data.상품정보.상품명.substring(0, 60)}...`);
                    console.log(`      💰 가격: $${data.상품정보.가격_USD || 'N/A'} | 🚚 배송비: $${data.상품정보.배송비_USD || 'N/A'} | 직배송: ${data.상품정보.직배송가능여부 ? 'O' : 'X'} | 🎬 동영상: ${data.상품정보.동영상.length}개`);
                    await markTaskStatus(currentTask.id, 'COMPLETED');
                } else {
                    throw new Error("DB_SAVE_FAILED");
                }

            } else if (data && data.error) {
                // 크롤링 실패 처리
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

            // [핵심] 네트워크 오류, 타임아웃, 봇 탐지 시 IP 변경 및 브라우저 재시작 (재시도 로직)
            // 프록시 오류 코드(ERR_PROXY)는 제거하고 일반 네트워크 오류 코드만 확인합니다.
            // error.message가 존재하지 않을 경우를 대비해 optional chaining(?.) 사용
            if (error.name === 'TimeoutError' || error.message?.includes('net::ERR') || error.message === 'BOT_DETECTED') {
                console.log("🌐 네트워크 오류 또는 봇 탐지. IP 교체 및 브라우저 재시작.");

                // initializeBrowser(true) 호출: IP 변경 실행 및 PROCESSING 상태를 PENDING으로 되돌림
                if (!(await initializeBrowser(true))) {
                    console.error("🛑 브라우저 재시작 실패. 스크립트 종료.");
                    if (browser) await browser.close();
                    if (dbPool) await dbPool.end();
                    return;
                }
                // 재시작 후 루프 처음으로 돌아가 다시 getNextTask() 호출 (자동 재시도)

            } else {
                // 기타 오류 (DB 저장 실패, ASIN 불일치, 크롤링 로직 실패 등)
                console.log("   ⚠️ 처리 실패 (재시도 안함). FAILED 처리 후 다음 작업 진행.");
                await markTaskStatus(currentTask.id, 'FAILED');
            }
        }
    }
}

// 스크립트 시작
runDetailCrawler();