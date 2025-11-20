// Coupang_API_Client.js
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY;
const SECRET_KEY = process.env.COUPANG_SECRET_KEY;
const VENDOR_ID = process.env.COUPANG_VENDOR_ID;

if (!ACCESS_KEY || !SECRET_KEY || !VENDOR_ID) {
    console.error("❌ ERROR: COUPANG_ACCESS_KEY, COUPANG_SECRET_KEY, or COUPANG_VENDOR_ID is missing in .env");
}

class CoupangApiClient {
    constructor() {
        this.baseUrl = 'https://api-gateway.coupang.com';
    }

    /**
     * HMAC-SHA256 서명 생성
     */
    generateSignature(method, path, query = '') {
        const date = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'); // YYMMDDThhmmssZ format
        const message = date + method + path + query;

        const signature = crypto.createHmac('sha256', SECRET_KEY)
            .update(message)
            .digest('hex');

        return {
            'Authorization': `Hmac ${ACCESS_KEY}:${signature}`,
            'X-Requested-By': VENDOR_ID,
            'X-EXT-LINK-ID': VENDOR_ID,
            'Content-Type': 'application/json;charset=UTF-8',
            'X-HMAC-DATE': date
        };
    }

    /**
     * 이미지 업로드 (Coupang CDN)
     * @param {string} imageUrl - 원본 이미지 URL
     * @returns {Promise<string>} - 쿠팡 CDN URL (http://...)
     */
    async uploadImage(imageUrl) {
        try {
            // 1. 이미지 다운로드
            const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(imageResponse.data, 'binary');

            // 2. 쿠팡 업로드 API 호출
            // POST /v2/providers/seller_api/apis/api/v1/distribution/upload-image
            const path = '/v2/providers/seller_api/apis/api/v1/distribution/upload-image';
            const method = 'POST';

            // 주의: 쿠팡 이미지 업로드는 JSON이 아닌 Multipart/form-data일 수 있으나, 
            // 문서상으로는 별도 방식이 존재함. 
            // 여기서는 일반적인 '파일 업로드'가 아닌 'URL 업로드' 방식이 있는지 확인 필요하나,
            // 쿠팡은 보통 파일을 직접 보냄.

            // form-data 라이브러리 사용
            const FormData = require('form-data');
            const form = new FormData();
            form.append('files', imageBuffer, { filename: 'image.jpg' });

            // 헤더 생성 (Content-Type은 form-data가 자동 설정하므로 제외해야 함)
            const headers = this.generateSignature(method, path);
            delete headers['Content-Type']; // form-data가 boundary 설정하도록 삭제

            const response = await axios.post(`${this.baseUrl}${path}`, form, {
                headers: {
                    ...headers,
                    ...form.getHeaders()
                }
            });

            if (response.data.code === 'SUCCESS') {
                // data: { attachments: [ { cdnPath: '...' } ] }
                // cdnPath에는 'http://...' 가 포함되어 있을 수도 있고 없을 수도 있음.
                // 보통 'http://img1a.coupangcdn.com/...' 형태
                const cdnPath = response.data.data.attachments[0].cdnPath;
                return cdnPath;
            } else {
                console.error(`❌ Coupang Image Upload Failed: ${response.data.message}`);
                return null;
            }

        } catch (error) {
            console.error(`❌ Failed to upload image to Coupang (${imageUrl}):`, error.response ? error.response.data : error.message);
            return null;
        }
    }

    /**
     * 상품 등록 (생성)
     * @param {object} productData - 쿠팡 상품 데이터 JSON
     */
    async createProduct(productData) {
        try {
            const path = '/v2/providers/seller_api/apis/api/v1/products';
            const method = 'POST';
            const headers = this.generateSignature(method, path);

            const response = await axios.post(`${this.baseUrl}${path}`, productData, {
                headers: headers
            });

            if (response.data.code === 'SUCCESS') {
                console.log(`✅ Coupang Product Created: ID ${response.data.data.productId}`);
                return response.data.data;
            } else {
                console.error(`❌ Coupang Product Creation Failed: ${response.data.message}`);
                if (response.data.data) {
                    console.error("Details:", JSON.stringify(response.data.data, null, 2));
                }
                return null;
            }

        } catch (error) {
            console.error("❌ Failed to create product on Coupang:", error.response ? error.response.data : error.message);
            return null;
        }
    }
}

module.exports = new CoupangApiClient();
