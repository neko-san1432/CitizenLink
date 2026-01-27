# DRIMS 2.0

**Citizen Complaint Management System with DBSCAN-Based Geospatial Heatmap Analytics**

## 📖 About the Program

### Introduction

DRIMS 2.0 is a web-based complaint management system designed for Local Government Units (LGUs) to efficiently handle and analyze citizen complaints. The system's primary innovation is its **advanced geospatial analytics using DBSCAN clustering** for complaint hotspot detection, enabling data-driven decision-making for resource allocation and policy development.

Built with modern web technologies, DRIMS provides a scalable platform for managing citizen feedback with intelligent spatial analysis capabilities.

### Core Capabilities

- **DBSCAN Heatmap Clustering**: Advanced geospatial analysis for identifying complaint hotspots and density patterns
- **Interactive Complaint Mapping**: Real-time visualization of complaint locations with cluster overlays
- **Multi-Role System**: Support for Citizens, LGU Officers, Admins, and Super Admins
- **Intelligent Complaint Routing**: Automated department assignment with hierarchical category/subcategory routing
- **Comprehensive Analytics**: Statistical dashboards for complaint trends and patterns
- **Secure Architecture**: Enterprise-grade security with role-based access control

## 📦 Installation & Dependencies

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **PostgreSQL** 13+ or **Supabase** account
- **npm** or **yarn** package manager

### Installation Steps

```bash
# Clone the repository
git clone <repository-url>
cd DRIMS

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run migrate

# Apply Row Level Security (RLS) policies
# Run the SQL script in your Supabase SQL Editor:
# scripts/setup_rls.sql

# Start development server
npm run dev
```

### Key Dependencies

| Package                   | Version   | Purpose                                                                   |
| ------------------------- | --------- | ------------------------------------------------------------------------- |
| **@supabase/supabase-js** | ^2.57.4   | PostgreSQL database client with authentication and real-time capabilities |
| **chart.js**              | ^4.5.0    | Data visualization for complaint statistics and analytics dashboards      |
| **express**               | ^4.21.2   | Web framework for Node.js serving as the core HTTP server                 |
| **helmet**                | ^8.1.0    | Security middleware for HTTP headers and Content Security Policy          |
| **joi**                   | ^18.0.2   | Schema validation for request payloads and data integrity                 |
| **multer**                | ^2.0.2    | File upload handling for complaint evidence attachments                   |
| **validator**             | ^13.15.15 | String validation and sanitization for user inputs                        |

## 🏗️ Architecture

### Directory Structure

```
DRIMS/
├── 📁 config/                 # Configuration management
├── 📁 src/
│   ├── 📁 server/             # Backend (Node.js/Express)
│   │   ├── 📁 controllers/    # Request handlers
│   │   ├── 📁 services/       # Business logic
│   │   ├── 📁 repositories/   # Data access layer
│   │   ├── 📁 models/         # Data models & validation
│   │   ├── 📁 middleware/     # Express middleware
│   │   └── 📁 routes/         # Route definitions
│   └── 📁 client/             # Frontend (JavaScript)
│       ├── 📁 components/     # UI components
│       │   └── 📁 map/        # Map & heatmap components
│       ├── 📁 utils/          # Client utilities
│       └── 📁 styles/         # CSS files
├── 📁 views/                  # HTML templates
│   └── 📁 pages/              # Page templates
│       ├── 📁 admin/          # Admin interface
│       ├── 📁 lgu/            # LGU staff pages
│       └── 📁 lgu-admin/      # LGU admin pages
├── 📁 public/                 # Static assets
│   ├── 📁 css/                # Stylesheets
│   └── 📁 js/                 # Client-side JavaScript
└── 📁 scripts/                # Utility scripts
```

### Architectural Pattern

