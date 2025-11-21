const mysql = require('mysql2/promise');

const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: '@Calla831031',
    database: 'amazon',
    port: 3306
};

async function updateFailedToPending() {
    let connection;
    try {
        connection = await mysql.createConnection(DB_CONFIG);

        console.log("📊 Updating status from FAILED to PENDING in amazon_product_queue...");

        const [result] = await connection.query(
            `UPDATE amazon_product_queue SET status = 'PENDING', updated_at = CURRENT_TIMESTAMP WHERE status = 'FAILED'`
        );

        console.log(`✅ Success: ${result.affectedRows} rows updated.`);

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        if (connection) await connection.end();
    }
}

updateFailedToPending();
