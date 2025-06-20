import { generateCacheKey } from '../utils/cacheUtils';

describe('API Service Utilities - cacheUtils', () => {
    describe('generateCacheKey', () => {
        it('should generate a consistent hash for the same query parameters regardless of order', () => {
            const queryParams1 = { limit: '10', page: '1', city: 'New York' };
            const queryParams2 = { city: 'New York', page: '1', limit: '10' };
            const key1 = generateCacheKey('properties', queryParams1);
            const key2 = generateCacheKey('properties', queryParams2);
            expect(key1).toBe(key2);
        });

        it('should generate different hashes for different query parameters', () => {
            const queryParams1 = { limit: '10', page: '1' };
            const queryParams2 = { limit: '20', page: '1' };
            const key1 = generateCacheKey('properties', queryParams1);
            const key2 = generateCacheKey('properties', queryParams2);
            expect(key1).not.toBe(key2);
        });

        it('should generate a key with the correct prefix', () => {
            const queryParams = { limit: '10', page: '1' };
            const key = generateCacheKey('testPrefix', queryParams);
            expect(key.startsWith('testPrefix:')).toBe(true);
        });

        it('should handle empty query parameters object', () => {
            const queryParams = {};
            const key = generateCacheKey('properties', queryParams);
            // MD5 hash of "{}" is "99914b932bd37a50b983c5e7c90ae93b"
            expect(key).toBe('properties:99914b932bd37a50b983c5e7c90ae93b');
        });

        it('should produce an MD5 hash of 32 characters after the prefix', () => {
            const queryParams = { a: '1', b: '2' };
            const key = generateCacheKey('prefix', queryParams);
            const hashPart = key.split(':')[1];
            expect(hashPart).toHaveLength(32);
            expect(hashPart).toMatch(/^[a-f0-9]{32}$/); // Check if it's a hex string
        });
    });
});
