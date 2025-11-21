const mysql = require('mysql2/promise');

const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: '@Calla831031',
    database: 'amazon',
    port: 3306
};

async function updateQueueBasedOnVideos() {
    let connection;
    try {
        connection = await mysql.createConnection(DB_CONFIG);
        console.log("🔌 Connected to database.");

        console.log("🔍 Finding products with NULL videos_json and updating queue status...");

        // Execute the update query
        // Using a subquery to find ASINs with NULL videos_json OR empty JSON array
        const [result] = await connection.query(`
            UPDATE amazon_product_queue 
            SET status = 'PENDING', updated_at = CURRENT_TIMESTAMP 
            WHERE asin IN (
                SELECT asin FROM amazon_products 
                WHERE videos_json IS NULL OR JSON_LENGTH(videos_json) = 0
            )
        `);

        console.log(`✅ Update Complete.`);
        console.log(`📊 Rows affected: ${result.affectedRows}`);
        console.log(`ℹ️  ${result.affectedRows} products have been reset to PENDING status because they have no video data.`);

    } catch (error) {
        console.error("❌ Error executing update:", error);
    } finally {
        if (connection) {
            await connection.end();
            console.log("🔌 Connection closed.");
        }
    }
}

updateQueueBasedOnVideos();
