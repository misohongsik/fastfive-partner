const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

// =======================================================================
// ▼▼▼ 설정 섹션 (1단계와 동일) ▼▼▼
// =======================================================================

// --- 로그인 설정 ---
const AMAZON_LOGIN = {
    email: 'misohongsik@gmail.com',
    password: '@calla831031'
};
const COOKIE_FILE = path.join(__dirname, '../config/amazon_session.json');

// --- 프록시 설정 (Smartproxy) ---
const USE_PROXY = 0;
const PROXY_CONFIG = {
    host: 'proxy.smartproxy.net',
    port: 3120,
    baseUser: 'smart-ABKHOLDINGS_area-US_life-15',
    pass: 'Calla831031'
};

// --- DB 설정 (Connection Pool 사용) ---
const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: '@Calla831031',
    database: 'amazon', // <-- 여기를 'amazon'으로 변경
    port: 3306,
    connectionLimit: 5
};

// --- 크롤링 설정 ---
const SHOW_BROWSER = 1;
const WAIT_TIME_NAVIGATION = 4000;
const TARGET_RANK = { MIN: 30, MAX: 80 };
const HARVEST_INTERVAL_DAYS = 7; // 데이터 신선도 유지를 위한 재수집 주기 (일)
const BATCH_SIZE = 100; // 한 번에 처리할 카테고리 수 (메모리 관리용)

// =======================================================================
// ▲▲▲ 설정 섹션 종료 ▲▲▲
// =======================================================================

let dbPool;

function generateSessionId() {
    return Math.random().toString(36).substring(2, 10);
}

// =======================================================================
// ▼▼▼ 유틸리티 함수 (신규) ▼▼▼
// =======================================================================

/**
 * [신규] 페이지를 맨 아래까지 부드럽게 스크롤하여 지연 로딩된 콘텐츠를 로드합니다.
 * @param {import('puppeteer').Page} page 
 */
async function autoScroll(page) {
    console.log("      ⏬ 스크롤 중 (지연 로딩 콘텐츠 로드)...");
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            var totalHeight = 0;
            var distance = 200; // 스크롤 단위
            // 150ms마다 스크롤을 내림
            var timer = setInterval(() => {
                var scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                // 페이지 끝에 도달하면 멈춤
                if (totalHeight >= scrollHeight - window.innerHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 150);
        });
    });
    // 스크롤 완료 후 콘텐츠 렌더링 안정화 대기 (1초)
    await new Promise(resolve => setTimeout(resolve, 1000));
}


// =======================================================================
// ▼▼▼ 데이터베이스 관리 ▼▼▼
// =======================================================================

async function initDatabase() {
    console.log("💾 데이터베이스 연결 및 확인 중...");
    try {
        dbPool = mysql.createPool(DB_CONFIG);

        const [queueTable] = await dbPool.query("SHOW TABLES LIKE 'amazon_product_queue'");
        if (queueTable.length === 0) {
            console.error("❌ 오류: 'amazon_product_queue' 테이블이 없습니다. SQL 스크립트를 먼저 실행해주세요.");
            process.exit(1);
        }
        console.log("   ✅ 데이터베이스 준비 완료.");

    } catch (error) {
        console.error("❌ 데이터베이스 초기화 실패:", error);
        process.exit(1);
    }
}

// 수집 대상 카테고리 가져오기 (데이터 신선도 관리 포함)
async function getActiveCategories(limit = BATCH_SIZE) {
    try {
        // 활성화(is_active=TRUE) 및 탐색 완료(is_explored=TRUE)되었고,
        // 설정된 주기(HARVEST_INTERVAL_DAYS)가 지났거나 아직 수집된 적 없는 항목 우선 조회
        const query = `
            SELECT id, bsr_url, full_path
            FROM amazon_bsr_categories
            WHERE is_active = TRUE AND is_explored = TRUE
              AND (last_harvested_at IS NULL OR last_harvested_at < DATE_SUB(NOW(), INTERVAL ? DAY))
            ORDER BY last_harvested_at ASC
            LIMIT ?
        `;
        const [rows] = await dbPool.query(query, [HARVEST_INTERVAL_DAYS, limit]);
        return rows;
    } catch (error) {
        console.error("❌ 활성 카테고리 조회 실패:", error);
        return [];
    }
}

