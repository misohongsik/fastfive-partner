// Coupang_Uploader.js
const fs = require('fs').promises;
const path = require('path');
const coupangClient = require('./Coupang_API_Client');

const DATA_FILE = path.join(__dirname, 'coupang_upload_data.json');

async function main() {
    console.log("🚀 Starting Coupang Upload Process...");

    // 1. 데이터 파일 읽기
    let products = [];
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        products = JSON.parse(data);
        console.log(`📦 Loaded ${products.length} products from ${DATA_FILE}`);
    } catch (error) {
        console.error("❌ Failed to read data file:", error.message);
        return;
    }

    // 2. 제품 순회 및 업로드
    for (const product of products) {
        console.log(`\n🔄 Processing: ${product.sellerProductName.substring(0, 30)}...`);

        try {
            // A. 이미지 업로드 (Main + Detail)
            // product.images 배열을 순회하며 업로드
            const uploadedImages = [];
            let imageUploadFailed = false;

            for (const imgObj of product.images) {
                console.log(`   📤 Uploading Image (${imgObj.imageType})...`);

                // imgObj.vendorPath에 원본 URL이 들어있음
                const cdnUrl = await coupangClient.uploadImage(imgObj.vendorPath);

                if (cdnUrl) {
                    // 업로드 성공 시 URL 교체
                    // 쿠팡 API에서는 vendorPath에 http 경로를 넣으면 됨 (쿠팡 CDN 경로도 가능)
                    uploadedImages.push({
                        ...imgObj,
                        vendorPath: cdnUrl
                    });
                } else {
                    console.error(`   ❌ Image Upload Failed: ${imgObj.vendorPath}`);
                    // 필수 이미지(대표)가 실패하면 상품 등록 불가
                    if (imgObj.imageType === 'REPRESENTATION') {
                        imageUploadFailed = true;
                        break;
                    }
                    // 상세 이미지는 실패해도 건너뛰고 진행 (선택사항)
                }
            }

            if (imageUploadFailed) {
                console.error("   ❌ Main Image Upload Failed. Skipping product.");
                continue;
            }

            // 이미지 정보 교체
            product.images = uploadedImages;

            // B. 상품 등록 요청
            console.log("   🚀 Sending Product Create Request...");
            const result = await coupangClient.createProduct(product);

            if (result) {
                console.log(`   ✅ Upload Success! Product ID: ${result.productId}`);
            } else {
                console.log("   ❌ Upload Failed.");
            }

            // Rate Limit 방지 (1초 대기)
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            console.error(`   ❌ Error processing product:`, error.message);
        }
    }

    console.log("\n✅ All processes finished.");
}

if (require.main === module) {
    main();
}
