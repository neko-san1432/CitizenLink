# CitizenLink Design Patterns Documentation

## Overview
This document outlines the key design patterns implemented in the CitizenLink application, a citizen complaint management system. The application follows a modern web architecture with clear separation of concerns and established software engineering patterns.

## 🏗️ Architectural Patterns

### 1. **MVC (Model-View-Controller) Architecture**
The application follows the MVC pattern with clear separation between data models, user interface, and control logic.

#### Implementation:
- **Models**: `src/server/models/` - Define data structures and business rules
- **Views**: `views/` - HTML templates and client-side rendering
- **Controllers**: `src/server/controllers/` - Handle HTTP requests and responses

```javascript
// Model Example - src/server/models/Complaint.js
class Complaint {
  constructor(data = {}) {
    // Data structure definition
    this.title = data.title;
    this.status = data.status || 'pending review';
    // ...
  }

  static validate(data) {
    // Business rule validation
    const errors = [];
    if (!data.title || data.title.trim().length < 5) {
      errors.push('Title must be at least 5 characters');
    }
    return { isValid: errors.length === 0, errors };
  }

  sanitizeForInsert() {
    // Data sanitization logic
    return {
      title: this.title?.trim(),
      status: this.status || 'pending review',
      // ...
    };
  }
}
```

### 2. **Three-Tier Architecture**
The application is organized into three distinct layers:

#### Presentation Layer (`src/client/`)
- User interface components
- Form handling and validation
- Real-time user interactions
- File upload handling

#### Application Layer (`src/server/`)
- Controllers handle HTTP requests
- Services contain business logic
- Middleware processes requests
- Routes define API endpoints

#### Data Layer (`database_clean_setup.sql`)
- Database schema and relationships
- Repository classes for data access
- Connection management

## 🎯 Creational Patterns

### 3. **Singleton Pattern**
Used for shared resources that should have only one instance.

#### Database Connection (`src/server/config/database.js`)
```javascript
class Database {
  constructor() {
    this.supabase = null;
    this._initialized = false;
  }

  _initialize() {
    if (this._initialized) return; // Ensure single instance
    this.supabase = createClient(supabaseUrl, serviceRoleKey);
    this._initialized = true;
  }

  getClient() {
    this._initialize();
    return this.supabase;
  }
}
```

#### Toast Notification Manager (`src/client/components/toast.js`)
```javascript
class ToastManager {
  constructor() {
    this.toasts = [];
    this.container = null;
    this.init(); // Single global instance
  }
}

// Global singleton instance
const toastManager = new ToastManager();
```

### 4. **Factory Pattern**
Used for creating objects with complex initialization logic.

#### File Handler Factory (`src/client/utils/fileHandler.js`)
```javascript
export function createComplaintFileHandler(options = {}) {
  const defaults = {
    maxFiles: 5,
    onFilesChange: (files) => {
      window.selectedFiles = files;
    }
  };

  return new FileHandler({ ...defaults, ...options });
}
```

## 🏪 Structural Patterns

### 5. **Repository Pattern**
Provides a unified interface for data access operations.

#### Complaint Repository (`src/server/repositories/ComplaintRepository.js`)
```javascript
class ComplaintRepository {
  constructor() {
    this.db = new Database();
    this.supabase = this.db.getClient();
  }

  async create(complaintData) {
    const { data, error } = await this.supabase
      .from('complaints')
      .insert(complaintData)
      .select()
      .single();

    if (error) throw error;
    return new Complaint(data);
  }

  async findById(id) {
    const { data, error } = await this.supabase
      .from('complaints')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return new Complaint(data);
  }

  async findByUserId(userId, options = {}) {
    // Complex query logic with pagination
    let query = this.supabase
      .from('complaints')
      .select('*')
      .eq('submitted_by', userId)
      .order('submitted_at', { ascending: false });

    // ... filtering and pagination logic
  }
}
```

### 6. **Service Layer Pattern**
Business logic is encapsulated in service classes.

