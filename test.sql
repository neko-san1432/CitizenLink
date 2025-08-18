-- Without explicit search_path (VULNERABLE)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();  -- Which 'now()' function?
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- With explicit search_path (SECURE)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = pg_catalog.now();  -- Explicitly use pg_catalog.now()
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;   