// Product_Filter.js

const bannedKeywords = [
    // 1. 성인용품 (Adult / Sexual Wellness)
    'sex', 'sexual', 'vibrator', 'dildo', 'masturbator', 'masturbation',
    'anal', 'bondage', 'fetish', 'erotic', 'penis', 'vagina', 'clitoris',
    'cock', 'adult toy', 'lubricant', 'condom', 'lingerie',

    // 2. 무기 및 위해물품 (Weapons / Hazardous)
    'gun', 'rifle', 'pistol', 'weapon', 'ammo', 'ammunition',
    'tactical knife', 'sword', 'dagger', 'crossbow', 'archery',
    'slingshot', 'stun gun', 'pepper spray',

    // 3. 마약류 및 성분 주의 (Drugs / Substances)
    'cbd', 'hemp', 'cannabis', 'marijuana', 'drug', 'nicotine',
    'tobacco', 'vape', 'ecig', 'pharmacy', 'prescription', 'medicine',

    // 4. 기타 위험 품목 (Hazardous / Restricted)
    'flammable',
    'bluetooth', 'wireless', // 전파법 관련 (소명 귀찮음 방지)
    'kids', 'baby', // 어린이 제품 안전 특별법 관련 (인증 이슈 방지)

    // 5. 사용자 추가 금지어 (User Requested)
    'shock', 'volts', 'e-stim', 'dilator',
    'urethral', // 요도 (절대 금지)
    'sounding', // 사운딩 (확장 행위)
    'catheter', // 카테터 (의료기기 오인)
    'insertable', // 삽입형 (금속류일 경우 위험)
    'speculum', // 질경 (의료기기)
    'stainless steel sex' // 스테인리스 소재 섹스토이는 대부분 하드코어임
];

/**
 * 상품명이 안전한지 확인하는 함수
 * @param {string} title - 상품 제목
 * @returns {Object} - { safe: boolean, reason: string }
 */
function isSafeProduct(title) {
    if (!title) return { safe: false, reason: '제목 없음' };

    const lowerTitle = title.toLowerCase();

    for (const keyword of bannedKeywords) {
        // 단어 단위(\b)로 검사하여 unisex 같은 단어가 sex에 걸리지 않도록 함
        // 특수문자 이스케이프 처리 (혹시 모를 상황 대비)
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');

        if (regex.test(lowerTitle)) {
            return { safe: false, reason: `금칙어: "${keyword}"` };
        }
    }
    return { safe: true, reason: '' };
}

module.exports = {
    isSafeProduct,
    bannedKeywords
};