// 수집된 ASIN/URL을 큐에 저장 (중복 시 순위 업데이트)
async function saveProductQueue(categoryId, items) {
    if (items.length === 0) return 0;

    let processedCount = 0;
    const connection = await dbPool.getConnection();
    await connection.beginTransaction();

    try {
        // ON DUPLICATE KEY UPDATE: 이미 존재하면 순위(rank_in_bsr)만 최신 정보로 업데이트
        const query = `
            INSERT INTO amazon_product_queue (category_id, asin, product_url, rank_in_bsr)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                rank_in_bsr = VALUES(rank_in_bsr),
                updated_at = CURRENT_TIMESTAMP
        `;

        for (const item of items) {
            try {
                // URL은 추출 시 이미 정규화됨 (extractBSRItems 참조)
                const [result] = await connection.query(query, [categoryId, item.asin, item.url, item.rank]);
                if (result.affectedRows > 0) {
                    processedCount++;
                }
            } catch (error) {
                console.error(`   ⚠️ 큐 저장 오류 (ASIN: ${item.asin}):`, error.message);
            }
        }
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        console.error("❌ DB 트랜잭션 롤백:", error);
    } finally {
        connection.release();
    }
    return processedCount;
}

// 카테고리 수집 완료 시각 업데이트
async function markCategoryHarvested(categoryId) {
    try {
        await dbPool.query('UPDATE amazon_bsr_categories SET last_harvested_at = CURRENT_TIMESTAMP WHERE id = ?', [categoryId]);
    } catch (error) { }
}


// =======================================================================
// ▼▼▼ 브라우저 초기화 및 로그인 관리 (1단계 코드 재사용) ▼▼▼
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
        // 타임아웃을 짧게 설정하여 네트워크 문제 시 빠르게 감지
        await page.goto("https://www.amazon.com", { waitUntil: "domcontentloaded", timeout: 30000 });
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
// ▼▼▼ 2단계: ASIN 수집기 핵심 로직 (수정됨) ▼▼▼
// =======================================================================

/**
 * [핵심 수정] BSR 페이지에서 순위, ASIN, URL 추출 (순위 뱃지 기반 역추적 방식)
 * 지연 로딩 및 레이아웃 변경에 강력하게 대응합니다.
 */
async function extractBSRItems(page, minRank, maxRank) {
    // page.evaluate 내부는 브라우저 환경에서 실행됩니다.
    return await page.evaluate((minRank, maxRank) => {
        const items = [];

        // 1. 페이지 내의 모든 순위 뱃지 찾기 (기준점)
        // .zg-bdg-text (구형), span[class*="badge"] (신형 동적 클래스 커버), span.zg-badge-text 등
        const rankElements = document.querySelectorAll(
            '.zg-bdg-text, span[class*="badge"], span.zg-badge-text, .zg-item-rank'
        );

        // 2. 각 순위 뱃지를 기준으로 정보 추출
        rankElements.forEach(rankElement => {

            // 2-1. 순위 파싱 및 필터링
            const rankText = rankElement.textContent.trim().replace('#', '');
            const rank = parseInt(rankText, 10);

            if (isNaN(rank) || rank < minRank || rank > maxRank) return;

            // 2-2. 뱃지로부터 부모 컨테이너 찾기 (역추적)
            // closest()를 사용하여 가장 가까운 상품 컨테이너를 찾습니다.
            const container = rankElement.closest(
                'div[id^="gridItemRoot"], li.zg-item-immersion, div[id^="p13n-asin-"], div.zg-carousel-general-faceout, .a-carousel-card'
            );

            if (!container) return; // 컨테이너를 찾지 못하면 해당 항목 무시

            // 2-3. 컨테이너 내에서 URL 및 ASIN 찾기
            // /dp/ASINCODE/ 형태를 포함하는 링크를 찾음
            const linkElement = container.querySelector('a[href*="/dp/"]');

            if (!linkElement || !linkElement.href) return;

            const productUrl = linkElement.href;

            // URL에서 ASIN 추출
            const asinMatch = productUrl.match(/\/dp\/([A-Z0-9]{10})/);
            if (!asinMatch) return;

            const asin = asinMatch[1];

            // URL 정규화
            const cleanUrl = `https://www.amazon.com/dp/${asin}`;

            items.push({ rank, asin, url: cleanUrl });
        });

        // 3. 중복 제거
        const uniqueItems = [];
        const seenAsins = new Set();
        items.forEach(item => {
            if (!seenAsins.has(item.asin)) {
                uniqueItems.push(item);
                seenAsins.add(item.asin);
            }
        });

        return uniqueItems;
    }, minRank, maxRank);
}


