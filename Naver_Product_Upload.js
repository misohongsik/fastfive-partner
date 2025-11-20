// =============================================================================
// 1. 환경 설정 및 모듈 로드
// =============================================================================
const path = require('path');
const fs = require('fs').promises;
const mysql = require('mysql2/promise');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();
const { getNaverCategoryId } = require('./category_map');

// --- DB 설정 ---
const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || 'amazon',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    connectionLimit: 5,
    waitForConnections: true
};

// --- 설정값 ---
const EXCHANGE_RATE = 1350;
const MARGIN_RATE = 1.2;
const TEMP_CATEGORY_ID = '50000000'; // 스마트스토어 임시 카테고리 코드 (기본값)
const OUTPUT_FILE = path.join(__dirname, 'smartstore_upload_data.json');

// --- Gemini API 설정 ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("❌ ERROR: GEMINI_API_KEY environment variable is not set in .env file.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({
    model: "gemini-2.0-flash", // 2.0이 안되면 gemini-1.5-flash 로 변경
    generationConfig: {
        temperature: 0.5,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 8192,
        responseMimeType: "text/plain",
    },
});

let pool;
try {
    pool = mysql.createPool(DB_CONFIG);
} catch (error) {
    console.error('❌ Failed to initialize MySQL Connection Pool:', error);
    process.exit(1);
}

// =============================================================================
// 2. 유틸리티 함수
// =============================================================================

function safeJsonParse(jsonString, defaultValue = []) {
    if (!jsonString) return defaultValue;
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        return defaultValue;
    }
}

function calculateKRWPrice(usdPrice, usdShipping = 0) {
    const price = parseFloat(usdPrice);
    const shipping = parseFloat(usdShipping);
    if (isNaN(price) || price <= 0) return 0;
    const totalPriceUSD = price + (isNaN(shipping) ? 0 : shipping);
    const priceKRW = totalPriceUSD * EXCHANGE_RATE * MARGIN_RATE;
    return Math.ceil(priceKRW / 10) * 10;
}

// =============================================================================
// 3. 핵심 로직 함수
// =============================================================================

/** A. 데이터베이스 연동 및 조회 (JOIN 복구 및 컬럼명 수정) */
async function getProductsWithCategory() {
    // ⭐ 핵심 수정: p.source_category_id = c.id
    // 스크린샷에서 확인한 정확한 컬럼명을 사용합니다.
    const query = `
        SELECT
            p.*,
            c.id AS category_table_id,
            c.category_name,
            c.full_path
        FROM
            amazon_products p
        INNER JOIN
            amazon_bsr_categories c
        ON
            p.source_category_id = c.id
        LIMIT 10; -- ⭐ 테스트용: 10개만 먼저 실행 (잘 되면 주석 처리)
    `;

    try {
        const [rows] = await pool.query(query);
        console.log(`🔍 Successfully retrieved ${rows.length} products from the database.`);
        return rows;
    } catch (error) {
        console.error('❌ Error executing database query:', error);
        throw error;
    }
}

/** C. 상세 페이지 맞춤 지침 함수 */
function getCategorySpecificInstructions(categoryName, fullPath) {
    let mainCategory = categoryName || 'General';
    // fullPath가 있을 경우 더 정확하게 분류
    const pathStr = fullPath || '';

    if (pathStr.includes('Electronics') || pathStr.includes('Computers')) mainCategory = 'Electronics';
    else if (pathStr.includes('Fashion') || pathStr.includes('Clothing') || pathStr.includes('Jewelry')) mainCategory = "Women's Fashion";
    else if (pathStr.includes('Industrial') || pathStr.includes('Scientific')) mainCategory = 'Industrial & Scientific';

    switch (mainCategory) {
        case 'Electronics':
            return `
                - **강조 포인트:** 제품 스펙(성능, 호환성, 배터리 수명)을 명확하게 제시하세요.
                - **시각 자료:** 기술적 특징을 보여주는 이미지와 스펙 표를 적극 활용하세요.
                - **어조:** 전문적이고 신뢰감 있는 어조.
            `;
        case "Women's Fashion":
            return `
                - **강조 포인트:** 디자인, 색상, 소재, 핏감을 감성적으로 설명하세요.
                - **시각 자료:** 모델 착용샷과 질감을 보여주는 클로즈업 이미지를 배치하세요.
                - **어조:** 트렌디하고 감성적인 어조.
            `;
        case 'Industrial & Scientific':
            return `
                - **강조 포인트:** 정확성, 내구성, 산업 표준 준수 여부를 강조하세요.
                - **시각 자료:** 구조도, 치수 도면 등을 활용하세요.
                - **어조:** 간결하고 사실적인 어조.
            `;
        default:
            return `
                - **기본 지침:** 고객이 얻을 수 있는 핵심 이점(Benefit)을 중심으로 설명하세요.
            `;
    }
}

