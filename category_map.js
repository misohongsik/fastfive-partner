// category_map.js
// Amazon 카테고리 경로를 네이버 스마트스토어 카테고리 ID로 매핑합니다.

const CATEGORY_MAP = {
    // 예시 매핑 (실제 ID로 교체 필요)
    "Root > Baby > Feeding > Bottle-Feeding > Insulated Bottle Bags": "50000145", // 예: 유아동/출산 > 수유용품 > 젖병 > 젖병보관함 (가상의 ID)
    "Root > Baby > Feeding > Bottle-Feeding > Bottle Sleeves": "50000146",
    "Root > Baby > Feeding > Bottle-Feeding > Bottles": "50000147",

    // Electronics 예시
    "Root > Electronics > Headphones > Earbud Headphones": "50001234",

    // 기본값 (기타 잡화 등)
    "DEFAULT": "50000000"
};

/**
 * Amazon 전체 경로를 기반으로 네이버 카테고리 ID를 반환합니다.
 * @param {string} fullPath - Amazon 카테고리 전체 경로 (예: "Root > Baby > ...")
 * @returns {string} - 네이버 스마트스토어 카테고리 ID
 */
function getNaverCategoryId(fullPath) {
    if (!fullPath) return CATEGORY_MAP["DEFAULT"];

    // 1. 정확한 일치 검색
    if (CATEGORY_MAP[fullPath]) {
        return CATEGORY_MAP[fullPath];
    }

    // 2. 상위 카테고리 매핑 시도 (경로를 뒤에서부터 하나씩 줄여가며 매칭)
    // 예: "A > B > C" -> "A > B" -> "A"
    let parts = fullPath.split(' > ');
    while (parts.length > 0) {
        const currentPath = parts.join(' > ');
        if (CATEGORY_MAP[currentPath]) {
            return CATEGORY_MAP[currentPath];
        }
        parts.pop();
    }

    // 3. 매핑 실패 시 기본값 반환
    return CATEGORY_MAP["DEFAULT"];
}

module.exports = {
    getNaverCategoryId,
    CATEGORY_MAP
};
