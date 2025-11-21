const mysql = require('mysql2/promise');

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
        console.log("🔌 Connected to database.");

        // Check amazon_products counts
        const [totalProducts] = await connection.query("SELECT COUNT(*) as count FROM amazon_products");
        const [nullVideos] = await connection.query("SELECT COUNT(*) as count FROM amazon_products WHERE videos_json IS NULL");
        const [emptyStringVideos] = await connection.query("SELECT COUNT(*) as count FROM amazon_products WHERE videos_json = ''");
        const [emptyArrayVideos] = await connection.query("SELECT COUNT(*) as count FROM amazon_products WHERE videos_json = '[]'");
        const [nullStringVideos] = await connection.query("SELECT COUNT(*) as count FROM amazon_products WHERE videos_json = 'null'");

        console.log("\n📊 Amazon Products Analysis:");
        console.log(`Total Products: ${totalProducts[0].count}`);
        console.log(`videos_json IS NULL: ${nullVideos[0].count}`);
        console.log(`videos_json = '': ${emptyStringVideos[0].count}`);
        console.log(`videos_json = '[]': ${emptyArrayVideos[0].count}`);
        console.log(`videos_json = 'null': ${nullStringVideos[0].count}`);

        // Check amazon_product_queue counts
        const [totalQueue] = await connection.query("SELECT COUNT(*) as count FROM amazon_product_queue");
        const [failedQueue] = await connection.query("SELECT COUNT(*) as count FROM amazon_product_queue WHERE status = 'FAILED'");

        console.log("\n📊 Amazon Product Queue Analysis:");
        console.log(`Total Queue Items: ${totalQueue[0].count}`);
        console.log(`Status = 'FAILED': ${failedQueue[0].count}`);

        // Check overlap
        const [potentialTargets] = await connection.query(`
            SELECT COUNT(*) as count 
            FROM amazon_products p
            JOIN amazon_product_queue q ON p.asin = q.asin
            WHERE (p.videos_json IS NULL OR p.videos_json = '' OR p.videos_json = '[]' OR p.videos_json = 'null')
        `);
        console.log(`\n🎯 Potential targets (Queue items with missing/empty video in Products): ${potentialTargets[0].count}`);

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        if (connection) await connection.end();
    }
}

checkVideoCounts();
