-- Enable PostGIS extension if not already enabled by the image
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS properties (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    price NUMERIC(10, 2), -- Assuming price can have decimals
    price_text VARCHAR(100), -- Store original price string if needed
    location_text TEXT,
    source_url VARCHAR(2048) UNIQUE, -- URL to the original listing
    date_posted TIMESTAMP WITH TIME ZONE,
    source_name VARCHAR(100), -- e.g., 'craigslist', 'zillow'
    scrape_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Future PostGIS field:
    -- coordinates GEOMETRY(Point, 4326), -- For lat/lng
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optional: Create a function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_properties
BEFORE UPDATE ON properties
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Optional: Indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_properties_source_url ON properties(source_url);
CREATE INDEX IF NOT EXISTS idx_properties_date_posted ON properties(date_posted);
-- CREATE INDEX IF NOT EXISTS idx_properties_coordinates ON properties USING GIST (coordinates); -- For PostGIS
