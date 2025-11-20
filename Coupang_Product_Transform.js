// Coupang_Product_Transform.js
const path = require('path');
const fs = require('fs').promises;
const mysql = require('mysql2/promise');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();
const { getCoupangCategoryCode, getProductNoticeTemplate } = require('./Coupang_Category_Map');

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
const OUTPUT_FILE = path.join(__dirname, 'coupang_upload_data.json');

// --- Gemini API 설정 ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("❌ ERROR: GEMINI_API_KEY environment variable is not set in .env file.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
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
// 유틸리티 함수
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
// 핵심 로직 함수
// =============================================================================

async function getProducts() {
    const query = `
        SELECT * FROM amazon_products LIMIT 10;
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

function buildGeminiPrompt(productRecord, parsedData) {
    const inputData = JSON.stringify({
        title: productRecord.title,
        brand: productRecord.brand,
        features: parsedData.features,
        all_image_urls: parsedData.allImageUrls,
        product_videos: parsedData.productVideos,
    });

    const prompt = `
        당신은 쿠팡(Coupang)의 전문 웹 디자이너입니다. 
        이 상품의 상세 페이지 HTML을 작성해 주세요.

        --- ⚠️ 필수 지침 ---
        1. **형식:** 오직 <div>로 시작하고 끝나는 순수 HTML 코드만 출력하세요.
        2. **이미지:** 제공된 'all_image_urls'를 사용하여 <img> 태그를 배치하세요 (style="width:100%; max-width:860px; display:block; margin: 0 auto;").
        3. **동영상(중요):** 'product_videos' 데이터가 있다면, 상세페이지 최상단에 **<video>** 태그를 사용하여 영상을 삽입하세요.
           - <video controls autoplay muted loop style="width:100%; max-width:860px;">
           - <source src="비디오URL" type="video/mp4">
           - </video>
           - 만약 비디오 URL이 없다면 이 섹션은 생략하세요.

        4. **내용 구성:**
           - **[동영상 섹션]** (있을 경우)
           - 헤더: 상품명, 브랜드
           - 핵심 요약: 고객이 얻을 이점 3가지
           - 상세 특징: 스펙 및 기능 설명
           - 이미지 갤러리: 고화질 이미지들을 세로로 배치

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
        htmlContent = htmlContent.replace(/^```html\s*|^\s*```\s*|\s*```\s*$/g, '').trim();
        if (!htmlContent) return "<p>상세 페이지 생성에 실패했습니다.</p>";
        return htmlContent;
    } catch (error) {
        console.error("❌ Gemini API Error:", error.message);
        return `<p>API 호출 중 오류가 발생했습니다: ${error.message}</p>`;
    }
}

async function prepareCoupangData(productRecord) {
    try {
        if (!productRecord.title || !productRecord.main_image_url) {
            console.warn(`⚠️ Skipping ASIN: ${productRecord.asin} (제목 또는 메인 이미지 없음)`);
            return null;
        }

        const parsedData = {
            features: safeJsonParse(productRecord.bullet_points, []),
            allImageUrls: safeJsonParse(productRecord.all_image_urls, []),
            productVideos: safeJsonParse(productRecord.videos_json, []),
        };

        const salePrice = calculateKRWPrice(productRecord.price_usd, productRecord.shipping_usd || 0);
        if (salePrice === 0) {
            console.warn(`⚠️ Skipping ASIN: ${productRecord.asin} (가격 정보 오류)`);
            return null;
        }

        console.log(`🤖 Generating HTML for ${productRecord.asin}...`);
        const geminiPrompt = buildGeminiPrompt(productRecord, parsedData);
        const detailContentHtml = await callGeminiApi(geminiPrompt);

        // 쿠팡 카테고리 코드 및 고시 정보 가져오기
        // amazon_products 테이블에는 full_path 정보가 없을 수 있음 (JOIN 필요할 수 있으나, 여기서는 간단히 처리)
        // 만약 full_path가 없다면 기본값 처리
        const displayCategoryCode = getCoupangCategoryCode(null);
        const productNotices = getProductNoticeTemplate(displayCategoryCode);

        return {
            displayCategoryCode: displayCategoryCode,
            sellerProductName: productRecord.title.substring(0, 100),
            vendorId: process.env.COUPANG_VENDOR_ID,
            saleStartedAt: new Date().toISOString(),
            saleEndedAt: "2099-12-31T23:59:59",
            displayProductName: productRecord.title.substring(0, 100),
            brand: productRecord.brand || '상세페이지 참조',
            generalProductName: productRecord.title.substring(0, 100),
            productGroup: "기타", // 상품군
            deliveryMethod: "AGENT_BUY", // 구매대행
            deliveryCompanyCode: "KOREA_POST", // 우체국택배 (임시)
            deliveryChargeType: "FREE", // 무료배송
            deliveryCharge: 0,
            freeShipOverAmount: 0,
            deliveryChargeOnReturn: 3000,
            remoteAreaDeliverable: "N",
            unionDeliveryType: "UNION_DELIVERY",
            returnCenterCode: "1000274492", // 반품지 코드 (사용자 확인 필요 - 임시값)
            returnCharge: 3000,
            afterServiceInformation: "상세페이지 참조",
            afterServiceContactNumber: "010-0000-0000", // 임시값
            outboundShippingPlaceCode: "12345", // 출고지 코드 (사용자 확인 필요 - 임시값)
            vendorUserId: "user", // 임시값

            // 중요: 이미지와 상세설명
            // 이미지는 Uploader에서 업로드 후 URL 교체 예정
            images: [
                {
                    imageOrder: 0,
                    imageType: "REPRESENTATION",
                    vendorPath: productRecord.main_image_url
                },
                ...parsedData.allImageUrls.slice(0, 8).map((url, index) => ({
                    imageOrder: index + 1,
                    imageType: "DETAIL",
                    vendorPath: url
                }))
            ],
            contents: [
                {
                    contentsType: "HTML",
                    contentDetails: [
                        {
                            content: detailContentHtml,
                            detailType: "TEXT"
                        }
                    ]
                }
            ],
            productNotices: productNotices,
            attributes: [] // 옵션 등
        };
    } catch (error) {
        console.error(`❌ Error processing ASIN ${productRecord.asin}:`, error);
        return null;
    }
}

async function main() {
    console.log("🚀 Starting Coupang Data Generation...");
    const startTime = Date.now();

    try {
        const productRecords = await getProducts();
        if (productRecords.length === 0) {
            console.log("No products found.");
            return;
        }

        console.log("🔄 Processing products & Calling AI...");
        const promises = productRecords.map(record => prepareCoupangData(record));
        const results = await Promise.all(promises);
        const coupangDataArray = results.filter(item => item !== null);

        console.log(`💾 Saving ${coupangDataArray.length} items to ${OUTPUT_FILE}...`);
        await fs.writeFile(OUTPUT_FILE, JSON.stringify(coupangDataArray, null, 2));

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