DRIMS follows a **layered MVC + Service architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                         │
│  (Views, Frontend Components, Map Visualizations)            │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    CONTROLLER LAYER                          │
│  • Request/Response handling                                 │
│  • Input validation                                          │
│  • Delegates to services                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                     SERVICE LAYER                            │
│  • Business logic and rules                                  │
│  • DBSCAN clustering algorithms                              │
│  • Workflow orchestration                                    │
│  • Coordinates multiple repositories                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   REPOSITORY LAYER                           │
│  • Data access abstraction                                   │
│  • Database queries (CRUD operations)                        │
│  • Geospatial data retrieval                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    DATABASE LAYER                            │
│  (PostgreSQL/Supabase with PostGIS)                          │
└─────────────────────────────────────────────────────────────┘
```

## ✨ Core Feature: DBSCAN Heatmap Clustering

### Overview

The primary innovation of DRIMS is its implementation of **Density-Based Spatial Clustering of Applications with Noise (DBSCAN)** algorithm for advanced geospatial analysis of citizen complaints.

### What is DBSCAN?

DBSCAN is a density-based clustering algorithm that groups together points that are closely packed together, marking points in low-density regions as outliers. Unlike other clustering methods (like K-means), DBSCAN:

- **Does not require specifying the number of clusters beforehand**
- **Can find arbitrarily shaped clusters**
- **Identifies noise points (outliers)**
- **Is robust to outliers and varying cluster densities**

#### Advantages Over Other Clustering Algorithms

| Feature                      | DBSCAN                        | K-Means              | Hierarchical                 |
| ---------------------------- | ----------------------------- | -------------------- | ---------------------------- |
| **Number of clusters**       | Automatic                     | Must specify k       | Must specify k or cut height |
| **Cluster shape**            | Arbitrary shapes              | Spherical only       | Depends on linkage           |
| **Outlier handling**         | Identifies as noise           | Forces into clusters | Forces into clusters         |
| **Density variation**        | Handles well                  | Struggles            | Moderate                     |
| **Computational complexity** | O(n log n) with spatial index | O(nk)                | O(n² log n)                  |
| **Geospatial suitability**   | **Excellent**                 | Poor                 | Moderate                     |

**Why DBSCAN for Complaint Analysis?**

1. **Unknown cluster count**: We don't know in advance how many hotspots exist
2. **Irregular patterns**: Complaint hotspots follow geographic features (roads, neighborhoods) with irregular shapes
3. **Noise handling**: Isolated complaints shouldn't force artificial clusters
4. **Density-based**: Hotspots are naturally defined by complaint density, not arbitrary boundaries
5. **Scalability**: Efficient for large datasets with spatial indexing

### Implementation Details

#### Algorithm Parameters

- **Epsilon (ε)**: The maximum distance between two points to be considered neighbors (configurable, default: 0.01 degrees ≈ 1.1 km)
- **MinPoints**: The minimum number of points required to form a dense region (configurable, default: 3 complaints)

#### Mathematical Formulas

##### 1. Haversine Formula (Distance Calculation)

The system uses the **Haversine formula** to calculate the great-circle distance between two points on Earth's surface, accounting for Earth's curvature:

```
a = sin²(Δφ/2) + cos(φ₁) × cos(φ₂) × sin²(Δλ/2)
c = 2 × atan2(√a, √(1-a))
d = R × c
```

Where:

- **φ₁, φ₂** = latitude of point 1 and point 2 (in radians)
- **Δφ** = φ₂ - φ₁ (difference in latitude)
- **Δλ** = λ₂ - λ₁ (difference in longitude)
- **R** = Earth's radius (6,371 km)
- **d** = distance between the two points (in km)

**Implementation**:

```javascript
calculateDistance(point1, point2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(point2.lat - point1.lat);
  const dLng = toRadians(point2.lng - point1.lng);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(point1.lat)) * Math.cos(toRadians(point2.lat)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}
