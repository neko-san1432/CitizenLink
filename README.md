# CitizenLink 2.0

Modern Citizen Complaint Management System with Clean Architecture

## 🚀 Features

- **Clean Architecture**: Modular, maintainable codebase
- **Multi-Department Workflow**: Advanced complaint routing and management
- **Department Management**: Dynamic department configuration
- **Customizable Settings**: Flexible terms, privacy policy, and system settings
- **File Upload**: Secure evidence file handling
- **Role-Based Access**: Comprehensive user role management
- **Audit Trail**: Complete action logging and tracking
- **Responsive Design**: Works on all devices

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

### Design Patterns Used

- **Repository Pattern**: Clean data access abstraction
- **Service Layer**: Business logic separation
- **MVC Architecture**: Model-View-Controller pattern
- **Dependency Injection**: Loose coupling between components
- **Factory Pattern**: Object creation abstraction
- **Middleware Pattern**: Request/response processing
- **Observer Pattern**: Event-driven architecture

## 🛠️ Setup & Installation

### Prerequisites

- Node.js 18+ 
- PostgreSQL 13+
- Supabase account

### Environment Variables

Create a `.env` file:

```env
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Security (handled by Supabase)
# JWT_SECRET=not_needed_using_supabase_auth
# SESSION_SECRET=not_needed_using_supabase_sessions

# External Services
CAPTCHA_CLIENT_KEY=your_recaptcha_site_key
CAPTCHA_SECRET_KEY=your_recaptcha_secret_key

# Application
NODE_ENV=development
PORT=3000
HOST=localhost
```

### Installation

```bash
# Install dependencies
npm install

# Run health check
npm run check

# Run migrations (manual step required)
npm run migrate

# Start development server
npm run dev

# Start production server
npm run prod
```

## 📊 Database Schema

### Core Tables

- **complaints**: Main complaint records with workflow support
- **departments**: Dynamic department management
- **settings**: Customizable application settings
- **complaint_coordinators**: Role-based complaint assignment
- **complaint_workflow_logs**: Audit trail for all actions

### New Features in 2.0

- Multi-department workflow system
- Customizable terms and privacy policies
- Dynamic department loading
- Enhanced audit trails
- Coordinator management system

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

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Issues**: GitHub Issues
- **Documentation**: Project Wiki
- **Email**: support@citizenlink.gov

---

**CitizenLink 2.0** - Modern, Maintainable, Scalable 🚀
