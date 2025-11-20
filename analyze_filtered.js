const mysql = require('mysql2/promise');
const { bannedKeywords } = require('./Product_Filter');

const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: '@Calla831031',
    database: 'amazon',
    port: 3306
};

async function analyzeFilteredProducts() {
    let connection;
    try {
        connection = await mysql.createConnection(DB_CONFIG);

        console.log("📊 Queue ID 12673 ~ 13500 범위의 상품 분석 중...\n");

        // Queue에서 ASIN과 URL 조회
        const [queueItems] = await connection.query(
            `SELECT id, asin, product_url FROM amazon_product_queue WHERE id BETWEEN 12673 AND 13500 ORDER BY id`
        );

        console.log(`총 ${queueItems.length}개의 Queue 항목을 찾았습니다.\n`);

        // 각 ASIN에 대해 제목 추출 및 필터 분석
        const keywordStats = {};
        let filteredCount = 0;

        for (const item of queueItems) {
            // URL에서 제목 추출 시도 (간단한 방법)
            const urlMatch = item.product_url.match(/\/([^\/]+)\/dp\//);
            let title = urlMatch ? decodeURIComponent(urlMatch[1].replace(/-/g, ' ')) : '';

            if (!title) continue;

            const lowerTitle = title.toLowerCase();
            let isFiltered = false;

            for (const keyword of bannedKeywords) {
                const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');

                if (regex.test(lowerTitle)) {
                    isFiltered = true;
                    if (!keywordStats[keyword]) {
                        keywordStats[keyword] = { count: 0, examples: [] };
                    }
                    keywordStats[keyword].count++;
                    if (keywordStats[keyword].examples.length < 3) {
                        keywordStats[keyword].examples.push(`[${item.asin}] ${title.substring(0, 50)}...`);
                    }
                }
            }

            if (isFiltered) filteredCount++;
        }

        console.log(`🚫 필터링된 상품: ${filteredCount}개\n`);
        console.log("📋 금칙어별 통계:\n");

        // 빈도순 정렬
        const sorted = Object.entries(keywordStats).sort((a, b) => b[1].count - a[1].count);

        for (const [keyword, data] of sorted) {
            console.log(`🔴 "${keyword}": ${data.count}개`);
            data.examples.forEach(ex => console.log(`   - ${ex}`));
            console.log('');
        }

    } catch (error) {
        console.error("❌ 오류 발생:", error);
    } finally {
        if (connection) await connection.end();
    }
}

analyzeFilteredProducts();
