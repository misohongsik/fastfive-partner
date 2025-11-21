const mysql = require('mysql2/promise');

const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: '@Calla831031',
    database: 'amazon',
    port: 3306
};

const TARGET_ASIN = 'B091PZDB8X';
const TARGET_URL = 'https://www.amazon.com/dp/B091PZDB8X';

async function fixQueue() {
    const conn = await mysql.createConnection(DB_CONFIG);
    try {
        console.log(`🧹 큐 정리 중... (${TARGET_ASIN})`);

        // 1. 해당 ASIN의 모든 큐 항목 삭제
        await conn.query("DELETE FROM amazon_product_queue WHERE asin = ?", [TARGET_ASIN]);

        // 2. 해당 ASIN의 상품 데이터 삭제 (재수집 위해)
        await conn.query("DELETE FROM amazon_products WHERE asin = ?", [TARGET_ASIN]);

        // 3. 깔끔하게 하나만 새로 추가
        await conn.query(
            `INSERT INTO amazon_product_queue (product_url, asin, category_id, status, created_at, updated_at) 
             VALUES (?, ?, 3801, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [TARGET_URL, TARGET_ASIN]
        );
        console.log(`✅ ${TARGET_ASIN} 재설정 완료 (PENDING 상태)`);
    } catch (error) {
        console.error("❌ 오류 발생:", error);
    } finally {
        await conn.end();
    }
}

fixQueue();
