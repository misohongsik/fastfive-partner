const mysql = require('mysql2/promise');

const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: '@Calla831031',
    database: 'amazon',
    port: 3306
};

async function resetProductForRecrawl() {
    const conn = await mysql.createConnection(DB_CONFIG);

    try {
        const asin = 'B0DH233BTG';
        const url = 'https://www.amazon.com/dp/B0DH233BTG';

        console.log(`\n🔄 ASIN ${asin} 재크롤링 준비 중...\n`);

        // 1. 기존 상품 데이터 삭제
        const [deleteResult] = await conn.query(
            'DELETE FROM amazon_products WHERE asin = ?',
            [asin]
        );
        console.log(`✅ 기존 상품 데이터 삭제: ${deleteResult.affectedRows}개`);

        // 2. 큐에 추가 (또는 상태 리셋)
        const [queueResult] = await conn.query(
            `INSERT INTO amazon_product_queue (product_url, asin, category_id, status, created_at, updated_at) 
             VALUES (?, ?, 3801, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON DUPLICATE KEY UPDATE 
                status = 'PENDING', 
                updated_at = CURRENT_TIMESTAMP`,
            [url, asin]
        );

        if (queueResult.affectedRows === 1) {
            console.log(`✅ 큐에 새로 추가됨`);
        } else {
            console.log(`✅ 큐 상태를 PENDING으로 리셋`);
        }

        console.log(`\n🎯 준비 완료! 이제 크롤러를 실행하세요:\n`);
        console.log(`   node detail_crawler_proxy.js\n`);

    } finally {
        await conn.end();
    }
}

resetProductForRecrawl().catch(console.error);
