const mysql = require('mysql2/promise');

const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: '@Calla831031',
    database: 'amazon',
    port: 3306
};

async function checkReviewsRaw() {
    let connection;
    try {
        connection = await mysql.createConnection(DB_CONFIG);

        console.log("📊 리뷰 데이터 원본 확인 중...\n");

        // 1. reviews_json 샘플 10개 직접 조회
        const [products] = await connection.query(
            `SELECT asin, title, reviews_json 
             FROM amazon_products 
             WHERE reviews_json IS NOT NULL 
             AND LENGTH(reviews_json) > 10
             LIMIT 10`
        );

        console.log(`샘플 ${products.length}개 상품의 reviews_json:\n`);

        for (const product of products) {
            console.log(`\n[${product.asin}] ${product.title.substring(0, 50)}...`);
            console.log(`reviews_json 길이: ${product.reviews_json.length} bytes`);
            console.log(`내용 (처음 500자):`);
            console.log(product.reviews_json.substring(0, 500));
            console.log('---');

            // JSON 파싱 시도
            try {
                const reviews = JSON.parse(product.reviews_json);
                console.log(`✅ 파싱 성공: ${Array.isArray(reviews) ? reviews.length : 'NOT ARRAY'}개 리뷰`);

                if (Array.isArray(reviews) && reviews.length > 0) {
                    console.log(`첫 번째 리뷰:`);
                    console.log(JSON.stringify(reviews[0], null, 2));
                }
            } catch (e) {
                console.log(`❌ JSON 파싱 실패: ${e.message}`);
            }
            console.log('\n' + '='.repeat(80) + '\n');
        }

    } catch (error) {
        console.error("❌ 오류 발생:", error);
    } finally {
        if (connection) await connection.end();
    }
}

checkReviewsRaw();
