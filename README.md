# CitizenLink 2.0

**Modern Citizen Complaint Management System with Advanced Analytics and Clean Architecture**

## 📖 About the Program

### Introduction

CitizenLink 2.0 is a comprehensive web-based complaint management system designed for Local Government Units (LGUs) to efficiently handle, route, and resolve citizen complaints. The system features advanced geospatial analytics using DBSCAN clustering for complaint hotspot detection, robust security measures, content management capabilities, and intelligent complaint distribution mechanisms.

Built with modern web technologies and following clean architecture principles, CitizenLink provides a scalable, maintainable, and secure platform for managing citizen feedback and complaints across multiple government departments.

### Key Capabilities

- **Intelligent Complaint Routing**: Automated department assignment with coordinator oversight
- **Geospatial Analytics**: DBSCAN-based heatmap clustering for identifying complaint hotspots
- **Multi-Role System**: Support for Citizens, LGU Officers, Admins, HR, and Super Admins
- **Content Management**: Integrated news, events, and notices publishing system
- **Duplicate Detection**: Advanced similarity detection to prevent duplicate complaints
- **Comprehensive Audit Trail**: Verbose logging of all system actions and state changes
- **Secure by Design**: Enterprise-grade security with Helmet.js, CSP, and RLS policies

## 📦 Installation & Dependencies

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **PostgreSQL** 13+ or **Supabase** account
- **npm** or **yarn** package manager

### Installation Steps

```bash
# Clone the repository
git clone <repository-url>
cd CitizenLink

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run migrate

# Start development server
npm run dev
```

### Dependencies Overview

#### Production Dependencies

| Package | Version | Purpose |
|---------|---------|----------|
| **@supabase/supabase-js** | ^2.57.4 | PostgreSQL database client with built-in authentication, real-time subscriptions, and Row Level Security (RLS) support. Provides seamless integration with Supabase backend services. |
| **chart.js** | ^4.5.0 | Data visualization library for rendering complaint statistics, trends, and analytics dashboards. Used for generating charts and graphs in admin panels. |
| **compression** | ^1.8.1 | HTTP response compression middleware for Express. Reduces bandwidth usage by compressing responses using gzip/deflate, improving application performance. |
| **cookie-parser** | ^1.4.7 | Express middleware for parsing cookies from HTTP requests. Essential for session management and authentication token handling. |
| **cors** | ^2.8.5 | Cross-Origin Resource Sharing (CORS) middleware. Enables secure API access from different origins while preventing unauthorized cross-domain requests. |
| **dotenv** | ^17.2.1 | Environment variable loader from `.env` files. Manages sensitive configuration data (API keys, database credentials) outside of source code. |
| **express** | ^4.21.2 | Fast, minimalist web framework for Node.js. Serves as the core HTTP server handling routing, middleware, and request/response management. |
| **helmet** | ^8.1.0 | Security middleware that sets various HTTP headers to protect against common web vulnerabilities (XSS, clickjacking, MIME sniffing). Implements Content Security Policy (CSP). |
| **multer** | ^2.0.2 | Multipart/form-data middleware for handling file uploads. Manages complaint evidence attachments with file type validation and size limits. |

#### Development Dependencies

| Package | Version | Purpose |
|---------|---------|----------|
| **autoprefixer** | ^10.4.21 | PostCSS plugin that automatically adds vendor prefixes to CSS rules for cross-browser compatibility. |
| **gzip-cli** | ^1.0.0 | Command-line tool for compressing static assets during build process to reduce file sizes. |
| **nodemon** | ^3.1.10 | Development utility that automatically restarts the Node.js server when file changes are detected. |
| **postcss** | ^8.5.6 | CSS transformation tool used with TailwindCSS for processing and optimizing stylesheets. |
| **tailwindcss** | ^3.4.18 | Utility-first CSS framework for rapid UI development with responsive design and modern styling. |

## 🏗️ Architecture

### Directory Structure

