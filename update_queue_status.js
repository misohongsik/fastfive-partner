const mysql = require('mysql2/promise');

const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: '@Calla831031',
    database: 'amazon',
    port: 3306
};

async function updateQueueStatus() {
    let connection;
    try {
        connection = await mysql.createConnection(DB_CONFIG);

        console.log("📊 Queue ID 13507까지 상태를 COMPLETED로 업데이트합니다...");

        const [result] = await connection.query(
            `UPDATE amazon_product_queue SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP WHERE id <= 13507`
        );

        console.log(`✅ 완료: ${result.affectedRows}개의 행이 업데이트되었습니다.`);

    } catch (error) {
        console.error("❌ 오류 발생:", error);
    } finally {
        if (connection) await connection.end();
    }
}

updateQueueStatus();