#### Complaint Service (`src/server/services/ComplaintService.js`)
```javascript
class ComplaintService {
  constructor() {
    this.complaintRepo = new ComplaintRepository();
  }

  async createComplaint(userId, complaintData, files = []) {
    // Orchestrates the complaint creation process
    const complaint = new Complaint({
      ...complaintData,
      submitted_by: userId
    });

    const validation = Complaint.validate(complaint);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const sanitizedData = complaint.sanitizeForInsert();
    const createdComplaint = await this.complaintRepo.create(sanitizedData);

    // Post-creation workflow processing
    await this._processWorkflow(createdComplaint, complaintData.department_r || []);
    await this._processFileUploads(createdComplaint.id, files);

    return createdComplaint;
  }
}
```

## 🎭 Behavioral Patterns

### 7. **Middleware Pattern**
Interceptors that process requests before they reach the main handlers.

#### Authentication Middleware (`src/server/middleware/auth.js`)
```javascript
const authenticateUser = async (req, res, next) => {
  try {
    // Extract and validate authentication token
    const token = req.cookies?.sb_access_token ||
                  req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "No authentication token",
      });
    }

    // Validate token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    req.user = user;
    next(); // Continue to next middleware/route handler
  } catch (error) {
    // Handle authentication errors
    return res.status(401).json({
      success: false,
      error: "Authentication failed",
    });
  }
};
```

#### CSRF Protection Middleware (`src/server/middleware/csrf.js`)
```javascript
const csrfProtection = (req, res, next) => {
  // Validates CSRF tokens on state-changing requests
  // Implementation details...
};
```

### 8. **Observer Pattern**
Used for reactive updates and event-driven programming.

#### Form Validation (`src/client/utils/validation.js`)
```javascript
export const setupRealtimeValidation = (form) => {
  const validateTarget = (selector) => {
    const input = form.querySelector(selector);
    const rule = rules[selector] || {};

    if (rule.required && !value) {
      return setError(input, 'This field is required');
    }
    // ... validation logic

    setError(input, ''); // Clear errors
  };

  // Attach observers to form inputs
  Object.keys(rules).forEach((selector) => {
    const input = form.querySelector(selector);
    ['input', 'change', 'blur'].forEach((evt) => {
      input.addEventListener(evt, () => validateTarget(selector));
    });
  });
};
```

#### File Upload Observer (`src/client/utils/fileHandler.js`)
```javascript
export class FileHandler {
  constructor(options = {}) {
    this.onFilesChange = options.onFilesChange || (() => {});
    // ...
  }

  addFiles(files) {
    // Process files and notify observers
    this.selectedFiles.push(...validation.validFiles);
    this.onFilesChange(this.selectedFiles); // Notify observers
    this.renderPreviews();
  }
}
```

## 🛠️ Utility Patterns

### 9. **Strategy Pattern**
Different algorithms for file handling and form submission.

#### File Upload Strategy (`src/client/utils/fileHandler.js`)
```javascript
export function setupDragAndDrop(dropZone, fileHandler, fileInput) {
  // Multiple strategies for file selection:
  // 1. Drag and drop
  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    fileHandler.addFiles(files);
  });

  // 2. Click to browse
  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  // 3. File input change
  fileInput.addEventListener('change', (e) => {
    fileHandler.addFiles(e.target.files);
  });
}
```

### 10. **Template Method Pattern**
Defines the skeleton of an algorithm with customizable steps.

#### Form Submission (`src/client/components/form/formSubmission.js`)
```javascript
export async function handleComplaintSubmit(formElement, selectedFiles = []) {
  try {
    // Template method steps:
    // 1. Disable submit button (customizable)
    const submitBtn = formElement.querySelector('.submit-btn');
    if (submitBtn) {
      submitBtn.textContent = 'Submitting...';
      submitBtn.disabled = true;
    }

    // 2. Extract and validate data (required step)
    const formData = extractComplaintFormData(formElement);
    const validation = validateComplaintForm(formData);

    // 3. Submit data (required step)
    const apiFormData = new FormData();
    // ... data preparation

    const result = await apiClient.submitComplaint(apiFormData);

    // 4. Handle success (customizable)
    showMessage('success', 'Complaint submitted successfully');

    // 5. Reset form (customizable)
    resetComplaintForm(formElement, () => fileHandler.clearAll());

  } catch (error) {
    // Error handling (customizable)
    showMessage('error', error.message || 'Failed to submit complaint');
  } finally {
    // Cleanup (customizable)
    if (submitBtn) {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  }
}
```