```
CitizenLink/
├── 📁 config/                 # Configuration management
│   └── app.js                 # Centralized app configuration
├── 📁 src/
│   ├── 📁 server/             # Backend (Node.js/Express)
│   │   ├── 📁 controllers/    # Request handlers (thin)
│   │   ├── 📁 services/       # Business logic (fat)
│   │   ├── 📁 repositories/   # Data access layer
│   │   ├── 📁 models/         # Data models & validation
│   │   ├── 📁 middleware/     # Express middleware
│   │   ├── 📁 routes/         # Route definitions
│   │   ├── 📁 config/         # Server configuration
│   │   ├── 📁 utils/          # Server utilities (prepared)
│   │   └── app.js             # Application setup
│   ├── 📁 client/             # Frontend (JavaScript)
│   │   ├── 📁 components/     # Reusable UI components
│   │   │   ├── 📁 complaint/  # Complaint-specific components
│   │   │   ├── 📁 form/       # Form handling components
│   │   │   └── 📁 map/        # Map integration components
│   │   ├── 📁 auth/           # Authentication components
│   │   ├── 📁 admin/          # Admin interface components
│   │   ├── 📁 services/       # API clients (prepared)
│   │   ├── 📁 utils/          # Client utilities
│   │   ├── 📁 styles/         # CSS files
│   │   ├── 📁 config/         # Client configuration
│   │   └── 📁 assets/         # Static assets
│   └── 📁 shared/             # Shared utilities & constants
├── 📁 views/                  # HTML templates
│   ├── 📁 pages/              # Page templates
│   │   ├── 📁 admin/          # Admin interface pages
│   │   ├── 📁 citizen/        # Citizen dashboard pages
│   │   ├── 📁 lgu/            # LGU staff pages
│   │   ├── 📁 lgu-admin/      # LGU admin pages
│   │   └── 📁 super-admin/    # Super admin pages
│   ├── 📁 components/         # Reusable HTML components (prepared)
│   └── 📁 layouts/            # Layout templates (prepared)
├── 📁 scripts/                # Utility scripts
└── 📁 uploads/                # User uploaded files (auto-created)
```

### Architectural Design Patterns

CitizenLink follows a **layered architecture** with clear separation of concerns, implementing multiple design patterns for maintainability and scalability.

#### 🏛️ MVC + Service Layer Architecture (Fat Service, Thin Controller)

