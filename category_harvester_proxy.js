const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const mysql = require('mysql2/promise');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// =======================================================================
// ▼▼▼ 설정 섹션 (사용자 환경에 맞게 수정) ▼▼▼
// =======================================================================

// --- 로그인 설정 ---
const AMAZON_LOGIN = {
    email: 'misohongsik@gmail.com',
    password: '@calla831031'
};
// 세션 파일은 이전 스크립트와 공유합니다.
const COOKIE_FILE = path.join(__dirname, 'amazon_session.json');

// --- 프록시 설정 (Smartproxy) ---
const USE_PROXY = 0;
const PROXY_CONFIG = {
    host: 'proxy.smartproxy.net',
    port: 3120,
    baseUser: 'smart-ABKHOLDINGS_area-US_life-15', // US 지역 권장
    pass: 'Calla831031'
};

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
const SHOW_BROWSER = 1; // 로그인 및 모니터링을 위해 1 권장
const START_URL = 'https://www.amazon.com/bestsellers';
const WAIT_TIME_NAVIGATION = 3500; // 페이지 이동 후 대기 시간 (ms)

// =======================================================================
// ▲▲▲ 설정 섹션 종료 ▲▲▲
// =======================================================================

let dbPool;

function generateSessionId() {
    return Math.random().toString(36).substring(2, 10);
}

// URL 정규화 및 해시 생성 (핵심 유틸리티)
function processUrl(url) {
    try {
        const parsedUrl = new URL(url);
        // /ref=... 경로 제거 (세션 추적 정보 제거)
        let pathname = parsedUrl.pathname;
        pathname = pathname.replace(/\/ref=.*$/, '');
        parsedUrl.pathname = pathname;
        // 쿼리 파라미터 제거
        parsedUrl.search = '';

        const normalizedUrl = parsedUrl.toString();
        // SHA256 해시 생성 (중복 방지용 키)
        const urlHash = crypto.createHash('sha256').update(normalizedUrl).digest('hex');
        return { normalizedUrl, urlHash };
    } catch (e) {
        return { normalizedUrl: url, urlHash: null };
    }
}

// =======================================================================
// ▼▼▼ 데이터베이스 초기화 및 관리 ▼▼▼
// =======================================================================

async function initDatabase() {
    console.log("💾 데이터베이스 연결 및 초기화 중...");
    try {
        dbPool = mysql.createPool(DB_CONFIG);

        // 테이블 존재 확인
        const [tables] = await dbPool.query("SHOW TABLES LIKE 'amazon_bsr_categories'");
        if (tables.length === 0) {
            console.error("❌ 오류: 'amazon_bsr_categories' 테이블이 없습니다. SQL 스크립트를 먼저 실행해주세요.");
            process.exit(1);
        }

        // 루트 카테고리 시딩 (테이블이 비어있을 경우)
        const [rows] = await dbPool.query('SELECT COUNT(*) as count FROM amazon_bsr_categories');
        if (rows[0].count === 0) {
            const { normalizedUrl, urlHash } = processUrl(START_URL);
            await dbPool.query(
                'INSERT INTO amazon_bsr_categories (category_name, bsr_url, url_hash, depth, full_path) VALUES (?, ?, ?, ?, ?)',
                ['Amazon Best Sellers (Root)', normalizedUrl, urlHash, 0, 'Root']
            );
            console.log("   🌱 루트 카테고리 시딩 완료.");
        }
        console.log("   ✅ 데이터베이스 준비 완료.");

    } catch (error) {
        console.error("❌ 데이터베이스 초기화 실패:", error);
        process.exit(1);
    }
}

// 다음 미탐색 카테고리 가져오기 (DB를 큐로 사용, BFS 구현)
async function getNextUnexploredCategory() {
    try {
        // 깊이(depth)가 얕은 순서대로 가져와 너비 우선 탐색(BFS) 구현
        const [rows] = await dbPool.query(
            'SELECT id, bsr_url, depth, full_path FROM amazon_bsr_categories WHERE is_explored = FALSE ORDER BY depth ASC, id ASC LIMIT 1'
        );
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error("❌ 미탐색 카테고리 조회 실패:", error);
        return null;
    }
}

