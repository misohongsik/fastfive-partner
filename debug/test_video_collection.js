const mysql = require('mysql2/promise');

const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: '@Calla831031',
    database: 'amazon',
    port: 3306
};

async function checkVideoCollection() {
    const conn = await mysql.createConnection(DB_CONFIG);

    try {
        const asin = 'B0DH233BTG';
        console.log(`\n🔍 ASIN ${asin} 비디오 수집 결과 확인 중...\n`);

        const [rows] = await conn.query(
            `SELECT asin, title, videos_json, reviews_json 
             FROM amazon_products 
             WHERE asin = ?`,
            [asin]
        );

        if (rows.length === 0) {
            console.log('❌ 해당 상품이 DB에 없습니다. 크롤링이 필요합니다.');
            return;
        }

        const product = rows[0];
        console.log(`✅ 상품명: ${product.title.substring(0, 80)}...`);
        console.log(`\n📊 비디오 데이터 (videos_json):`);

        if (product.videos_json) {
            try {
                const videos = JSON.parse(product.videos_json);
                if (videos.length > 0) {
                    console.log(`   🎬 총 ${videos.length}개의 비디오 발견!`);
                    videos.forEach((video, idx) => {
                        console.log(`\n   [비디오 ${idx + 1}]`);
                        console.log(`   - 제목: ${video.title || 'N/A'}`);
                        console.log(`   - 길이: ${video.duration || 'N/A'}초`);
                        console.log(`   - URL: ${video.url || 'N/A'}`);
                        console.log(`   - 썸네일: ${video.thumbnail ? video.thumbnail.substring(0, 60) + '...' : 'N/A'}`);
                    });
                } else {
                    console.log('   ⚠️ 비디오 배열이 비어있습니다.');
                }
            } catch (e) {
                console.log('   ❌ JSON 파싱 오류:', e.message);
                console.log('   원본 데이터:', product.videos_json);
            }
        } else {
            console.log('   ⚠️ videos_json이 NULL입니다.');
        }

        console.log(`\n📸 리뷰 미디어 데이터 (reviews_json):`);
        if (product.reviews_json) {
            try {
                const reviews = JSON.parse(product.reviews_json);
                console.log(`   📝 총 ${reviews.length}개의 리뷰`);

                let videoCount = 0;
                let imageCount = 0;
                let thumbnailCount = 0;

                reviews.forEach((review, idx) => {
                    if (review.media_url && Array.isArray(review.media_url)) {
                        review.media_url.forEach(media => {
                            if (media.type === 'video') videoCount++;
                            else if (media.type === 'image') imageCount++;
                            else if (media.type === 'video_thumbnail') thumbnailCount++;
                        });
                    }
                });

                console.log(`   - 🎥 리뷰 비디오: ${videoCount}개`);
                console.log(`   - 📷 리뷰 이미지: ${imageCount}개`);
                console.log(`   - 🖼️ 비디오 썸네일: ${thumbnailCount}개`);

            } catch (e) {
                console.log('   ❌ JSON 파싱 오류:', e.message);
            }
        } else {
            console.log('   ⚠️ reviews_json이 NULL입니다.');
        }

    } finally {
        await conn.end();
    }
}

checkVideoCollection().catch(console.error);
