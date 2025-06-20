import crypto from 'crypto';

export const generateCacheKey = (prefix: string, queryParams: object): string => {
    // Sort query parameters by key to ensure consistent key generation
    const sortedQuery = Object.keys(queryParams)
        .sort()
        .reduce((obj: { [key: string]: any }, key) => {
            obj[key] = queryParams[key as keyof typeof queryParams];
            return obj;
        }, {});

    const queryString = JSON.stringify(sortedQuery);
    // Use MD5 hash for a fixed-length, consistent key
    const hash = crypto.createHash('md5').update(queryString).digest('hex');
    return `${prefix}:${hash}`;
};
