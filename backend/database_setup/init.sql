-- Enable PostGIS extension if not already enabled by the image
CREATE EXTENSION IF NOT EXISTS postgis; -- For potential future GIS queries, not directly used by schema yet
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- For potential future use of UUIDs
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- For string similarity functions (e.g., similarity(), <-> operator)

CREATE TABLE IF NOT EXISTS properties (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,

    -- Price related fields
    price_original_numeric NUMERIC(10, 2),
    price_original_textual_display VARCHAR(100),
    currency_original VARCHAR(10),
    normalized_price_usd NUMERIC(12, 2),

    -- Location and Geocoding related fields
    location_text TEXT,
    address_raw TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    geocoded_data_raw JSONB,

    -- Property attributes
    bedrooms INTEGER,
    bathrooms NUMERIC(4,1),

    area_original_value NUMERIC(10,2),
    area_unit_original VARCHAR(20),
    normalized_area_sqft NUMERIC(10, 2),

    -- Other details
    images TEXT[],
    description TEXT,

    -- Scrape metadata
    source_url VARCHAR(2048) UNIQUE NOT NULL,
    date_posted TIMESTAMP WITH TIME ZONE,
    source_name VARCHAR(100),
    scrape_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Deduplication and Status
    status VARCHAR(50) DEFAULT 'active', -- e.g., 'active', 'potential_duplicate', 'merged', 'inactive'
    duplicate_of_property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL, -- Link to the master property

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Function to update 'updated_at' timestamp automatically
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function before any update on the properties table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'set_timestamp_properties' AND tgrelid = 'properties'::regclass
    ) THEN
        CREATE TRIGGER set_timestamp_properties
        BEFORE UPDATE ON properties
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
    END IF;
END
$$;

-- Indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_properties_source_url ON properties(source_url);
CREATE INDEX IF NOT EXISTS idx_properties_date_posted ON properties(date_posted);
CREATE INDEX IF NOT EXISTS idx_properties_normalized_price_usd ON properties(normalized_price_usd);
CREATE INDEX IF NOT EXISTS idx_properties_bedrooms ON properties(bedrooms);
CREATE INDEX IF NOT EXISTS idx_properties_bathrooms ON properties(bathrooms);
CREATE INDEX IF NOT EXISTS idx_properties_normalized_area_sqft ON properties(normalized_area_sqft);
CREATE INDEX IF NOT EXISTS idx_properties_latitude_longitude ON properties(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON properties(created_at);
CREATE INDEX IF NOT EXISTS idx_properties_source_name ON properties(source_name);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_duplicate_of_property_id ON properties(duplicate_of_property_id) WHERE duplicate_of_property_id IS NOT NULL;

-- Example GIN index for trigram similarity on title and location_text (if using pg_trgm for search)
-- CREATE INDEX IF NOT EXISTS idx_properties_title_trgm ON properties USING gin (title gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_properties_location_text_trgm ON properties USING gin (location_text gin_trgm_ops);


COMMENT ON COLUMN properties.price_original_numeric IS 'Original numeric value parsed from price string, if possible.';
COMMENT ON COLUMN properties.price_original_textual_display IS 'Original full price string as it appeared on the source, e.g., "$1500/month", "Contact for price".';
COMMENT ON COLUMN properties.currency_original IS 'Currency code (e.g., USD, EUR) parsed from the original price string.';
COMMENT ON COLUMN properties.normalized_price_usd IS 'Price normalized to US Dollars, if conversion was possible.';
COMMENT ON COLUMN properties.location_text IS 'Original location string as scraped from the source.';
COMMENT ON COLUMN properties.address_raw IS 'The specific address string passed to the geocoding service.';
COMMENT ON COLUMN properties.latitude IS 'Latitude obtained from geocoding.';
COMMENT ON COLUMN properties.longitude IS 'Longitude obtained from geocoding.';
COMMENT ON COLUMN properties.geocoded_data_raw IS 'Complete JSON response from the geocoding service for transparency and future use.';
COMMENT ON COLUMN properties.bathrooms IS 'Number of bathrooms, allowing for half-bathrooms (e.g., 2.5).';
COMMENT ON COLUMN properties.area_original_value IS 'Original numeric value for the property area as scraped.';
COMMENT ON COLUMN properties.area_unit_original IS 'Original unit for the property area as scraped (e.g., "sqft", "m²", "acres").';
COMMENT ON COLUMN properties.normalized_area_sqft IS 'Property area normalized to square feet, if conversion was possible.';
COMMENT ON COLUMN properties.images IS 'Array of URLs for property images.';
COMMENT ON COLUMN properties.description IS 'Full description of the property, potentially including HTML or rich text.';
COMMENT ON COLUMN properties.source_url IS 'The unique URL of the original listing. Serves as a unique identifier from the source.';
COMMENT ON COLUMN properties.date_posted IS 'The date the listing was originally posted on the source site.';
COMMENT ON COLUMN properties.source_name IS 'Identifier for the scraper or data source (e.g., "CraigslistScraper", "ZillowAPI").';
COMMENT ON COLUMN properties.scrape_timestamp IS 'Timestamp of when the data was last scraped and processed by our system.';
COMMENT ON COLUMN properties.status IS 'Status of the listing, e.g., active, potential_duplicate, merged, inactive.';
COMMENT ON COLUMN properties.duplicate_of_property_id IS 'If this listing is considered a duplicate, this field points to the ID of the master/original property record.';
