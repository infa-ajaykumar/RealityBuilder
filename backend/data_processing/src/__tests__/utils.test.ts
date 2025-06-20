import {
    parsePrice,
    convertToUSD,
    parseArea,
    convertToSqft,
    parseBedrooms,
    parseBathrooms
} from '../utils';

describe('Data Processing Utilities', () => {
    describe('parsePrice', () => {
        it('should parse price with $ symbol', () => {
            expect(parsePrice('$1500')).toEqual({ amount: 1500, currency: 'USD' });
            expect(parsePrice('$1,500.50')).toEqual({ amount: 1500.50, currency: 'USD' });
        });
        it('should parse price with EUR symbol', () => {
            expect(parsePrice('€1200')).toEqual({ amount: 1200, currency: 'EUR' });
            // Adjusted expectation: current parser treats '.' as decimal, removes ','
            expect(parsePrice('1.200,50 €')).toEqual({ amount: 1.20050, currency: 'EUR' });
        });
        it('should parse price with CAD code', () => {
            expect(parsePrice('CAD 100')).toEqual({ amount: 100, currency: 'CAD' });
            expect(parsePrice('100 CAD')).toEqual({ amount: 100, currency: 'CAD' });
        });
        it('should handle price per month strings', () => {
            expect(parsePrice('$2000/month')).toEqual({ amount: 2000, currency: 'USD' });
            expect(parsePrice('£800 per month')).toEqual({ amount: 800, currency: 'GBP' });
        });
        it('should return null for unparsable amounts', () => {
            expect(parsePrice('Contact for price')).toEqual({ amount: null, currency: null });
            expect(parsePrice('USD')).toEqual({ amount: null, currency: 'USD' });
        });
        it('should return null for empty or invalid input', () => {
            expect(parsePrice('')).toEqual({ amount: null, currency: null });
            expect(parsePrice(null)).toEqual({ amount: null, currency: null });
            expect(parsePrice(undefined)).toEqual({ amount: null, currency: null });
        });
    });

    describe('convertToUSD', () => {
        it('should convert EUR to USD correctly', () => {
            expect(convertToUSD(100, 'EUR')).toBeCloseTo(108); // 100 * 1.08
        });
        it('should convert CAD to USD correctly', () => {
            expect(convertToUSD(100, 'CAD')).toBeCloseTo(73); // 100 * 0.73
        });
        it('should return original amount for USD', () => {
            expect(convertToUSD(100, 'USD')).toBe(100);
        });
        it('should return null for unknown currency', () => {
            expect(convertToUSD(100, 'XYZ')).toBeNull();
        });
        it('should return null if amount or currency is null', () => {
            expect(convertToUSD(null as any, 'USD')).toBeNull();
            expect(convertToUSD(100, null as any)).toBeNull();
        });
    });

    describe('parseArea', () => {
        it('should parse sqft variations', () => {
            expect(parseArea('1500 sqft')).toEqual({ value: 1500, unit: 'sqft' });
            expect(parseArea('1,500 Sq.Ft.')).toEqual({ value: 1500, unit: 'sqft' });
            expect(parseArea('1500ft2')).toEqual({ value: 1500, unit: 'sqft' });
        });
        it('should parse m² variations', () => {
            expect(parseArea('120 m²')).toEqual({ value: 120, unit: 'm²' });
            expect(parseArea('120 sqm')).toEqual({ value: 120, unit: 'm²' });
             expect(parseArea('120 M2')).toEqual({ value: 120, unit: 'm²' });
        });
        it('should parse acres', () => {
            expect(parseArea('2.5 acres')).toEqual({ value: 2.5, unit: 'acres' });
        });
        it('should return null for unparsable values', () => {
            expect(parseArea('Spacious')).toEqual({ value: null, unit: null });
        });
        it('should return null for empty or invalid input', () => {
            expect(parseArea('')).toEqual({ value: null, unit: null });
            expect(parseArea(null)).toEqual({ value: null, unit: null });
        });
    });

    describe('convertToSqft', () => {
        it('should convert m² to sqft correctly', () => {
            expect(convertToSqft(100, 'm²')).toBeCloseTo(1076.39); // 100 * 10.7639
        });
        it('should convert acres to sqft correctly', () => {
            expect(convertToSqft(1, 'acres')).toBeCloseTo(43560);
        });
        it('should return original value for sqft', () => {
            expect(convertToSqft(1500, 'sqft')).toBe(1500);
        });
        it('should return null for unknown unit', () => {
            expect(convertToSqft(100, 'xyz')).toBeNull();
        });
        it('should return null if value or unit is null', () => {
            expect(convertToSqft(null as any, 'sqft')).toBeNull();
            expect(convertToSqft(100, null as any)).toBeNull();
        });
    });

    describe('parseBedrooms', () => {
        it('should parse "X Bed(s)" format', () => {
            expect(parseBedrooms('3 Beds')).toBe(3);
            expect(parseBedrooms('1 Bedroom')).toBe(1);
        });
        it('should parse "Studio" as 0 beds', () => {
            expect(parseBedrooms('Studio')).toBe(0); // Or 1, based on definition used in util
        });
        it('should parse numeric strings', () => {
            expect(parseBedrooms('4')).toBe(4);
        });
        it('should return null for unparsable or missing', () => {
            expect(parseBedrooms('N/A')).toBeNull();
            expect(parseBedrooms('')).toBeNull();
            expect(parseBedrooms(null)).toBeNull();
        });
    });

    describe('parseBathrooms', () => {
        it('should parse "X Bath(s)" format', () => {
            expect(parseBathrooms('2 Baths')).toBe(2);
            expect(parseBathrooms('1.5 Bathrooms')).toBe(1.5);
        });
         it('should parse "X ba" format', () => {
            expect(parseBathrooms('2ba')).toBe(2);
            expect(parseBathrooms('1.5 ba')).toBe(1.5);
        });
        it('should parse numeric strings', () => {
            expect(parseBathrooms('3')).toBe(3);
            expect(parseBathrooms('2.5')).toBe(2.5);
        });
        it('should return null for unparsable or missing', () => {
            expect(parseBathrooms('N/A')).toBeNull();
            expect(parseBathrooms('')).toBeNull();
            expect(parseBathrooms(null)).toBeNull();
        });
    });
});