// 메인 실행 함수
async function runAsinHarvester() {
    await initDatabase();

    let browser;
    let page;

    // 브라우저 시작 및 재시작 관리 함수 (IP 교체 포함)
    async function initializeBrowser() {
        console.log("\n🔄 브라우저 시작/재시작 및 로그인 확인 중...");
        if (browser) {
            try { await browser.close(); } catch (e) { }
        }

        const sessionId = generateSessionId();

        // 프록시 사용 여부에 따라 로그 다르게 표시
        if (USE_PROXY === 1) {
            console.log(`   🔑 새 Proxy Session ID: ${sessionId}`);
        } else {
            console.log(`   🔑 로컬 IP로 브라우저 시작 중...`);
        }

        const launched = await launchBrowser(sessionId);
        browser = launched.browser;
        page = launched.page;

        // 로그인 처리
        await loadCookies(page);
        if (!(await checkLoginStatus(page))) {
            console.log("⚠️ 로그인 세션 만료 또는 봇 탐지됨. 재로그인 시도.");
            if (!(await performAmazonLogin(page))) {
                return false;
            }
        }
        return true;
    }

    // 초기 브라우저 실행 및 로그인 시도 (실패 시 1회 재시도)
    if (!(await initializeBrowser())) {
        if (!(await initializeBrowser())) {
            console.error("🛑 최종 로그인 실패로 스크립트를 종료합니다.");
            if (browser) await browser.close();
            if (dbPool) await dbPool.end();
            return;
        }
    }

    console.log("\n🚀 2단계: ASIN 수집 시작...");
    let processedCount = 0;
    let categories;

    // 메인 루프 (배치 처리)
    // DB에서 설정된 주기(HARVEST_INTERVAL_DAYS)가 지난 카테고리를 BATCH_SIZE 만큼 가져옴
    while ((categories = await getActiveCategories(BATCH_SIZE)).length > 0) {
        console.log(`\n📊 배치 시작: ${categories.length}개 카테고리 처리 중... (주기: ${HARVEST_INTERVAL_DAYS}일)`);

        for (const category of categories) {
            processedCount++;
            console.log(`\n[${processedCount}] 처리 중: ${category.full_path}`);

            let collectedItems = [];
            let retry = 0;
            const MAX_RETRY = 3;
            let success = false;

            while (!success && retry < MAX_RETRY) {
                try {
                    // --- Page 1 (30위 ~ 50위) 수집 ---
                    // 정확한 범위 계산
                    const p1Min = Math.max(TARGET_RANK.MIN, 1);
                    const p1Max = Math.min(TARGET_RANK.MAX, 50);

                    if (p1Min <= p1Max) {
                        console.log(`   📄 Page 1 이동 (${p1Min}~${p1Max}위)...`);
                        // URL 객체로 안전하게 이동 (pg=1 명시)
                        const urlP1 = new URL(category.bsr_url);
                        urlP1.searchParams.set('pg', '1');

                        await page.goto(urlP1.toString(), { waitUntil: 'domcontentloaded', timeout: 60000 });
                        await new Promise(resolve => setTimeout(resolve, WAIT_TIME_NAVIGATION));

                        // [해결책 적용] 스크롤 실행하여 지연 로딩 콘텐츠 로드
                        await autoScroll(page);

                        // 봇 탐지 확인
                        const isBotCheck = await page.evaluate(() => {
                            return document.title.includes("Robot Check") || !!document.querySelector('form[action*="/errors/validateCaptcha"]');
                        });
                        if (isBotCheck) throw new Error("BOT_DETECTED");

                        // [개선된 함수 호출]
                        const itemsP1 = await extractBSRItems(page, p1Min, p1Max);
                        collectedItems.push(...itemsP1);
                        console.log(`      • ${itemsP1.length}개 추출.`);
                    }


                    // --- Page 2 (51위 ~ 80위) 수집 ---
                    const p2Min = Math.max(TARGET_RANK.MIN, 51);
                    const p2Max = Math.min(TARGET_RANK.MAX, 100);

                    if (p2Min <= p2Max) {
                        // Page 2 URL 생성 (?pg=2 파라미터 추가)
                        const urlP2 = new URL(category.bsr_url);
                        urlP2.searchParams.set('pg', '2');

                        console.log(`   📄 Page 2 이동 (${p2Min}~${p2Max}위)...`);
                        await page.goto(urlP2.toString(), { waitUntil: 'domcontentloaded', timeout: 60000 });
                        await new Promise(resolve => setTimeout(resolve, WAIT_TIME_NAVIGATION));

                        // [해결책 적용] Page 2에서도 스크롤 실행
                        await autoScroll(page);

                        // 봇 탐지 확인 (Page 2)
                        const isBotCheckP2 = await page.evaluate(() => document.title.includes("Robot Check"));
                        if (isBotCheckP2) throw new Error("BOT_DETECTED");

                        // [개선된 함수 호출]
                        const itemsP2 = await extractBSRItems(page, p2Min, p2Max);
                        collectedItems.push(...itemsP2);
                        console.log(`      • ${itemsP2.length}개 추출.`);
                    }

                    success = true; // 성공 시 루프 탈출

                } catch (error) {
                    console.error(`   ❌ 오류 발생 (재시도 ${retry + 1}/${MAX_RETRY}): ${error.message}`);
                    retry++;

                    // 네트워크 오류, 타임아웃, 봇 탐지 시 브라우저 재시작
                    if (error.message.includes('ERR_PROXY') || error.name === 'TimeoutError' || error.message.includes('net::ERR') || error.message === 'BOT_DETECTED') {
                        console.log("🌐 네트워크 오류 또는 봇 탐지. IP 교체(프록시 사용 시) 및 브라우저 재시작.");
                        // 재시작 실패 시 스크립트 종료
                        if (!(await initializeBrowser())) {
                            console.error("🛑 브라우저 재시작 실패. 스크립트 종료.");
                            if (browser) await browser.close();
                            if (dbPool) await dbPool.end();
                            return;
                        }
                        // 재시작 후 retry 카운트 유지하며 다시 시도
                    } else if (retry >= MAX_RETRY) {
                        console.log("   ⚠️ 최대 재시도 횟수 초과. 다음 카테고리로 이동.");
                    }
                }
            }

            // --- 결과 저장 및 상태 업데이트 ---
            if (collectedItems.length > 0) {
                // Page 1과 Page 2 수집 결과 중복 최종 제거 (혹시 모를 상황 대비)
                const uniqueCollectedItems = Array.from(new Map(collectedItems.map(item => [item.asin, item])).values());

                const savedCount = await saveProductQueue(category.id, uniqueCollectedItems);
                console.log(`   📥 총 ${uniqueCollectedItems.length}개 수집 / ${savedCount}건 DB 저장/갱신 완료.`);
            } else if (success) {
                console.log(`   ℹ️ 목표 순위 범위 내 상품 없음.`);
            }

            // 실패했더라도 시각은 업데이트하여 무한 반복 방지
            await markCategoryHarvested(category.id);
        }
    }

    console.log("\n✅ 2단계 완료: 더 이상 처리할 활성 카테고리가 없습니다.");
    if (browser) await browser.close();
    if (dbPool) await dbPool.end();
}

// 스크립트 시작
runAsinHarvester();