/** 3. Gemini API 프롬프트 생성 */
function buildGeminiPrompt(productRecord, parsedData) {
    const categoryName = productRecord.category_name || '상품';
    const fullPath = productRecord.full_path || '';
    const categoryInstructions = getCategorySpecificInstructions(categoryName, fullPath);

    const inputData = JSON.stringify({
        title: productRecord.title,
        brand: productRecord.brand,
        features: parsedData.features,
        rating: productRecord.rating,
        review_count: productRecord.review_count,
        all_image_urls: parsedData.allImageUrls,
        product_videos: parsedData.productVideos,
        customer_reviews: parsedData.customerReviews,
    });

    const prompt = `
        당신은 네이버 스마트스토어의 전문 웹 디자이너입니다. 
        카테고리 "${categoryName}"에 속하는 이 상품의 상세 페이지 HTML을 작성해 주세요.

        --- ⚠️ 필수 지침 (지키지 않으면 오류 발생) ---
        1. **형식:** 오직 <div>로 시작하고 끝나는 순수 HTML 코드만 출력하세요. (\`\`\`html, <style>, <script>, <html>, <body> 태그 절대 금지)
        2. **이미지:** 제공된 'all_image_urls'를 사용하여 <img> 태그를 배치하세요 (style="width:100%; max-width:860px;").
        3. **동영상(중요):** 'product_videos' 데이터가 있다면, 상세페이지 상단이나 중간에 **[생생한 영상 갤러리]** 섹션을 만들고, 썸네일 이미지를 배치하세요.
           - 썸네일은 <img> 태그로 표시하고, 클릭 유도 문구("영상으로 확인하기" 등)를 함께 넣어주세요.
           - 'reviews_json'에 동영상 리뷰가 있다면 '리뷰 하이라이트' 섹션에 우선적으로 노출하고 "동영상 리뷰" 뱃지를 달아주세요.

        4. **내용 구성:**
           - 헤더: 상품명, 브랜드, 평점
           - **[New] 생생한 영상 갤러리**: (동영상이 있을 경우만 생성)
           - 핵심 요약: 고객이 얻을 이점 3가지
           - 상세 특징: 스펙 및 기능 설명 (가독성 좋은 리스트 형태)
           - 리뷰 하이라이트: 긍정적인 리뷰 내용 인용 (동영상 리뷰 우선)

        --- 카테고리별 스타일 가이드 ---
        ${categoryInstructions}

        --- 상품 데이터 ---
        ${inputData}
    `;
    return prompt;
}

async function callGeminiApi(prompt) {
    try {
        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        let htmlContent = response.text();

        // 마크다운 제거 (매우 중요)
        htmlContent = htmlContent.replace(/^```html\s*|^\s*```\s*|\s*```\s*$/g, '').trim();

        if (!htmlContent) return "<p>상세 페이지 생성에 실패했습니다.</p>";
        return htmlContent;
    } catch (error) {
        console.error("❌ Gemini API Error:", error.message);
        return `<p>API 호출 중 오류가 발생했습니다: ${error.message}</p>`;
    }
}

/** D. 데이터 변환 및 처리 */
async function prepareSmartstoreData(productRecord) {
    try {
        // 필수 데이터 검증
        if (!productRecord.title || !productRecord.main_image_url) {
            console.warn(`⚠️ Skipping ASIN: ${productRecord.asin} (제목 또는 메인 이미지 없음)`);
            return null;
        }

        const parsedData = {
            features: safeJsonParse(productRecord.bullet_points, []), // 컬럼명 주의: bullet_points (스크린샷 기반)
            allImageUrls: safeJsonParse(productRecord.all_image_urls, []),
            productVideos: safeJsonParse(productRecord.videos_json, []),
            customerReviews: safeJsonParse(productRecord.reviews_json, [])
        };

        // 가격 계산
        const salePrice = calculateKRWPrice(productRecord.price_usd, productRecord.shipping_usd || 0);
        if (salePrice === 0) {
            console.warn(`⚠️ Skipping ASIN: ${productRecord.asin} (가격 정보 오류)`);
            return null;
        }

        console.log(`🤖 Generating HTML for [${productRecord.category_name}] ${productRecord.asin}...`);
        const geminiPrompt = buildGeminiPrompt(productRecord, parsedData);
        const detailContentHtml = await callGeminiApi(geminiPrompt);

        return {
            originProductNo: productRecord.asin,
            name: productRecord.title.substring(0, 100),
            categoryId: getNaverCategoryId(productRecord.full_path),
            salePrice: salePrice,
            stockQuantity: 100,
            detailContent: detailContentHtml,
            representativeImage: { url: productRecord.main_image_url },
            optionalImages: parsedData.allImageUrls
                .filter(url => url !== productRecord.main_image_url)
                .slice(0, 9)
                .map(url => ({ url: url })),
            _meta: {
                amazon_full_path: productRecord.full_path
            }
        };
    } catch (error) {
        console.error(`❌ Error processing ASIN ${productRecord.asin}:`, error);
        return null;
    }
}

// =============================================================================
// 4. 메인 실행
// =============================================================================
async function main() {
    console.log("🚀 Starting Smartstore Data Generation...");
    const startTime = Date.now();

    try {
        // 1. DB 조회
        const productRecords = await getProductsWithCategory();
        if (productRecords.length === 0) {
            console.log("No products found.");
            return;
        }

        // 2. 병렬 처리 (속도 향상)
        console.log("🔄 Processing products & Calling AI...");
        const promises = productRecords.map(record => prepareSmartstoreData(record));
        const results = await Promise.all(promises);
        const smartstoreDataArray = results.filter(item => item !== null);

        // 3. 결과 저장
        console.log(`💾 Saving ${smartstoreDataArray.length} items to ${OUTPUT_FILE}...`);
        await fs.writeFile(OUTPUT_FILE, JSON.stringify(smartstoreDataArray, null, 2));

        console.log(`✅ Complete! (${(Date.now() - startTime) / 1000}s)`);

    } catch (error) {
        console.error("❌ Main Error:", error);
    } finally {
        if (pool) await pool.end();
    }
}

if (require.main === module) {
    main();
}