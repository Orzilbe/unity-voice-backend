"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchWithAuth = fetchWithAuth;
// apps/api/src/lib/api.ts
async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('token'); // Get token from storage
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    };
    const mergedOptions = { ...defaultOptions, ...options };
    const response = await fetch(url, mergedOptions);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Something went wrong');
    }
    return response.json();
}