// 탐색된 하위 카테고리 저장 (중복 체크 포함)
async function saveSubcategories(parentCategory, subcategories) {
    if (subcategories.length === 0) return 0;

    let insertedCount = 0;
    const newDepth = parentCategory.depth + 1;

    // 트랜잭션 시작 (대량 삽입 성능 향상)
    const connection = await dbPool.getConnection();
    await connection.beginTransaction();

    try {
        for (const cat of subcategories) {
            const { normalizedUrl, urlHash } = processUrl(cat.url);
            if (!urlHash) continue;

            const fullPath = `${parentCategory.full_path} > ${cat.name}`;

            try {
                // INSERT IGNORE를 사용하여 url_hash 중복 발생 시 오류 없이 무시
                const [result] = await connection.query(
                    `INSERT IGNORE INTO amazon_bsr_categories (category_name, bsr_url, url_hash, parent_id, depth, full_path) VALUES (?, ?, ?, ?, ?, ?)`,
                    [cat.name, normalizedUrl, urlHash, parentCategory.id, newDepth, fullPath]
                );
                 if (result.affectedRows > 0) {
                    insertedCount++;
                }
            } catch (error) {
                 console.error(`   ⚠️ 카테고리 저장 오류 (${cat.name}):`, error.message);
            }
        }
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        console.error("❌ DB 트랜잭션 롤백:", error);
    } finally {
        connection.release();
    }
    return insertedCount;
}

// 현재 카테고리 탐색 완료로 표시
async function markAsExplored(categoryId) {
    try {
        await dbPool.query('UPDATE amazon_bsr_categories SET is_explored = TRUE WHERE id = ?', [categoryId]);
    } catch (error) {
        console.error(`❌ 탐색 완료 표시 실패 (ID: ${categoryId}):`, error);
    }
}

// =======================================================================
// ▼▼▼ 브라우저 초기화 및 로그인 관리 (이전 코드 활용) ▼▼▼
// =======================================================================

async function launchBrowser(sessionId) {
    const args = [
        '--no-sandbox', '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--lang=en-US,en' // 언어 영어 고정 (중요)
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
        await page.authenticate({
            username: proxyUser,
            password: PROXY_CONFIG.pass
        });
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
        console.error("❌ 로그인 상태 확인 중 에러 (네트워크 문제 가능성):", error.message);
    }
    return false;
}

