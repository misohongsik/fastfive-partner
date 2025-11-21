/**
 * 이 스크립트는 `detail_crawler_proxy.js`의 리뷰 비디오 수집 섹션을
 * 안전하게 업데이트합니다.
 * 
 * 사용법:
 * 1. `git restore detail_crawler_proxy.js`로 파일을 복원하세요
 * 2. `node apply_review_video_fix.js`를 실행하세요
 */

const fs = require('fs');
const path = require('path');

const TARGET_FILE = path.join(__dirname, 'detail_crawler_proxy.js');

// 기존 코드 (검색 패턴)
const OLD_CODE = `                // 리뷰 비디오 URL 수집
                const videoContainer = reviewEl.querySelector('.vse-video-container');
                if (videoContainer) {
                    const videoSource = videoContainer.querySelector('video source');
                    if (videoSource && videoSource.src) {
                        media_urls.push({ type: 'video', url: videoSource.src });
                    } else {
                        const videoElement = videoContainer.querySelector('video');
                        if (videoElement && videoElement.src) {
                            media_urls.push({ type: 'video', url: videoElement.src });
                        } else {
                            const videoUrl = videoContainer.getAttribute('data-video-url');
                            if (videoUrl) {
                                media_urls.push({ type: 'video', url: videoUrl });
                            } else {
                                const videoThumbnail = videoContainer.querySelector('img');
                                if (videoThumbnail && videoThumbnail.src) {
                                    let highResUrl = videoThumbnail.src.replace(/\\._.*_\\./g, '.');
                                    media_urls.push({ type: 'video_thumbnail', url: highResUrl });
                                }
                            }
                        }
                    }
                }`;

// 새 코드 (B091PZDB8X 호환)
const NEW_CODE = `                // 리뷰 비디오 URL 수집 (개선됨 - B091PZDB8X 호환)
                // 방법 1: data-video-url 속성을 가진 모든 요소 검색 (최우선)
                const elementsWithDataVideoUrl = reviewEl.querySelectorAll('[data-video-url]');
                if (elementsWithDataVideoUrl.length > 0) {
                    elementsWithDataVideoUrl.forEach(el => {
                        const videoUrl = el.getAttribute('data-video-url');
                        if (videoUrl && !videoUrl.startsWith('blob:')) {
                            media_urls.push({ type: 'video', url: videoUrl });
                        }
                    });
                }
                
                // 방법 2: .vse-video-container 검색 (fallback - 이미 위에서 찾았으면 중복 방지)
                if (media_urls.filter(m => m.type === 'video').length === 0) {
                    const videoContainer = reviewEl.querySelector('.vse-video-container');
                    if (videoContainer) {
                        const videoSource = videoContainer.querySelector('video source');
                        if (videoSource && videoSource.src && !videoSource.src.startsWith('blob:')) {
                            media_urls.push({ type: 'video', url: videoSource.src });
                        } else {
                            const videoElement = videoContainer.querySelector('video');
                            if (videoElement && videoElement.src && !videoElement.src.startsWith('blob:')) {
                                media_urls.push({ type: 'video', url: videoElement.src });
                            } else {
                                const videoUrl = videoContainer.getAttribute('data-video-url');
                                if (videoUrl && !videoUrl.startsWith('blob:')) {
                                    media_urls.push({ type: 'video', url: videoUrl });
                                } else {
                                    // 마지막 fallback: 썸네일만 수집
                                    const videoThumbnail = videoContainer.querySelector('img');
                                    if (videoThumbnail && videoThumbnail.src) {
                                        let highResUrl = videoThumbnail.src.replace(/\\._.*_\\./g, '.');
                                        media_urls.push({ type: 'video_thumbnail', url: highResUrl });
                                    }
                                }
                            }
                        }
                    }
                }`;

try {
    // 파일 읽기
    let content = fs.readFileSync(TARGET_FILE, 'utf8');

    // 기존 코드가 있는지 확인
    if (!content.includes('// 리뷰 비디오 URL 수집')) {
        console.error('❌ 오류: 리뷰 비디오 수집 코드를 찾을 수 없습니다.');
        console.error('   파일이 이미 수정되었거나 올바른 버전이 아닙니다.');
        process.exit(1);
    }

    // 코드 교체
    const newContent = content.replace(OLD_CODE, NEW_CODE);

    // 교체가 실제로 이루어졌는지 확인
    if (newContent === content) {
        console.error('❌ 오류: 코드 교체에 실패했습니다.');
        console.error('   파일 내용이 예상과 다를 수 있습니다.');
        process.exit(1);
    }

    // 백업 생성
    const backupFile = TARGET_FILE + '.before_review_fix';
    fs.writeFileSync(backupFile, content);
    console.log(`✅ 백업 생성: ${backupFile}`);

    // 새 내용 저장
    fs.writeFileSync(TARGET_FILE, newContent);
    console.log('✅ detail_crawler_proxy.js 업데이트 완료!');
    console.log('');
    console.log('🎯 변경 사항:');
    console.log('   - [data-video-url] 속성을 먼저 검색하도록 변경');
    console.log('   - blob: URL 필터링 추가');
    console.log('   - B091PZDB8X 호환성 개선');
    console.log('');
    console.log('📝 다음 단계:');
    console.log('   1. node fix_queue.js 실행 (B091PZDB8X 리셋)');
    console.log('   2. node detail_crawler_proxy.js 실행');

} catch (error) {
    console.error('❌ 오류:', error.message);
    process.exit(1);
}
