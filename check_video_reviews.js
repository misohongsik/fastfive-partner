const mysql = require('mysql2/promise');

const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: '@Calla831031',
    database: 'amazon',
    port: 3306
};

async function checkVideoReviews() {
    let connection;
    try {
        connection = await mysql.createConnection(DB_CONFIG);

        console.log("📊 리뷰 데이터 분석 중...\n");

        // 1. 전체 상품 수
        const [totalProducts] = await connection.query(
            `SELECT COUNT(*) as total FROM amazon_products`
        );
        console.log(`총 상품 수: ${totalProducts[0].total}개\n`);

        // 2. reviews_json이 있는 상품 수
        const [productsWithReviews] = await connection.query(
            `SELECT COUNT(*) as count FROM amazon_products 
             WHERE reviews_json IS NOT NULL AND reviews_json != '[]'`
        );
        console.log(`리뷰가 있는 상품: ${productsWithReviews[0].count}개\n`);

        // 3. 미디어(이미지/영상)가 있는 리뷰 분석
        const [products] = await connection.query(
            `SELECT asin, title, reviews_json FROM amazon_products 
             WHERE reviews_json IS NOT NULL AND reviews_json != '[]' 
             LIMIT 100`
        );

        let reviewsWithMedia = 0;
        let reviewsWithoutMedia = 0;
        let totalReviews = 0;
        const sampleReviews = [];

        for (const product of products) {
            try {
                const reviews = JSON.parse(product.reviews_json);
                totalReviews += reviews.length;

                for (const review of reviews) {
                    if (review.media_url && review.media_url.length > 0) {
                        reviewsWithMedia++;

                        // 샘플 수집 (처음 5개만)
                        if (sampleReviews.length < 5) {
                            sampleReviews.push({
                                asin: product.asin,
                                title: product.title.substring(0, 50),
                                review_title: review.title,
                                media_count: review.media_url.length,
                                media_urls: review.media_url
                            });
                        }
                    } else {
                        reviewsWithoutMedia++;
                    }
                }
            } catch (e) {
                // JSON 파싱 실패 무시
            }
        }

        console.log("📈 리뷰 통계 (샘플 100개 상품 기준):\n");
        console.log(`총 리뷰 수: ${totalReviews}개`);
        console.log(`미디어 있는 리뷰: ${reviewsWithMedia}개 (${(reviewsWithMedia / totalReviews * 100).toFixed(1)}%)`);
        console.log(`미디어 없는 리뷰: ${reviewsWithoutMedia}개 (${(reviewsWithoutMedia / totalReviews * 100).toFixed(1)}%)\n`);

        if (sampleReviews.length > 0) {
            console.log("📋 미디어가 있는 리뷰 샘플:\n");
            sampleReviews.forEach((sample, idx) => {
                console.log(`${idx + 1}. [${sample.asin}] ${sample.title}...`);
                console.log(`   리뷰: "${sample.review_title}"`);
                console.log(`   미디어 ${sample.media_count}개:`);
                sample.media_urls.forEach((url, i) => {
                    console.log(`     ${i + 1}) ${url.substring(0, 80)}...`);
                });
                console.log('');
            });
        } else {
            console.log("⚠️ 미디어가 있는 리뷰를 찾지 못했습니다.\n");
        }

        // 4. 실제 비디오 URL 확인 (URL 패턴 분석)
        console.log("🎬 비디오 URL 패턴 분석:\n");
        let videoUrlCount = 0;
        let imageUrlCount = 0;

        for (const sample of sampleReviews) {
            for (const url of sample.media_urls) {
                if (url.includes('.mp4') || url.includes('video') || url.includes('.webm')) {
                    videoUrlCount++;
                } else if (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('images/I/')) {
                    imageUrlCount++;
                }
            }
        }

        console.log(`비디오로 추정되는 URL: ${videoUrlCount}개`);
        console.log(`이미지로 추정되는 URL: ${imageUrlCount}개\n`);

        if (videoUrlCount === 0) {
            console.log("❌ 현재 크롤링된 리뷰에는 실제 비디오 URL이 없는 것으로 보입니다.");
            console.log("   리뷰 '비디오 썸네일 이미지'만 수집되었을 가능성이 높습니다.\n");
        }

    } catch (error) {
        console.error("❌ 오류 발생:", error);
    } finally {
        if (connection) await connection.end();
    }
}

checkVideoReviews();