// 로그인 수행 (OTP/2FA 수동 처리 포함)
async function performAmazonLogin(page) {
    console.log("🔑 아마존 로그인 시도 중...");
    try {
         await page.goto('https://www.amazon.com/ap/signin?openid.pape.max_auth_age=0&openid.return_to=https%3A%2F%2Fwww.amazon.com%2F&openid.assoc_handle=usflex&openid.mode=checkid_setup&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0', { waitUntil: 'networkidle0' });

        // 1. 이메일 입력
        await page.waitForSelector('#ap_email', { visible: true, timeout: 15000 });
        await page.type('#ap_email', AMAZON_LOGIN.email, { delay: 50 });
        await page.click('#continue');

        // 2. 비밀번호 입력
        await page.waitForSelector('#ap_password', { visible: true, timeout: 15000 });
        await page.type('#ap_password', AMAZON_LOGIN.password, { delay: 50 });
        await page.evaluate(() => {
            const checkbox = document.querySelector('input[name="rememberMe"]');
            if (checkbox && !checkbox.checked) checkbox.click();
        });
        await page.click('#signInSubmit');

        // 3. 2단계 인증(2FA/OTP)/캡챠 처리 대기
        console.log("===================================================================");
        console.log(" 🛑 2단계 인증(OTP) 또는 캡챠가 나타나면, 90초 내에 수동으로 처리해주세요.");
        console.log('===================================================================');
        try {
            await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 90000 });
            const url = page.url();
            // MFA (Multi-Factor Authentication) 또는 CVF (Challenge Verification Framework) 감지
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
// ▼▼▼ 1단계: 카테고리 수집기 핵심 로직 (수정된 부분) ▼▼▼
// =======================================================================

/**
 * [핵심 수정] 현재 페이지에서 직계 하위 카테고리 링크를 추출합니다. (안정화 버전)
 * 아마존의 동적 클래스 변경에 대응하도록 구조적 탐색을 사용합니다.
 * @param {import('puppeteer').Page} page
 */
async function extractSubCategories(page) {
    console.log("   🔍 하위 카테고리 추출 중 (Robust Selector 사용)...");

    // 1. 필수 요소 로드 대기 (ID와 속성 기반)
    try {
        // #zg-left-col (왼쪽 컬럼 ID) 내부에 [aria-current="page"] (현재 선택된 항목)가 나타날 때까지 대기합니다.
        // 이 셀렉터는 HTML 분석 결과 가장 안정적입니다.
        await page.waitForSelector('#zg-left-col [aria-current="page"]', { timeout: 10000 });
    } catch (e) {
        console.error("   ❌ 오류: 카테고리 네비게이션 트리를 찾을 수 없습니다. (타임아웃 또는 구조 변경)");
        // 필요한 경우 여기서 디버깅 파일을 저장할 수 있습니다.
        return [];
    }

    // 2. 브라우저 컨텍스트에서 데이터 추출 로직 실행
    const subcategories = await page.evaluate(() => {
        const results = [];

        // A. 기준점 찾기: 현재 선택된 카테고리 노드
        const selectedNode = document.querySelector('#zg-left-col [aria-current="page"]');
        if (!selectedNode) return results;

        // B. 기준점의 부모 <li> 찾기
        const parentLi = selectedNode.closest('li');
        if (!parentLi) return results;

        let subcategoryList = null; // 하위 카테고리를 포함하는 <ul>

        // C. 하위 카테고리 목록(UL) 탐색 (아마존의 다양한 구조 처리)

        // --- 전략 1: 현재 <li> 내부에 중첩된 <ul> 확인 (하위 레벨 페이지 구조) ---
        // 예: <li><span>Appliances</span> <ul><li>Cooktops</li></ul> </li>
        subcategoryList = parentLi.querySelector('ul');

        // --- 전략 2: 다음 형제 요소 확인 (최상위 'Any Department' 구조 등) ---
        if (!subcategoryList) {
            const nextSibling = parentLi.nextElementSibling;
            if (nextSibling) {
                // 사례 2-1: 다음 형제가 바로 <ul> 인 경우 (HTML 분석 시 확인된 구조)
                if (nextSibling.tagName === 'UL') {
                    subcategoryList = nextSibling;
                }
                // 사례 2-2: 다음 형제가 <li> 이고 그 안에 <ul>이 있는 경우
                // 예: <li><span>Any Department</span></li> <li><ul><li>Appliances</li></ul></li>
                else if (nextSibling.tagName === 'LI') {
                    subcategoryList = nextSibling.querySelector('ul');
                }
            }
        }

        // D. 링크 추출
        if (subcategoryList) {
            // 직계 자식 링크(li > a)만 선택하여 손자 카테고리가 포함되지 않도록 합니다. (:scope 사용)
            const links = subcategoryList.querySelectorAll(':scope > li > a');
            links.forEach(link => {
                // 링크 자체가 현재 페이지가 아닌지 확인 (중복 방지)
                if (link.getAttribute('aria-current') !== 'page') {
                    const name = link.innerText.trim();
                    const url = link.href;
                    
                    // URL 유효성 검사 (BSR 형식인지 확인) 및 불필요한 이름 제외
                    if (name && url && (url.includes('/Best-Sellers-') || url.includes('/zgbs/') || url.includes('/bestsellers/'))) {
                        if (name !== "Any Department" && name !== "모든 부서") {
                           results.push({ name, url });
                        }
                    }
                }
            });
        }

        return results;
    });

    // 3. 결과 로깅 및 반환
    if (subcategories.length === 0) {
        console.log("   ℹ️ 하위 카테고리가 없거나 말단 카테고리입니다.");
    }
    return subcategories;
}


// 메인 실행 함수
async function runCategoryHarvester() {
    await initDatabase();

    let browser;
    let page;

    // 브라우저 시작 및 재시작 관리 함수 (IP 교체 포함)
    async function initializeBrowser() {
        console.log("\n🔄 브라우저 시작/재시작 및 로그인 확인 중...");
        if (browser) {
            try { await browser.close(); } catch (e) {}
        }

        const sessionId = generateSessionId();
        console.log(`   🔑 새 Proxy Session ID: ${sessionId}`);

        const launched = await launchBrowser(sessionId);
        browser = launched.browser;
        page = launched.page;

        // 로그인 처리
        await loadCookies(page);
        // 로그인이 풀렸거나 봇 탐지에 걸렸을 경우 다시 로그인 시도
        if (!(await checkLoginStatus(page))) {
            console.log("⚠️ 로그인 세션 만료 또는 봇 탐지됨. 재로그인 시도.");
            if (!(await performAmazonLogin(page))) {
                // 로그인 실패 시 재시도 로직 대신 false 반환하여 메인에서 처리
                return false;
            }
        }
        return true;
    }

    // 초기 브라우저 실행 및 로그인 시도
    if (!(await initializeBrowser())) {
        // 초기 로그인 실패 시 한 번 더 재시도
        if (!(await initializeBrowser())) {
            console.error("🛑 최종 로그인 실패로 스크립트를 종료합니다.");
            if (browser) await browser.close();
            if (dbPool) await dbPool.end();
            return;
        }
    }

    console.log("\n🚀 1단계: 카테고리 수집 시작...");
    let processedCount = 0;
    let currentCategory;

    
    // 메인 루프 (DB 큐 기반 BFS)
    while ((currentCategory = await getNextUnexploredCategory()) !== null) {
        processedCount++;
        console.log(`\n🧭 [${processedCount} | Depth:${currentCategory.depth}] 탐색 중: ${currentCategory.full_path}`);

        try {
            // 1. 카테고리 페이지 이동 (타임아웃 60초)
            await page.goto(currentCategory.bsr_url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await new Promise(resolve => setTimeout(resolve, WAIT_TIME_NAVIGATION));

            // [사용자 요청에 따라 디버깅 코드 블록이 제거되었습니다.]

            // 2. 봇 탐지(Captcha) 확인
            const isBotCheck = await page.evaluate(() => {
                return document.title.includes("Robot Check") || !!document.querySelector('form[action*="/errors/validateCaptcha"]');
            });

            if (isBotCheck) {
                console.log("🚨 봇 탐지(Captcha) 감지됨. IP 교체 및 재시작.");
                // initializeBrowser 호출 시 성공 여부를 확인하는 것이 좋습니다.
                if (!(await initializeBrowser())) {
                    console.error("🛑 브라우저 재시작 실패로 스크립트를 종료합니다.");
                    break; 
               }
                continue; // 현재 카테고리를 다시 시도 (is_explored가 FALSE이므로 다시 선택됨)
            }

            // 3. 하위 카테고리 링크 추출 (수정된 로직 사용)
            const subcategories = await extractSubCategories(page);

            // 4. 결과 저장 및 상태 업데이트
            const insertedCount = await saveSubcategories(currentCategory, subcategories);

            if (subcategories.length > 0) {
                 console.log(`   📥 ${subcategories.length}개 발견 / ${insertedCount}개 신규 저장.`);
            } 
            // 최하위 카테고리 로그는 extractSubCategories 내부에서 처리됨

            // 5. 현재 카테고리 완료 처리
            await markAsExplored(currentCategory.id);

        } catch (error) {
            console.error(`   ❌ 오류 발생: ${error.message}`);

            // 네트워크 오류 또는 타임아웃 발생 시 브라우저 재시작
            if (error.message.includes('ERR_PROXY_CONNECTION_FAILED') || error.name === 'TimeoutError' || error.message.includes('net::ERR')) {
                console.log("🌐 네트워크/프록시 오류 감지. 브라우저 재시작.");
                // initializeBrowser 호출 시 성공 여부를 확인하는 것이 좋습니다.
                if (!(await initializeBrowser())) {
                    console.error("🛑 브라우저 재시작 실패로 스크립트를 종료합니다.");
                    break;
               }
                continue; // 현재 카테고리를 다시 시도
            }

            // 기타 치명적 오류 시 탐색 완료로 표시하여 무한 루프 방지
            console.log("   ⚠️ 알 수 없는 오류 발생. 해당 카테고리를 건너뜁니다.");
            await markAsExplored(currentCategory.id);
        }
    }

    console.log("\n✅ 1단계 완료: 모든 카테고리 탐색이 완료되었습니다.");
    if (browser) await browser.close();
    if (dbPool) await dbPool.end();
}

// 스크립트 시작
runCategoryHarvester();