```

##### 2. Cluster Centroid Calculation

The center of each cluster is calculated as the arithmetic mean of all points in the cluster:

```
Center_lat = (Σ lat_i) / n
Center_lng = (Σ lng_i) / n
```

Where:

- **lat_i, lng_i** = latitude and longitude of point i
- **n** = number of points in the cluster

##### 3. Cluster Radius

The cluster radius is the maximum distance from the centroid to any point in the cluster:

```
Radius = max(d(center, point_i)) for all i in cluster
```

##### 4. Cluster Density

Density is calculated as the number of complaints per unit area:

```
Density = n / A
A = π × r²
```

Where:

- **n** = number of points in cluster
- **A** = area of cluster (in km²)
- **r** = cluster radius (in km)

#### Theoretical Foundation: DBSCAN Algorithm

**DBSCAN** (Density-Based Spatial Clustering of Applications with Noise) is based on the following concepts:

##### Core Concepts

1. **ε-neighborhood**: The neighborhood within a radius ε of a given point

   ```
   N_ε(p) = {q ∈ D | dist(p,q) ≤ ε}
   ```

2. **Core Point**: A point p is a core point if:

   ```
   |N_ε(p)| ≥ MinPts
   ```

3. **Directly Density-Reachable**: A point q is directly density-reachable from p if:

   - q ∈ N_ε(p)
   - p is a core point

4. **Density-Reachable**: A point q is density-reachable from p if there exists a chain of points p₁, p₂, ..., pₙ where:

   - p₁ = p and pₙ = q
   - p\_{i+1} is directly density-reachable from p_i

5. **Density-Connected**: Points p and q are density-connected if there exists a point o such that both p and q are density-reachable from o

##### Algorithm Steps

1. **Initialize**: Mark all points as unvisited
2. **For each unvisited point p**:
   - Mark p as visited
   - Find N_ε(p) (all neighbors within ε distance)
   - If |N_ε(p)| < MinPts: mark p as noise
   - Else: Create new cluster C and expand it:
     - Add p to C
     - For each point q in N_ε(p):
       - If q is unvisited:
         - Mark q as visited
         - Find N_ε(q)
         - If |N*ε(q)| ≥ MinPts: add N*ε(q) to N_ε(p)
       - If q is not in any cluster: add q to C

##### Parameter Selection Theory

**Epsilon (ε)**: Selected using the k-distance graph method:

- Calculate k-distance for each point (distance to kth nearest neighbor)
- Sort distances in ascending order
- Plot the sorted k-distances
- Choose ε at the "elbow" point (point of maximum curvature)

**MinPts**: Typically chosen as:

```
MinPts ≥ D + 1
```

Where D is the dimensionality of the dataset (D = 2 for geospatial data)

For our implementation:

- **ε = 0.01 degrees** (≈ 1.1 km at equator)
- **MinPts = 3** (minimum for 2D spatial data)

#### Technical Implementation

**File**: `public/js/components/map/dbscan.js`

```javascript
class DBSCAN {
  constructor(eps = 0.01, minPts = 3) {
    this.eps = eps; // ε parameter
    this.minPts = minPts; // MinPts parameter
  }

