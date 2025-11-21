// Coupang_Category_Map.js

// 아마존 카테고리 경로를 기반으로 쿠팡 카테고리 코드를 반환
// 현재는 예시 코드들이며, 실제 매핑을 위해서는 방대한 데이터가 필요함.
// 여기서는 주요 카테고리에 대한 매핑과 '기타' 처리를 구현.

function getCoupangCategoryCode(amazonFullPath) {
    if (!amazonFullPath) return '78654'; // 기본값: 생활용품 > 기타

    const path = amazonFullPath.toLowerCase();

    // 1. 패션/의류
    if (path.includes('clothing') || path.includes('fashion') || path.includes('apparel')) {
        if (path.includes('women')) return '100001'; // 여성의류
        if (path.includes('men')) return '100002'; // 남성의류
        return '100000'; // 패션의류/잡화
    }

    // 2. 뷰티
    if (path.includes('beauty') || path.includes('cosmetics')) {
        return '100003'; // 뷰티
    }

    // 3. 출산/유아동
    if (path.includes('baby') || path.includes('toy')) {
        return '100004'; // 출산/유아동
    }

    // 4. 식품
    if (path.includes('food') || path.includes('grocery')) {
        return '100005'; // 식품
    }

    // 5. 주방용품
    if (path.includes('kitchen') || path.includes('dining')) {
        return '100006'; // 주방용품
    }

    // 6. 생활용품
    if (path.includes('household') || path.includes('health')) {
        return '100007'; // 생활용품
    }

    // 7. 홈인테리어
    if (path.includes('home') || path.includes('furniture')) {
        return '100008'; // 홈인테리어
    }

    // 8. 가전/디지털
    if (path.includes('electronics') || path.includes('computer') || path.includes('phone')) {
        return '100009'; // 가전/디지털
    }

    // 9. 스포츠/레저
    if (path.includes('sports') || path.includes('outdoors')) {
        return '100010'; // 스포츠/레저
    }

    // 10. 자동차용품
    if (path.includes('automotive')) {
        return '100011'; // 자동차용품
    }

    // 기본값 (기타 잡화 등)
    // 쿠팡 카테고리 코드는 주기적으로 변동될 수 있으므로, 
    // 실제 운영 시에는 '기타' 카테고리 코드를 정확히 확인하여 설정해야 함.
    // 여기서는 임시로 '생활용품 > 기타'에 해당하는 코드를 사용하거나 가장 일반적인 코드를 사용.
    return '78654';
}

// 상품 고시 정보 템플릿 (카테고리별 필수 정보)
function getProductNoticeTemplate(categoryCode) {
    // 기본 템플릿: 기타 재화
    return [
        {
            noticeCategoryName: "기타 재화",
            noticeCategoryDetailName: "품명 및 모델명",
            content: "상세페이지 참조"
        },
        {
            noticeCategoryName: "기타 재화",
            noticeCategoryDetailName: "인증/허가 사항",
            content: "해당사항 없음"
        },
        {
            noticeCategoryName: "기타 재화",
            noticeCategoryDetailName: "제조국(원산지)",
            content: "상세페이지 참조"
        },
        {
            noticeCategoryName: "기타 재화",
            noticeCategoryDetailName: "제조자(수입자)",
            content: "상세페이지 참조"
        },
        {
            noticeCategoryName: "기타 재화",
            noticeCategoryDetailName: "소비자상담 관련 전화번호",
            content: "상세페이지 참조"
        }
    ];
}

module.exports = {
    getCoupangCategoryCode,
    getProductNoticeTemplate
};
