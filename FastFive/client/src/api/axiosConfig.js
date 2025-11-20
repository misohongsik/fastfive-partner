import axios from 'axios';

const api = axios.create({
    // In production (CloudType), VITE_API_URL will be set to the Backend URL.
    // In development, it falls back to '/api' which is handled by Vite proxy.
    baseURL: import.meta.env.VITE_API_URL || '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

export default api;
