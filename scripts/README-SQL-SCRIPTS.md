# SQL Scripts for Digos City Cluster Generation

This directory contains SQL scripts for generating sample cluster data within Digos City boundaries.

## Scripts

### 1. `create-digos-cluster-with-users.sql` ⭐ **RECOMMENDED**
**Purpose:** Creates cluster with actual user IDs from your database

**Features:**
- Uses real user IDs (pre-configured with your user list)
- Generates one complaint per user
- Creates cluster automatically from generated complaints
- Includes verification queries
- All complaints within Digos boundaries

**Usage:**
```sql
-- Run in PostgreSQL/Supabase SQL editor
\i scripts/create-digos-cluster-with-users.sql
```

**User IDs:** Already configured with your user list (13 users)

### 2. `generate-digos-cluster-sample-data.sql` (Generic Version)
**Purpose:** Generic version for testing (requires manual user ID setup)

**Features:**
- Creates sample complaints with coordinates within Digos boundaries
- Generates a cluster from the sample complaints
- Includes verification queries
- Optional cleanup queries

**Usage:**
```sql
-- Run in PostgreSQL/Supabase SQL editor
\i scripts/generate-digos-cluster-sample-data.sql
```

**Before running:**
1. Replace `sample_user_id` with an actual user UUID from `auth.users`
2. Adjust the number of complaints if needed (currently 5)
3. Modify cluster center coordinates to test different areas

### 2. `digos-boundary-validation-function.sql` ⚠️ **OPTIONAL**
**Purpose:** PostGIS-enabled boundary validation functions (more accurate)

**When to use:** Only if you need database-level validation or spatial queries. **You probably don't need this** since you already validate in application code.

**Features:**
- Creates Digos boundary geometry table
- Provides `is_within_digos_boundary_postgis()` function
- Provides `distance_from_digos_boundary()` function
- More accurate than bounding box checks (uses actual polygon shape)

**Requirements:**
- PostGIS extension must be installed
- Run: `CREATE EXTENSION IF NOT EXISTS postgis;`

**When you DON'T need it:**
- ✅ You already validate boundaries in application code (Node.js/JavaScript)
- ✅ You're just generating sample test data
- ✅ Bounding box validation is sufficient for your needs

**When you DO need it:**
- ✅ You want database-level CHECK constraints
- ✅ You need spatial queries (distance, proximity, etc.)
- ✅ You want maximum accuracy at the database level

**Usage:**
```sql
-- Check if coordinates are within Digos
SELECT is_within_digos_boundary_postgis(6.7666, 125.2869);

-- Get distance from boundary
SELECT distance_from_digos_boundary(6.7666, 125.2869);
```

**See `WHY-POSTGIS-VERSION.md` for detailed explanation.**

## Digos City Boundary Coordinates

**Bounding Box:**
- Latitude: 6.723539 to 6.985025
- Longitude: 125.245633 to 125.391290

**Full Boundary:** Available in `src/client/assets/digos-city-boundary.json`

## Clustering Parameters

- **EPS Value:** 0.01 (degrees) ≈ 1.1 km
- **Clustering Radius:** 0.5 km (500 meters)
- **Min Complaints per Cluster:** 3

## Sample Data Structure

### Complaints
- 5 sample complaints generated
- Coordinates within Digos City boundaries
- Distributed around cluster center (within 0.5 km radius)
- Various workflow statuses and priorities

### Cluster
- Automatically created from generated complaints
- Center calculated as average of complaint coordinates
- Radius calculated as maximum distance from center
- Pattern type determined by complaint count

## Verification

After running the script, use these queries to verify:

```sql
-- View generated complaints
SELECT id, title, latitude, longitude, workflow_status
FROM public.complaints
WHERE title LIKE 'Sample Complaint%';

-- View generated cluster
SELECT 
    cluster_name,
    center_lat,
    center_lng,
    radius_meters,
    array_length(complaint_ids, 1) as complaint_count
FROM public.complaint_clusters
WHERE cluster_name LIKE 'Digos City Cluster%';
```

## Cleanup

To remove test data:

```sql
DELETE FROM public.complaint_clusters 
WHERE cluster_name LIKE 'Digos City Cluster%';

DELETE FROM public.complaints 
WHERE title LIKE 'Sample Complaint%';
```

## Notes

1. The basic script uses bounding box validation (faster, less accurate)
2. For production, use the PostGIS version for accurate polygon validation
3. Replace placeholder user UUIDs with actual user IDs
4. Adjust coordinates and counts as needed for testing