The application implements an **enhanced MVC pattern** with an additional Service Layer, following the **"Fat Service, Thin Controller"** principle:

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                         │
│  (Views, Frontend Components, API Consumers)                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    CONTROLLER LAYER (Thin)                   │
│  • Request/Response handling                                 │
│  • Input parsing and validation                              │
│  • HTTP status code management                               │
│  • Minimal logic - delegates to services                     │
│                                                               │
│  Example: ComplaintController.js                             │
│  - Extracts request data                                     │
│  - Calls ComplaintService methods                            │
│  - Formats and returns responses                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                     SERVICE LAYER (Fat)                      │
│  • Business logic and rules                                  │
│  • Workflow orchestration                                    │
│  • Cross-cutting concerns                                    │
│  • Transaction management                                    │
│  • Coordinates multiple repositories                         │
│  • Implements domain logic                                   │
│                                                               │
│  Example: ComplaintService.js                                │
│  - Validates business rules                                  │
│  - Orchestrates complaint workflow                           │
│  - Manages department assignments                            │
│  - Triggers notifications                                    │
│  - Handles file processing                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   REPOSITORY LAYER                           │
│  • Data access abstraction                                   │
│  • Database queries (CRUD operations)                        │
│  • No business logic                                         │
│  • Returns domain models                                     │
│                                                               │
│  Example: ComplaintRepository.js                             │
│  - create(), findById(), findAll()                           │
│  - Supabase query execution                                  │
│  - Maps database rows to Models                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                      MODEL LAYER                             │
│  • Data structure definitions                                │
│  • Validation rules                                          │
│  • Data transformation methods                               │
│  • No business logic                                         │
│                                                               │
│  Example: Complaint.js                                       │
│  - Property definitions                                      │
│  - validate() method                                         │
│  - sanitizeForInsert() method                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    DATABASE LAYER                            │
│  (PostgreSQL/Supabase)                                       │
└─────────────────────────────────────────────────────────────┘
```

**Benefits of This Architecture:**

1. **Separation of Concerns**: Each layer has a single, well-defined responsibility
2. **Testability**: Business logic in services can be tested independently
3. **Reusability**: Services can be called from multiple controllers or other services
4. **Maintainability**: Changes to business logic don't affect controllers or repositories
5. **Scalability**: Easy to add new features without modifying existing layers

**Code Example:**

```javascript
// THIN CONTROLLER - Only handles HTTP concerns
class ComplaintController {
  async createComplaint(req, res) {
    try {
      const { user } = req;
      const complaintData = req.body;
      const files = req.files?.evidenceFiles || [];

      // Delegate to service layer
      const complaint = await this.complaintService.createComplaint(
        user.id, 
        complaintData, 
        files
      );

      // Format response
      res.status(201).json({
        success: true,
        data: complaint,
        message: "Complaint submitted successfully"
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

// FAT SERVICE - Contains all business logic
class ComplaintService {
  async createComplaint(userId, complaintData, files) {
    // Business validation
    const complaint = new Complaint(complaintData);
    const validation = Complaint.validate(complaint);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Orchestrate multiple operations
    const createdComplaint = await this.complaintRepo.create(complaint);
    await this._processWorkflow(createdComplaint, departments);
    await this._processFileUploads(createdComplaint.id, files);
    await this.notificationService.notifyComplaintSubmitted(userId, createdComplaint.id);
    
    // Business logic for duplicate detection
    await this.duplicationService.checkForDuplicates(createdComplaint);
    
    return createdComplaint;
  }
}

// REPOSITORY - Only data access
class ComplaintRepository {
  async create(complaintData) {
    const { data, error } = await this.supabase
      .from('complaints')
      .insert(complaintData)
      .select()
      .single();
    
    if (error) throw error;
    return new Complaint(data);
  }
}
```

#### 🎯 Additional Design Patterns

| Pattern | Implementation | Purpose |
|---------|----------------|---------|
| **Repository Pattern** | `ComplaintRepository`, `DepartmentRepository`, `CoordinatorRepository` | Abstracts data access logic, provides clean interface for database operations, enables easy testing with mock repositories |
| **Dependency Injection** | Constructor injection in Controllers and Services | Loose coupling between components, easier testing, flexible component replacement |
| **Model-View-Controller (MVC)** | Models (`Complaint.js`), Views (HTML templates), Controllers (`ComplaintController.js`) | Separates data, presentation, and control logic |
| **Middleware Pattern** | `auth.js`, `security.js`, `roleCheck.js` | Modular request/response processing pipeline, cross-cutting concerns (auth, logging, security) |
| **Factory Pattern** | Model constructors, Database client initialization | Centralized object creation, encapsulates instantiation logic |
| **Strategy Pattern** | Role-based access control, different notification strategies | Enables runtime selection of algorithms based on context |
| **Observer Pattern** | Notification system, event-driven workflows | Decoupled event handling, automatic notifications on state changes |
| **Singleton Pattern** | Database connection (`Database` class) | Single shared instance for database connections, resource optimization |
| **Facade Pattern** | Service layer methods that orchestrate multiple operations | Simplified interface to complex subsystems |
| **Chain of Responsibility** | Express middleware chain | Sequential processing of requests through multiple handlers |

#### 📋 Layer Responsibilities Summary

| Layer | Responsibilities | What It Should NOT Do |
|-------|------------------|----------------------|
| **Controllers** | Parse requests, call services, format responses, handle HTTP status codes | Business logic, database queries, complex validations |
| **Services** | Business logic, workflow orchestration, transaction management, coordinate repositories | Direct database access, HTTP concerns, response formatting |
| **Repositories** | CRUD operations, query building, data mapping | Business logic, validation, workflow management |
| **Models** | Data structure, basic validation, data transformation | Business logic, database access, HTTP handling |
| **Middleware** | Authentication, authorization, logging, security headers | Business logic, data access |

This architecture ensures that **business logic lives in the Service Layer**, making the codebase maintainable, testable, and scalable.

## ✨ Feature Highlights

### 🗺️ DBSCAN Heatmap Clustering

CitizenLink implements **Density-Based Spatial Clustering of Applications with Noise (DBSCAN)** algorithm for advanced geospatial analysis:

- **Hotspot Detection**: Automatically identifies areas with high complaint density
- **Cluster Visualization**: Interactive map overlays showing complaint clusters with color-coded severity
- **Configurable Parameters**: Adjustable epsilon (radius) and minimum points for cluster formation
- **Real-time Analysis**: Dynamic clustering based on filtered complaint data
- **Implementation**: Client-side JavaScript implementation in `src/client/components/map/dbscan.js`

**Use Cases**:
- Identify neighborhoods requiring immediate attention
- Allocate resources based on complaint concentration
- Detect patterns in infrastructure issues
- Support data-driven policy decisions

### 🔒 Robust Security

Comprehensive security implementation across multiple layers:

#### Application Security
- **Helmet.js Integration**: Sets 11+ security-related HTTP headers
- **Content Security Policy (CSP)**: Prevents XSS attacks by controlling resource loading
- **XSS Protection**: Output sanitization and input validation
- **CSRF Protection**: Request verification tokens
- **Clickjacking Prevention**: X-Frame-Options headers
- **MIME Sniffing Protection**: X-Content-Type-Options headers

#### Database Security
- **Row Level Security (RLS)**: PostgreSQL policies enforce data access at database level
- **Parameterized Queries**: SQL injection prevention
- **Role-Based Access Control**: Granular permissions per user role
- **Secure Authentication**: Supabase Auth with JWT tokens

#### File Upload Security
- **Type Validation**: Whitelist-based file type checking
- **Size Limits**: Configurable maximum file sizes
- **Virus Scanning Ready**: Architecture supports AV integration

**Security Files**:
- `src/server/middleware/security.js` - Security headers and CSP configuration
- `sql/20251008_security_rpc.sql` - Database security functions
- `RLS_POLICIES.sql` - Row Level Security policies

### 📰 Content Management System

Integrated CMS for public information dissemination:

#### News Management
- Create, publish, and archive news articles
- Rich text content with image support
- Category and tag-based organization
- Draft/Published/Archived workflow
- Author attribution and timestamps

#### Events Management
- Upcoming events calendar
- Event registration tracking
- Location and organizer information
- Status tracking (upcoming, ongoing, completed, cancelled)
- Maximum participant limits

#### Notices System
- Priority-based notices (low, normal, high, urgent)
- Target audience filtering (citizens, LGU staff, admins)
- Time-bound validity periods
- Alert types (announcement, alert, reminder, advisory)

**Database Tables**: `news`, `events`, `notices` (see `sql/content_management_schema.sql`)

### 🎯 Complaint Distribution via Coordinator

Intelligent complaint routing system:

- **Complaint Coordinator Role**: Dedicated role for complaint triage and assignment
- **Multi-Department Routing**: Complaints can be assigned to multiple departments
- **Assignment Workflow**: Pending → Accepted → In Progress → Resolved
- **Rejection Handling**: Departments can reject with reasons, triggering reassignment
- **Load Balancing**: Track assignments per officer to distribute workload
- **Escalation Support**: Automatic escalation for overdue complaints

**Key Tables**: `complaint_assignments`, `complaint_coordinators`

### 🔍 Duplication Detector

Advanced similarity detection to prevent duplicate complaints:

- **Text Similarity Analysis**: Compares complaint descriptions using natural language processing
- **Location-Based Matching**: Identifies complaints from similar geographic areas
- **Category Correlation**: Checks for similar complaint types and departments
- **Similarity Scoring**: Calculates similarity scores (0-1) for complaint pairs
- **Automatic Flagging**: Marks potential duplicates for coordinator review
- **Master Complaint Linking**: Links duplicate complaints to master complaint

**Implementation**: `src/server/services/SimilarityCalculatorService.js`
**Database Table**: `complaint_similarities`

### 📝 Verbose Logging & Audit Trail

Comprehensive logging system for accountability and debugging:

#### Audit Logs (`audit_logs` table)
- **System-Wide Tracking**: All critical actions logged
- **Actor Attribution**: Records who performed each action
- **IP Address Logging**: Tracks request origin
- **Metadata Storage**: JSONB field for flexible action details
- **Action Types**: User management, role changes, department transfers, system configuration

#### Complaint History (`complaint_history` table)
- **Per-Complaint Timeline**: Complete history of complaint lifecycle
- **Status Changes**: Tracks all status transitions
- **Assignment History**: Records all department and officer assignments
- **Notes and Comments**: Stores coordinator and officer notes

#### Workflow Logs (`complaint_workflow_logs` table)
- **Detailed Action Tracking**: Granular logging of workflow steps
- **JSONB Details**: Flexible schema for action-specific data
- **Performance Monitoring**: Timestamps for workflow analysis

**Benefits**:
- Full accountability and transparency
- Debugging and troubleshooting support
- Compliance and reporting
- Performance analysis and optimization

## 🛠️ Environment Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# External Services
CAPTCHA_CLIENT_KEY=your_recaptcha_site_key
CAPTCHA_SECRET_KEY=your_recaptcha_secret_key

# Application Settings
NODE_ENV=development
PORT=3000
HOST=localhost
```

### NPM Scripts

```bash
# Development
npm run dev          # Start development server with auto-reload
npm run check        # Run health checks

# Production
npm start            # Start production server
npm run prod         # Start with NODE_ENV=production

# Database
npm run migrate      # Run database migrations
npm run seed         # Seed database with sample data

# Build
npm run build        # Build TailwindCSS
npm run build:css    # Build and minify CSS

# Code Quality
npm test             # Run tests
npm run lint         # Run ESLint
npm run lint:fix     # Fix linting issues
```

## 🗄️ Database Tables and Purposes

### Core Complaint Management

| Table | Purpose |
|-------|----------|
| **complaints** | Main complaint records storing citizen-submitted issues. Includes location data, description, status, priority, type, department routing, workflow status, and resolution information. |
| **complaint_assignments** | Tracks department and officer assignments for each complaint. Manages assignment status (pending, accepted, rejected, completed), rejection reasons, and assignment history. |
| **complaint_history** | Complete audit trail for individual complaints. Records all actions, status changes, notes, and actor information with timestamps. |
| **complaint_workflow_logs** | Detailed workflow action logging with JSONB metadata. Tracks complaint lifecycle events, department transfers, and coordinator actions. |
| **complaint_similarities** | Stores similarity scores between complaints for duplicate detection. Links potential duplicate complaints with similarity metrics (0-1 scale). |

### Department & User Management

| Table | Purpose |
|-------|----------|
| **departments** | Stores LGU departments (e.g., Waste Management, Public Works). Includes department name, unique code, and creation timestamp. |
| **invitation_tokens** | HR-generated signup links for staff registration. Controls role assignment, department association, expiration, and usage limits. |
| **signup_links** | Alternative signup link system with metadata support. Tracks link usage, expiration, and creator information. |
| **role_changes** | Audit trail for user role modifications. Records old role, new role, performer, reason, and timestamp for accountability. |
| **department_transfers** | Tracks user transfers between departments. Maintains history of department assignments with performer attribution. |

### Content Management

| Table | Purpose |
|-------|----------|
| **news** | News articles for public information. Supports title, content, excerpt, images, categories, tags, and publication workflow (draft/published/archived). |
| **events** | Upcoming events calendar. Stores event details, location, dates, organizer, registration info, and status tracking. |
| **notices** | Official notices and announcements. Priority-based (low/normal/high/urgent) with target audience filtering and validity periods. |

### Notifications & Communication

| Table | Purpose |
|-------|----------|
| **app_notifications** | In-app user notifications for assignments, status changes, and system alerts. Supports priority levels, read status, expiration, and metadata. |

### System Audit & Security

| Table | Purpose |
|-------|----------|
| **audit_logs** | System-wide audit trail for all critical actions. Logs actor, action type, target (user/complaint/department), IP address, user agent, and JSONB details. |

### Authentication (Managed by Supabase)

| Table | Purpose |
|-------|----------|
| **auth.users** | Supabase-managed user authentication table. Stores email, encrypted password, user metadata (role, department), and authentication tokens. |

### Total Tables: 16 core tables + Supabase auth tables

## 🔧 API Endpoints

### Complaints
- `POST /api/complaints` - Submit new complaint
- `GET /api/complaints/my` - Get user's complaints
- `GET /api/complaints/:id` - Get complaint details
- `PATCH /api/complaints/:id/status` - Update complaint status

### Departments
- `GET /api/departments/active` - Get active departments
- `POST /api/departments` - Create department (admin)
- `PUT /api/departments/:id` - Update department (admin)
- `DELETE /api/departments/:id` - Delete department (admin)

### Settings
- `GET /api/settings/public` - Get public settings
- `PUT /api/settings/:key` - Update setting (admin)
- `POST /api/settings/initialize` - Initialize default settings

### Coordinators
- `GET /api/coordinators` - List coordinators (admin)
- `POST /api/coordinators` - Assign coordinator (admin)
- `DELETE /api/coordinators/:id` - Remove coordinator (admin)

## 👥 User Roles

- **Citizen**: Submit and track complaints
- **LGU**: View and process assigned complaints
- **LGU Admin**: Manage department complaints and coordinators
- **Super Admin**: Full system administration

## 🎨 Frontend Architecture

### Component Structure

```javascript
// Modular component pattern
import { ComponentBase } from '../base/ComponentBase.js';
import apiClient from '../services/apiClient.js';

class ComplaintForm extends ComponentBase {
  constructor(container) {
    super(container);
    this.init();
  }
  
  async init() {
    await this.loadDepartments();
    this.setupEventListeners();
  }
}
```

### Service Layer

```javascript
// API service abstraction
class ApiClient {
  async submitComplaint(data) {
    return this.post('/api/complaints', data);
  }
  
  async getDepartments() {
    return this.get('/api/departments/active');
  }
}
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix
```

## 📈 Performance

- **Modular Loading**: Components load only when needed
- **Optimized Static Serving**: Efficient asset delivery
- **Database Indexing**: Optimized query performance
- **Error Handling**: Graceful error recovery
- **Caching**: Strategic caching implementation

## 🔒 Security

- **Input Validation**: Comprehensive data validation
- **SQL Injection Protection**: Parameterized queries
- **XSS Prevention**: Output sanitization
- **CSRF Protection**: Request verification
- **File Upload Security**: Type and size validation
- **Role-Based Access**: Granular permission system

## 📝 Development Guidelines

### Code Style

- Use meaningful variable and function names
- Keep functions small and focused
- Follow single responsibility principle
- Write self-documenting code
- Use consistent error handling patterns

### File Organization

- Group related functionality together
- Separate concerns into different layers
- Use consistent naming conventions
- Maintain clean directory structure

### Git Workflow

```bash
# Feature development
git checkout -b feature/department-management
git add .
git commit -m "feat: add department management system"
git push origin feature/department-management
```

## 🚀 Deployment

### Production Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates installed
- [ ] Health checks passing
- [ ] Error monitoring setup
- [ ] Backup strategy implemented

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 📚 Documentation

- **API Docs**: Available at `/api/docs` (when implemented)
- **Architecture Guide**: See `/docs/architecture.md`
- **Deployment Guide**: See `/docs/deployment.md`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow coding standards
4. Write tests for new features
5. Submit a pull request

## 👨‍💻 Development Team

CitizenLink 2.0 was developed by a dedicated team of specialists:

### Core Developers

**Pyrrhus Go** - *Backend Developer*
- Server architecture and API design
- Database schema and migrations
- Authentication and security implementation
- Business logic and service layer
- Integration with Supabase

**John Dave Maca** - *Frontend Developer*
- User interface design and implementation
- Client-side JavaScript components
- Responsive design and UX optimization
- Map visualization and DBSCAN integration
- Admin dashboard development

**Josh Andre Timosan** - *Data Surveyor*
- Database design and optimization
- Data modeling and relationships
- SQL query optimization
- Data migration and seeding
- Analytics and reporting requirements

---

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Issues**: GitHub Issues
- **Documentation**: Project Wiki
- **Email**: support@citizenlink.gov

---

**CitizenLink 2.0** - Modern, Secure, Intelligent Complaint Management 🚀
