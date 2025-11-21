const mysql = require('mysql2/promise');
const fs = require('fs');

const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: '@Calla831031',
    database: 'amazon',
    port: 3306
};

async function inspectData() {
    let connection;
    try {
        connection = await mysql.createConnection(DB_CONFIG);

        let output = "Data Inspection:\n\n";

        // 1. Sample videos_json values
        const [samples] = await connection.query("SELECT asin, videos_json FROM amazon_products WHERE videos_json IS NOT NULL LIMIT 20");
        output += "Sample videos_json values (NOT NULL):\n";
        samples.forEach(row => {
            const val = typeof row.videos_json === 'object' ? JSON.stringify(row.videos_json) : row.videos_json;
            output += `[${row.asin}] ${val.substring(0, 100)}...\n`;
        });

        // 2. Queue Status Distribution
        const [statusDist] = await connection.query("SELECT status, COUNT(*) as count FROM amazon_product_queue GROUP BY status");
        output += "\nQueue Status Distribution:\n";
        statusDist.forEach(row => {
            output += `${row.status}: ${row.count}\n`;
        });

        // 3. Check for "empty" JSON arrays if they are stored as JSON type
        // If column is JSON type, we can use JSON_LENGTH
        try {
            const [jsonEmpty] = await connection.query("SELECT COUNT(*) as count FROM amazon_products WHERE JSON_LENGTH(videos_json) = 0");
            output += `\nJSON_LENGTH(videos_json) = 0: ${jsonEmpty[0].count}\n`;
        } catch (e) {
            output += `\nJSON_LENGTH check failed: ${e.message}\n`;
        }

        fs.writeFileSync('inspection_results.txt', output);
        console.log("Results written to inspection_results.txt");

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        if (connection) await connection.end();
    }
}

inspectData();
