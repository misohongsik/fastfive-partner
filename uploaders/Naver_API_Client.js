// Naver_API_Client.js
const axios = require('axios');
const fs = require('fs').promises;
require('dotenv').config();

const CLIENT_ID = process.env.NAVER_CLIENT_ID;
const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("❌ ERROR: NAVER_CLIENT_ID or NAVER_CLIENT_SECRET is missing in .env");
    // process.exit(1); // Don't exit yet, allow for dry-run or testing
}

class NaverApiClient {
    constructor() {
        this.accessToken = null;
        this.tokenExpiresAt = 0;
    }

    /**
     * Access Token 발급 (Client Credentials Grant)
     */
    async getAccessToken() {
        if (this.accessToken && Date.now() < this.tokenExpiresAt) {
            return this.accessToken;
        }

        try {
            // 네이버 커머스 API 토큰 발급 URL (확인 필요, 일반적으로 oauth2/token)
            // https://api.commerce.naver.com/external/v1/oauth2/token
            const response = await axios.post('https://api.commerce.naver.com/external/v1/oauth2/token', null, {
                params: {
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    grant_type: 'client_credentials',
                    type: 'SELF' // 판매자 본인 API 사용 시
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            this.accessToken = response.data.access_token;
            // 토큰 만료 시간 설정 (안전하게 1분 일찍 만료 처리)
            this.tokenExpiresAt = Date.now() + (response.data.expires_in - 60) * 1000;
            console.log("✅ Access Token acquired successfully.");
            return this.accessToken;

        } catch (error) {
            console.error("❌ Failed to get Access Token:", error.response ? error.response.data : error.message);
            throw error;
        }
    }

    /**
     * 이미지 업로드 (단건)
     * @param {string} imageUrl - 업로드할 이미지의 URL
     * @returns {Promise<string>} - 네이버 이미지 ID
     */
    async uploadImage(imageUrl) {
        try {
            const token = await this.getAccessToken();

            // 1. 이미지 다운로드
            const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(imageResponse.data, 'binary');

            // 2. 네이버 업로드 (Multipart)
            // 주의: 네이버 커머스 API의 이미지 업로드 방식에 맞춰야 함 (Form Data)
            const formData = new FormData();
            // Node.js 환경에서 FormData 사용 시 'form-data' 패키지 필요할 수 있음.
            // 여기서는 axios의 기능을 활용하거나 별도 처리가 필요.
            // 편의상 의사 코드로 작성하며, 실제 구현 시 form-data 라이브러리 사용 권장.

            // TODO: 'form-data' 패키지 설치 필요: npm install form-data
            const FormData = require('form-data');
            const form = new FormData();
            form.append('image', imageBuffer, { filename: 'image.jpg' });

            const uploadResponse = await axios.post('https://api.commerce.naver.com/external/v1/product-images/upload', form, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    ...form.getHeaders()
                }
            });

            return uploadResponse.data.images[0].url; // 또는 ID 반환

        } catch (error) {
            console.error(`❌ Failed to upload image (${imageUrl}):`, error.message);
            return null;
        }
    }

    /**
     * 상품 등록
     * @param {object} productData - 스마트스토어 상품 데이터 JSON
     */
    async createProduct(productData) {
        try {
            const token = await this.getAccessToken();

            const response = await axios.post('https://api.commerce.naver.com/external/v1/products', productData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log(`✅ Product Created: ${response.data.originProductNo} -> ${response.data.smartstoreChannelProductNo}`);
            return response.data;

        } catch (error) {
            console.error("❌ Failed to create product:", error.response ? error.response.data : error.message);
            // 에러 상세 로깅
            if (error.response && error.response.data && error.response.data.invalidInputs) {
                console.error("Invalid Inputs:", JSON.stringify(error.response.data.invalidInputs, null, 2));
            }
            return null;
        }
    }
}

module.exports = new NaverApiClient();
