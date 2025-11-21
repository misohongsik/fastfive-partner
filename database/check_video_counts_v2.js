const mysql = require('mysql2/promise');
const fs = require('fs');

const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: '@Calla831031',
    database: 'amazon',
    port: 3306
};

async function checkVideoCounts() {
    let connection;
    try {
        connection = await mysql.createConnection(DB_CONFIG);

        let output = "Diagnostic Results:\n";

        // Check amazon_products counts
        const [totalProducts] = await connection.query("SELECT COUNT(*) as count FROM amazon_products");
        const [nullVideos] = await connection.query("SELECT COUNT(*) as count FROM amazon_products WHERE videos_json IS NULL");
        const [emptyStringVideos] = await connection.query("SELECT COUNT(*) as count FROM amazon_products WHERE videos_json = ''");
        const [emptyArrayVideos] = await connection.query("SELECT COUNT(*) as count FROM amazon_products WHERE videos_json = '[]'");
        const [nullStringVideos] = await connection.query("SELECT COUNT(*) as count FROM amazon_products WHERE videos_json = 'null'");

        output += `Total Products: ${totalProducts[0].count}\n`;
        output += `videos_json IS NULL: ${nullVideos[0].count}\n`;
        output += `videos_json = '': ${emptyStringVideos[0].count}\n`;
        output += `videos_json = '[]': ${emptyArrayVideos[0].count}\n`;
        output += `videos_json = 'null': ${nullStringVideos[0].count}\n`;

        // Check overlap with queue
        // We want to see how many items in queue match these conditions, regardless of current status
        const [overlap] = await connection.query(`
            SELECT COUNT(*) as count 
            FROM amazon_products p
            JOIN amazon_product_queue q ON p.asin = q.asin
            WHERE (p.videos_json IS NULL OR p.videos_json = '' OR p.videos_json = '[]' OR p.videos_json = 'null')
        `);
        output += `Queue items with missing/empty video in Products: ${overlap[0].count}\n`;

        fs.writeFileSync('diagnostic_results.txt', output);
        console.log("Results written to diagnostic_results.txt");

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        if (connection) await connection.end();
    }
}

checkVideoCounts();
