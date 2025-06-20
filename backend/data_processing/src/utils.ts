// backend/data_processing/src/utils.ts

interface ParsedPrice {
    amount: number | null;
    currency: string | null;
}

interface ParsedArea {
    value: number | null;
    unit: string | null;
}

/**
 * Parses a price string (e.g., "$1,500.50", "€1200", "CAD 800") into amount and currency.
 * This is a basic parser and might need to be made more robust.
 */
export function parsePrice(priceString: string | null | undefined): ParsedPrice {
    if (!priceString || typeof priceString !== 'string') {
        return { amount: null, currency: null };
    }

    let amount: number | null = null;
    let currency: string | null = null;

    // Attempt to extract currency symbol or code first
    if (priceString.includes('$') || priceString.toLowerCase().includes('usd')) {
        currency = 'USD';
    } else if (priceString.includes('€') || price_string_lower.includes('eur')) {
        currency = 'EUR';
    } else if (priceString.toLowerCase().includes('cad')) {
        currency = 'CAD';
    } else if (priceString.includes('£') || price_string_lower.includes('gbp')) {
        currency = 'GBP';
    }
    // Add more currency detections as needed...

    // Remove currency symbols, codes, and common text like "/month" for parsing
    const cleanedPriceString = priceString
        .replace(/\$|€|£/g, '')
        .replace(/usd|eur|cad|gbp/gi, '')
        .replace(/\/month|\s*per month/gi, '')
        .replace(/,/g, '') // Remove commas for thousands
        .trim();

    const priceMatch = cleanedPriceString.match(/[\d.]+/);
    if (priceMatch && priceMatch[0]) {
        amount = parseFloat(priceMatch[0]);
    }

    // If currency is still null but we have an amount, try to infer (less reliable)
    // For now, if not explicitly found, it remains null.

    return { amount, currency };
}

/**
 * Converts a price from a given currency to USD using mock rates.
 * In a real application, use a reliable currency conversion API.
 */
export function convertToUSD(amount: number, currency: string): number | null {
    if (amount === null || currency === null) return null;

    const upperCurrency = currency.toUpperCase();
    let rate: number | undefined;

    switch (upperCurrency) {
        case 'USD':
            rate = 1;
            break;
        case 'EUR':
            rate = 1.08; // Example: 1 EUR = 1.08 USD
            break;
        case 'CAD':
            rate = 0.73; // Example: 1 CAD = 0.73 USD
            break;
        case 'GBP':
            rate = 1.26; // Example: 1 GBP = 1.26 USD
            break;
        default:
            console.warn(`Unknown currency for USD conversion: ${currency}`);
            return null; // Or handle as an error / return original amount
    }
    return amount * rate;
}


/**
 * Parses an area string (e.g., "120 m²", "1500 sqft", "2.5 acres") into value and unit.
 */
export function parseArea(areaString: string | null | undefined): ParsedArea {
    if (!areaString || typeof areaString !== 'string') {
        return { value: null, unit: null };
    }

    let value: number | null = null;
    let unit: string | null = null;
    const areaStringLower = areaString.toLowerCase();

    if (areaStringLower.includes('sqft') || areaStringLower.includes('sq.ft') || areaStringLower.includes('ft2')) {
        unit = 'sqft';
    } else if (areaStringLower.includes('m²') || areaStringLower.includes('sqm') || areaStringLower.includes('m2')) {
        unit = 'm²';
    } else if (areaStringLower.includes('acres') || areaStringLower.includes('acre')) {
        unit = 'acres';
    }
    // Add more unit detections as needed...

    // Remove unit strings for parsing numbers
    const cleanedAreaString = areaStringLower
        .replace(/sqft|sq\.ft|ft2|m²|sqm|m2|acres|acre/gi, '')
        .replace(/,/g, '') // Remove commas
        .trim();

    const areaMatch = cleanedAreaString.match(/[\d.]+/);
    if (areaMatch && areaMatch[0]) {
        value = parseFloat(areaMatch[0]);
    }

    return { value, unit };
}

/**
 * Converts an area value from a given unit to square feet.
 */
export function convertToSqft(value: number, unit: string): number | null {
    if (value === null || unit === null) return null;

    const lowerUnit = unit.toLowerCase();
    let factor: number | undefined;

    switch (lowerUnit) {
        case 'sqft':
        case 'sq.ft':
        case 'ft2':
            factor = 1;
            break;
        case 'm²':
        case 'sqm':
        case 'm2':
            factor = 10.7639; // 1 m² = 10.7639 sqft
            break;
        case 'acres':
        case 'acre':
            factor = 43560; // 1 acre = 43560 sqft
            break;
        default:
            console.warn(`Unknown unit for sqft conversion: ${unit}`);
            return null;
    }
    return value * factor;
}

/**
 * Parses a string representation of bedrooms into a number.
 */
export function parseBedrooms(bedroomString: string | null | undefined): number | null {
    if (!bedroomString || typeof bedroomString !== 'string') return null;
    // Examples: "3 Bed", "Studio", "2 Bedrooms"
    const lowerBeds = bedroomString.toLowerCase();
    if (lowerBeds.includes('studio')) return 0; // Or 1, depending on definition

    const match = lowerBeds.match(/(\d+)\s*(bed|br|bedroom)/);
    if (match && match[1]) {
        return parseInt(match[1], 10);
    }
    // Try parsing a raw number if no text
    const rawNumericMatch = bedroomString.match(/^\d+$/);
    if (rawNumericMatch) {
        return parseInt(rawNumericMatch[0], 10);
    }
    return null;
}

/**
 * Parses a string representation of bathrooms into a number.
 * Handles "1 Bath", "2.5 Bathrooms", "1.5 ba"
 */
export function parseBathrooms(bathroomString: string | null | undefined): number | null {
    if (!bathroomString || typeof bathroomString !== 'string') return null;

    const lowerBaths = bathroomString.toLowerCase();
    const match = lowerBaths.match(/([\d.]+)\s*(bath|ba|bathroom)/);
    if (match && match[1]) {
        return parseFloat(match[1]);
    }
    // Try parsing a raw number if no text
    const rawNumericMatch = bathroomString.match(/^[\d.]+$/);
    if (rawNumericMatch) {
        return parseFloat(rawNumericMatch[0]);
    }
    return null;
}

// Helper for price string lowercasing, used in parsePrice
const price_string_lower = (priceString: string) => priceString.toLowerCase();
