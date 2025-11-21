const mysql = require('mysql2/promise');

const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: '@Calla831031',
    database: 'amazon',
    port: 3306
};

async function checkStatus() {
    const conn = await mysql.createConnection(DB_CONFIG);
    try {
        const [rows] = await conn.query(
            "SELECT asin, status, updated_at FROM amazon_product_queue WHERE asin = 'B0DH233BTG'"
        );
        console.log(rows);
    } finally {
        await conn.end();
    }
}
checkStatus();
