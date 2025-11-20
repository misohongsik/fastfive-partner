const mysql = require('mysql2/promise');
const { isSafeProduct } = require('./Product_Filter');

const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: '@Calla831031',
    database: 'amazon',
    port: 3306
};

async function cleanDatabase() {
    console.log("🧹 데이터베이스 청소 시작...");
    let connection;
    try {
        connection = await mysql.createConnection(DB_CONFIG);

        // 1. 모든 상품 조회
        const [rows] = await connection.query("SELECT id, title, asin FROM amazon_products");
        console.log(`📊 총 ${rows.length}개의 상품을 검사합니다.`);

        const idsToDelete = [];
        const deletedTitles = [];

        for (const product of rows) {
            // isSafeProduct는 안전하면 true, 위험하면 false 반환
            // 따라서 !isSafeProduct() 가 true이면 삭제 대상
            if (!isSafeProduct(product.title)) {
                idsToDelete.push(product.id);
                deletedTitles.push(`[${product.asin}] ${product.title.substring(0, 50)}...`);
            }
        }

        if (idsToDelete.length > 0) {
            console.log(`\n🚫 총 ${idsToDelete.length}개의 금지된 상품을 발견했습니다:`);
            deletedTitles.forEach(t => console.log(`   - ${t}`));

            // 삭제 실행
            const placeholders = idsToDelete.map(() => '?').join(',');
            const [result] = await connection.query(
                `DELETE FROM amazon_products WHERE id IN (${placeholders})`,
                idsToDelete
            );
            console.log(`\n🗑️  삭제 완료: ${result.affectedRows}개 행이 삭제되었습니다.`);
        } else {
            console.log("\n✅ 금지된 상품이 발견되지 않았습니다. 데이터베이스가 깨끗합니다.");
        }

    } catch (error) {
        console.error("❌ 오류 발생:", error);
    } finally {
        if (connection) await connection.end();
    }
}

cleanDatabase();
