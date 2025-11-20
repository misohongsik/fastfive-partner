const mysql = require('mysql2/promise');

const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: '@Calla831031',
    database: 'amazon',
    port: 3306
};

async function checkProductVideos() {
    let connection;
    try {
        connection = await mysql.createConnection(DB_CONFIG);

        console.log("📊 상품 비디오 데이터 분석\n");

        // 비디오가 있는 상품 조회
        const [products] = await connection.query(
            `SELECT asin, title, videos_json 
             FROM amazon_products 
             WHERE videos_json IS NOT NULL 
             AND videos_json != '[]' 
             LIMIT 5`
        );

        console.log(`비디오가 있는 상품: ${products.length}개 샘플\n`);

        for (const product of products) {
            console.log(`\n[${product.asin}] ${product.title.substring(0, 50)}...`);

            try {
                const videos = JSON.parse(product.videos_json);
                console.log(`   비디오 ${videos.length}개 발견`);

                videos.forEach((video, idx) => {
                    console.log(`\n   ${idx + 1}. 제목: ${video.title || 'N/A'}`);
                    console.log(`      재생시간: ${video.duration || video.durationSeconds || 'N/A'}초`);
                    console.log(`      썸네일: ${video.thumbnail || video.thumbUrl || 'N/A'}`);
                    console.log(`      비디오 URL: ${video.url || video.videoUrl || 'N/A'}`);

                    // URL 패턴 분석
                    const videoUrl = video.url || video.videoUrl || '';
                    if (videoUrl) {
                        if (videoUrl.includes('media-amazon.com')) {
                            console.log(`      ⚠️ Amazon 호스팅 비디오 (외부 재생 제한 가능)`);
                        } else if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
                            console.log(`      ✅ YouTube 비디오 (외부 임베드 가능)`);
                        } else {
                            console.log(`      ❓ 기타 호스팅 (테스트 필요)`);
                        }
                    }
                });
            } catch (e) {
                console.log(`   ❌ JSON 파싱 실패: ${e.message}`);
            }

            console.log('\n' + '-'.repeat(80));
        }

        // 전체 통계
        const [stats] = await connection.query(
            `SELECT COUNT(*) as total_products,
                    SUM(CASE WHEN videos_json IS NOT NULL AND videos_json != '[]' THEN 1 ELSE 0 END) as with_videos
             FROM amazon_products`
        );

        console.log(`\n\n📈 전체 통계:`);
        console.log(`총 상품: ${stats[0].total_products}개`);
        console.log(`비디오 있는 상품: ${stats[0].with_videos}개 (${(stats[0].with_videos / stats[0].total_products * 100).toFixed(1)}%)\n`);

    } catch (error) {
        console.error("❌ 오류:", error);
    } finally {
        if (connection) await connection.end();
    }
}

checkProductVideos();
