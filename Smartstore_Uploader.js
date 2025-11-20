// Smartstore_Uploader.js
const fs = require('fs').promises;
const path = require('path');
const naverClient = require('./Naver_API_Client');

const DATA_FILE = path.join(__dirname, 'smartstore_upload_data.json');

async function main() {
    console.log("🚀 Starting Smartstore Upload Process...");

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
        console.log(`\n🔄 Processing: [${product.originProductNo}] ${product.name.substring(0, 30)}...`);

        try {
            // A. 이미지 업로드 (대표 이미지)
            console.log("   📤 Uploading Main Image...");
            const mainImageUrl = await naverClient.uploadImage(product.representativeImage.url);
            if (!mainImageUrl) {
                console.error("   ❌ Main Image Upload Failed. Skipping product.");
                continue;
            }

            // B. 이미지 업로드 (추가 이미지)
            const optionalImageUrls = [];
            if (product.optionalImages && product.optionalImages.length > 0) {
                console.log(`   📤 Uploading ${product.optionalImages.length} Optional Images...`);
                for (const img of product.optionalImages) {
                    const url = await naverClient.uploadImage(img.url);
                    if (url) optionalImageUrls.push(url);
                }
            }

            // C. 상품 등록 요청 데이터 구성
            // 주의: 실제 네이버 API 필드명에 맞춰야 함. 아래는 예시 구조임.
            const requestData = {
                originProductNo: product.originProductNo,
                smartstoreChannelProduct: {
                    naverShoppingRegistration: true,
                    channelProductDisplayStatusType: "ON"
                },
                categoryId: product.categoryId,
                name: product.name,
                salePrice: product.salePrice,
                stockQuantity: product.stockQuantity,
                detailContent: product.detailContent,
                images: {
                    representativeImage: { url: mainImageUrl },
                    optionalImages: optionalImageUrls.map(url => ({ url: url }))
                },
                // 필수 고시 정보 (임시 값)
                productLogistics: {
                    shippingPolicy: {
                        deliveryMethodType: "DELIVERY",
                        feeType: "FREE",
                        // feePayType: "PREPAID",
                        // shippingFee: 0
                    }
                },
                productInfoProvidedNotice: {
                    productInfoProvidedNoticeType: "WEAR", // 의류 예시 (카테고리에 따라 다름)
                    wear: {
                        material: "상세페이지 참조",
                        color: "상세페이지 참조",
                        size: "상세페이지 참조",
                        manufacturer: "상세페이지 참조",
                        caution: "상세페이지 참조",
                        dateOfManufacture: "상세페이지 참조",
                        standard: "상세페이지 참조",
                        afterServiceManager: "상세페이지 참조",
                        origin: "기타(수입산)"
                    }
                }
            };

            // D. API 호출
            console.log("   🚀 Sending Product Create Request...");
            const result = await naverClient.createProduct(requestData);

            if (result) {
                console.log("   ✅ Upload Success!");
            } else {
                console.log("   ❌ Upload Failed.");
            }

            // Rate Limit 방지를 위한 대기
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            console.error(`   ❌ Error processing product ${product.originProductNo}:`, error.message);
        }
    }

    console.log("\n✅ All processes finished.");
}

if (require.main === module) {
    main();
}
