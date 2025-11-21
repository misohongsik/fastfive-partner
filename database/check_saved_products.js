const mysql = require('mysql2/promise');

const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: '@Calla831031',
    database: 'amazon',
    port: 3306
};

async function checkSavedProducts() {
    let connection;
    try {
        connection = await mysql.createConnection(DB_CONFIG);

        console.log("📊 Queue ID 12673 ~ 13500 범위 분석\n");

        // 1. Queue 범위 내 총 항목 수
        const [queueCount] = await connection.query(
            `SELECT COUNT(*) as total FROM amazon_product_queue WHERE id BETWEEN 12673 AND 13500`
        );
        console.log(`Queue 항목 수: ${queueCount[0].total}개\n`);

        // 2. 해당 범위에서 저장된 상품 수 확인 (source_category_id로 추정)
        const [savedProducts] = await connection.query(
            `SELECT COUNT(*) as saved FROM amazon_products WHERE id IN (
                SELECT id FROM amazon_products 
                WHERE created_at >= (SELECT MIN(created_at) FROM amazon_product_queue WHERE id = 12673)
                AND created_at <= (SELECT MAX(updated_at) FROM amazon_product_queue WHERE id = 13500)
            )`
        );
        console.log(`저장된 상품 수: ${savedProducts[0].saved}개\n`);

        // 3. 샘플 ASIN 5개 조회 및 DB 확인
        const [sampleQueue] = await connection.query(
            `SELECT id, asin, product_url FROM amazon_product_queue WHERE id BETWEEN 12673 AND 13500 LIMIT 5`
        );

        console.log("📋 샘플 ASIN 5개 DB 저장 여부:\n");
        for (const item of sampleQueue) {
            const [product] = await connection.query(
                `SELECT asin, title FROM amazon_products WHERE asin = ?`, [item.asin]
            );

            if (product.length > 0) {
                console.log(`✅ Queue ${item.id} - ASIN ${item.asin}: 저장됨`);
                console.log(`   제목: ${product[0].title.substring(0, 60)}...\n`);
            } else {
                console.log(`❌ Queue ${item.id} - ASIN ${item.asin}: 저장 안됨`);
                console.log(`   URL: ${item.product_url}\n`);
            }
        }

        // 4. 전체 통계
        console.log("\n📈 전체 통계:");
        const [totalQueue] = await connection.query(`SELECT COUNT(*) as total FROM amazon_product_queue`);
        const [totalProducts] = await connection.query(`SELECT COUNT(*) as total FROM amazon_products`);
        console.log(`전체 Queue: ${totalQueue[0].total}개`);
        console.log(`전체 저장된 상품: ${totalProducts[0].total}개`);
        console.log(`저장 비율: ${(totalProducts[0].total / totalQueue[0].total * 100).toFixed(2)}%`);

    } catch (error) {
        console.error("❌ 오류 발생:", error);
    } finally {
        if (connection) await connection.end();
    }
}

checkSavedProducts();