### 11. **Chain of Responsibility Pattern**
Used for sequential processing of requests through a chain of handlers.

#### Route Organization (`src/server/routes/index.js`)
```javascript
const router = express.Router();

// Chain of middleware and route handlers:
// 1. CAPTCHA verification
router.use('/captcha', captchaRoutes);

// 2. Supabase configuration
router.use('/supabase', supabaseRoutes);

// 3. Authentication routes
router.use('/auth', authRoutes);

// 4. Resource routes (after authentication)
router.use('/complaints', complaintRoutes);
router.use('/departments', departmentRoutes);
```

## 🔒 Security Patterns

### 12. **Role-Based Access Control (RBAC)**
Implemented through middleware for authorization.

#### Authorization Middleware (`src/server/middleware/auth.js`)
```javascript
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user?.raw_user_meta_data?.role;

    const hasPermission = allowedRoles.some((allowedRole) => {
      if (typeof allowedRole === "string") {
        return userRole === allowedRole;
      } else if (allowedRole instanceof RegExp) {
        return allowedRole.test(userRole); // Pattern matching for role prefixes
      }
      return false;
    });

    if (!hasPermission) {
      return res.status(404).sendFile(path.join(__dirname, "../../views/pages/404.html"));
    }

    next();
  };
};
```

## 📊 Data Patterns

### 13. **Data Transfer Object (DTO) Pattern**
Used for transferring data between layers with validation.

#### Complaint DTO (`src/server/models/Complaint.js`)
```javascript
sanitizeForInsert() {
  return {
    submitted_by: this.submitted_by,
    title: this.title?.trim(),
    type: this.type || null,
    descriptive_su: this.descriptive_su?.trim(),
    location_text: this.location_text?.trim(),
    // ... sanitized data for database insertion
  };
}

toJSON() {
  return {
    id: this.id,
    title: this.title,
    status: this.status,
    // ... data for API responses
  };
}
```

## 🔄 Integration Patterns

### 14. **API Gateway Pattern**
Centralized entry point for API requests.

#### Route Aggregation (`src/server/routes/index.js`)
```javascript
// Single entry point that routes to appropriate handlers
router.use('/complaints', complaintRoutes);
router.use('/departments', departmentRoutes);
router.use('/settings', settingRoutes);
```

## 📋 Summary Table

| Pattern | Category | Purpose | Location |
|---------|----------|---------|----------|
| MVC | Architectural | Separation of concerns | Models/Controllers/Views |
| Repository | Structural | Data access abstraction | `src/server/repositories/` |
| Service Layer | Structural | Business logic encapsulation | `src/server/services/` |
| Singleton | Creational | Single instance resources | Database, ToastManager |
| Factory | Creational | Object creation with logic | FileHandler factory |
| Middleware | Behavioral | Request processing | `src/server/middleware/` |
| Observer | Behavioral | Event-driven updates | Form validation, File handling |
| Strategy | Behavioral | Multiple algorithms | File upload methods |
| Template Method | Behavioral | Algorithm skeleton | Form submission process |
| Chain of Responsibility | Behavioral | Sequential processing | Route middleware chain |
| RBAC | Security | Access control | Authorization middleware |
| DTO | Data | Data transfer | Model serialization methods |
| API Gateway | Integration | Request routing | Route aggregation |

## 🎯 Benefits Achieved

1. **Maintainability**: Clear separation of concerns makes code easier to modify
2. **Testability**: Individual components can be tested in isolation
3. **Scalability**: Patterns support adding new features without major refactoring
4. **Security**: RBAC and middleware patterns ensure proper access control
5. **Reusability**: Repository and service patterns promote code reuse
6. **Consistency**: Established patterns ensure consistent code structure

## 🔮 Future Enhancements

Consider implementing additional patterns as the application grows:

- **Command Pattern** for complex business operations
- **Event Sourcing** for audit trails
- **CQRS** for separating read/write operations
- **Circuit Breaker** for external service resilience
- **Decorator Pattern** for feature toggles and instrumentation

This design pattern implementation provides a solid foundation for the CitizenLink application, ensuring maintainability, scalability, and code quality as the system evolves.