  cluster(points) {
    const visited = new Array(points.length).fill(false);
    const clustered = new Array(points.length).fill(false);
    const clusters = [];
    const noise = [];

    for (let i = 0; i < points.length; i++) {
      if (visited[i]) continue;

      visited[i] = true;
      const neighbors = this.findNeighbors(points, i);

      if (neighbors.length < this.minPts) {
        noise.push(i); // Mark as noise
      } else {
        // Expand cluster
        const cluster = [i];
        clustered[i] = true;

        let j = 0;
        while (j < neighbors.length) {
          const neighborIndex = neighbors[j];

          if (!visited[neighborIndex]) {
            visited[neighborIndex] = true;
            const neighborNeighbors = this.findNeighbors(points, neighborIndex);

            if (neighborNeighbors.length >= this.minPts) {
              neighbors.push(...neighborNeighbors);
            }
          }

          if (!clustered[neighborIndex]) {
            cluster.push(neighborIndex);
            clustered[neighborIndex] = true;
          }

          j++;
        }

        clusters.push(cluster);
      }
    }

    return { clusters, noise };
  }
}
```

#### Visualization Features

- **Color-Coded Clusters**: Different colors for different cluster densities

  - Red: High-density clusters (urgent attention required)
  - Orange: Medium-density clusters
  - Yellow: Low-density clusters
  - Gray: Noise points (isolated complaints)

- **Interactive Cluster Markers**: Click on cluster markers to view:

  - Number of complaints in cluster
  - Cluster radius
  - List of complaints within cluster
  - Common complaint categories

- **Dynamic Filtering**: Filter clusters by:
  - Date range
  - Complaint status
  - Department/Category
  - Priority level

### Use Cases for LGUs

1. **Resource Allocation**: Identify areas requiring immediate attention and allocate resources accordingly
2. **Infrastructure Planning**: Detect patterns in infrastructure-related complaints to guide development projects
3. **Policy Development**: Use spatial patterns to inform evidence-based policy decisions
4. **Performance Monitoring**: Track how complaint hotspots change over time after interventions
5. **Budget Planning**: Justify budget allocations with data-driven spatial analysis

### Heatmap Analytics Dashboard

**Location**: LGU Admin Dashboard → Heatmap Analytics

**Features**:

- Real-time cluster visualization on interactive map
- Statistical summary of clusters (count, average size, density)
- Temporal analysis of cluster evolution
- Export capabilities for reports and presentations
- Comparison tools for before/after intervention analysis

### Database Schema for Geospatial Data

```sql
-- Complaints table with geospatial data
CREATE TABLE complaints (
  id UUID PRIMARY KEY,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  location_point GEOGRAPHY(POINT, 4326), -- PostGIS geography type
  description TEXT,
  category_id UUID,
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Spatial index for performance
CREATE INDEX idx_complaints_location ON complaints USING GIST(location_point);

-- Cluster results storage
CREATE TABLE complaint_clusters (
  id UUID PRIMARY KEY,
  cluster_id INTEGER,
  center_lat DECIMAL(10, 8),
  center_lng DECIMAL(11, 8),
  radius DECIMAL(10, 2),
  complaint_ids UUID[],
  complaint_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🗄️ Database Tables

### Core Tables for Heatmap Functionality

| Table                  | Purpose                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| **complaints**         | Main complaint records with geospatial coordinates (latitude, longitude, location_point) |
| **complaint_clusters** | Stores DBSCAN clustering results with cluster centers, radius, and member complaint IDs  |
| **categories**         | Top-level complaint categories for filtering and analysis                                |
| **subcategories**      | Specific complaint types within categories                                               |
| **departments**        | Government departments handling complaints                                               |

### Supporting Tables

| Table                     | Purpose                                      |
| ------------------------- | -------------------------------------------- |
| **complaint_assignments** | Tracks department assignments for complaints |
| **complaint_history**     | Audit trail for complaint lifecycle          |
| **audit_logs**            | System-wide action logging                   |
| **auth.users**            | User authentication (Supabase-managed)       |

## 🔧 API Endpoints

### Heatmap & Analytics

- `GET /api/complaints/geospatial` - Get all complaints with geospatial data
- `GET /api/complaints/clusters` - Get DBSCAN cluster analysis results
- `GET /api/analytics/heatmap` - Get heatmap data with filters
- `GET /api/analytics/cluster-stats` - Get cluster statistics

### Complaints

- `POST /api/complaints` - Submit new complaint with location
- `GET /api/complaints/my` - Get user's complaints
- `GET /api/complaints/:id` - Get complaint details
- `PATCH /api/complaints/:id/status` - Update complaint status

### Departments & Structure

- `GET /api/departments/active` - Get active departments
- `GET /api/categories` - Get all categories
- `GET /api/subcategories` - Get subcategories by category

## 👥 User Roles

- **Citizen**: Submit complaints with location data and track their status
- **LGU Officer**: View and process assigned complaints
- **LGU Admin**: Access heatmap analytics, manage department complaints, and view cluster analysis
- **Super Admin**: Full system administration and advanced analytics

## 🛠️ Environment Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Application Settings
NODE_ENV=development
PORT=3000
HOST=localhost

# DBSCAN Configuration (optional, defaults in code)
DBSCAN_EPSILON=0.01
DBSCAN_MIN_POINTS=3
```

### NPM Scripts

```bash
# Development
npm run dev          # Start development server with auto-reload
npm run check        # Run comprehensive health checks

# Production
npm start            # Start production server

# Database
npm run migrate      # Run database migrations
npm run seed         # Seed database with sample data

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix linting issues automatically
```

## 📊 Heatmap Workflow

### 1. Data Collection

Citizens submit complaints through the web interface, providing:

- Complaint description
- Category/Subcategory
- **Location (via map picker or GPS)**
- Optional evidence files

### 2. Data Storage

Complaints are stored with geospatial data:

- Latitude and longitude coordinates
- PostGIS geography point for spatial queries
- Spatial indexing for performance

### 3. Cluster Analysis

DBSCAN algorithm processes complaint locations:

- Groups nearby complaints into clusters
- Identifies cluster centers and boundaries
- Calculates cluster density and statistics
- Marks outlier complaints as noise

### 4. Visualization

Interactive map displays:

- Individual complaint markers
- Cluster overlays with color-coded density
- Cluster statistics on hover/click
- Filter controls for dynamic analysis

### 5. Decision Making

LGU administrators use insights to:

- Prioritize resource deployment
- Plan infrastructure improvements
- Monitor intervention effectiveness
- Generate reports for stakeholders

## 🔒 Security

- **Input Validation**: Comprehensive validation of geospatial coordinates
- **SQL Injection Protection**: Parameterized queries for spatial data
- **Role-Based Access**: Granular permissions for analytics features
- **XSS Prevention**: Output sanitization for map markers
- **Rate Limiting**: Protection against API abuse

## 🚀 Deployment

### Production Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied (including PostGIS extension)
- [ ] Spatial indexes created for performance
- [ ] SSL certificates installed
- [ ] Health checks passing
- [ ] Map API keys configured

## 👨‍💻 Development Team

DRIMS 2.0 was developed by:

**Pyrrhus Go** - _Backend Developer_

- Server architecture and API design
- DBSCAN algorithm implementation
- Database schema and spatial queries

**John Dave Maca** - _Frontend Developer_

- User interface design
- Map visualization and clustering UI
- Interactive heatmap dashboard

**Josh Andre Timosan** - _Data Surveyor_

- Database design and optimization
- Geospatial data modeling
- Analytics and reporting requirements

---

## � References

### Theoretical Foundations

1. **Ester, M., Kriegel, H. P., Sander, J., & Xu, X. (1996)**. "A density-based algorithm for discovering clusters in large spatial databases with noise." In _Proceedings of the Second International Conference on Knowledge Discovery and Data Mining (KDD-96)_, pp. 226-231. AAAI Press.

   - Original DBSCAN algorithm paper
   - Defines core concepts: ε-neighborhood, core points, density-reachability

2. **Sinnott, R. W. (1984)**. "Virtues of the Haversine." _Sky and Telescope_, 68(2), 159.

   - Haversine formula for great-circle distance calculation
   - Accurate distance computation on Earth's surface

3. **Schubert, E., Sander, J., Ester, M., Kriegel, H. P., & Xu, X. (2017)**. "DBSCAN Revisited, Revisited: Why and How You Should (Still) Use DBSCAN." _ACM Transactions on Database Systems (TODS)_, 42(3), 1-21.
   - Modern analysis of DBSCAN performance
   - Parameter selection guidelines
   - Comparison with other clustering algorithms

### Implementation Resources

4. **PostGIS Documentation**. "Geography Type." PostgreSQL PostGIS Extension.

   - Geospatial data types and functions
   - Spatial indexing with GIST

5. **Leaflet.js**. "Interactive Maps Library."
   - JavaScript library for interactive maps
   - Marker clustering and visualization

---

## �📄 License

MIT License - see LICENSE file for details

---

**DRIMS 2.0** - Data-Driven Complaint Management with Geospatial Intelligence 🗺️
