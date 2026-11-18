# DOT Copilot API Documentation

RESTful API for the DOT Copilot training management system.

## Base URL

```
Development: http://localhost:3001/api
Production: https://your-domain.com/api
```

## Authentication

All endpoints except `/auth/login` and `/auth/register` require authentication.

### Authentication Header

```http
Authorization: Bearer <access_token>
```

### Token Lifecycle

- **Access Token**: Valid for 15 minutes
- **Refresh Token**: Valid for 7 days
- Use `/auth/refresh` to obtain new access token

## Response Format

### Success Response

```json
{
  "data": {
    // Response data
  }
}
```

### Error Response

```json
{
  "error": "Error message",
  "details": {
    // Optional error details
  }
}
```

### Pagination Response

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

## HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Validation Error |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

## Rate Limiting

- **General endpoints**: 100 requests per 15 minutes
- **Authentication endpoints**: 5 requests per 15 minutes
- **File upload endpoints**: 10 requests per 15 minutes

Rate limit headers:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

---

## Authentication Endpoints

### POST /auth/login

Authenticate user and receive access tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "DRIVER",
      "fleet": {
        "id": "uuid",
        "name": "Fleet A"
      }
    },
    "accessToken": "<example-token>",
    "refreshToken": "<example-token>"
  }
}
```

**Errors:**
- `401 Unauthorized`: Invalid credentials
- `429 Too Many Requests`: Rate limit exceeded

---

### POST /auth/register

Register a new user account.

**Request:**
```json
{
  "email": "newuser@example.com",
  "password": "securePassword123",
  "name": "Jane Smith",
  "role": "DRIVER",
  "fleetId": "uuid"
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "newuser@example.com",
      "name": "Jane Smith",
      "role": "DRIVER"
    },
    "accessToken": "<example-token>",
    "refreshToken": "<example-token>"
  }
}
```

**Errors:**
- `400 Bad Request`: Invalid input
- `409 Conflict`: Email already exists

---

### POST /auth/refresh

Refresh access token using refresh token.

**Request:**
```json
{
  "refreshToken": "<example-token>"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "accessToken": "<example-token>",
    "refreshToken": "<example-token>"
  }
}
```

**Errors:**
- `401 Unauthorized`: Invalid or expired refresh token

---

### POST /auth/logout

Invalidate current session.

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Response:** `204 No Content`

---

### POST /auth/reset-password

Request password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "message": "Password reset email sent"
  }
}
```

---

## User Endpoints

### GET /users

List all users (Admin, Supervisor only).

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `role` (string): Filter by role (ADMIN, SUPERVISOR, DRIVER)
- `fleetId` (string): Filter by fleet ID
- `search` (string): Search by name or email

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "DRIVER",
      "fleet": {
        "id": "uuid",
        "name": "Fleet A"
      },
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

---

### GET /users/:id

Get user by ID.

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "DRIVER",
    "fleet": {
      "id": "uuid",
      "name": "Fleet A"
    },
    "assignments": [
      {
        "id": "uuid",
        "trainingProgram": {
          "id": "uuid",
          "title": "Safety Training"
        },
        "status": "IN_PROGRESS",
        "progress": 45
      }
    ],
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Errors:**
- `404 Not Found`: User not found

---

### POST /users

Create new user (Admin only).

**Request:**
```json
{
  "email": "newuser@example.com",
  "password": "securePassword123",
  "name": "Jane Smith",
  "role": "DRIVER",
  "fleetId": "uuid"
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "uuid",
    "email": "newuser@example.com",
    "name": "Jane Smith",
    "role": "DRIVER",
    "fleet": {
      "id": "uuid",
      "name": "Fleet A"
    }
  }
}
```

---

### PUT /users/:id

Update user (Admin, Supervisor, or own profile).

**Request:**
```json
{
  "name": "John Updated",
  "email": "updated@example.com",
  "role": "SUPERVISOR",
  "fleetId": "uuid"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "email": "updated@example.com",
    "name": "John Updated",
    "role": "SUPERVISOR"
  }
}
```

---

### DELETE /users/:id

Delete user (Admin only).

**Response:** `204 No Content`

---

## Fleet Endpoints

### GET /fleets

List all fleets.

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `search` (string): Search by name

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Fleet A",
      "description": "Main fleet",
      "userCount": 25,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### GET /fleets/:id

Get fleet by ID with members.

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "name": "Fleet A",
    "description": "Main fleet",
    "users": [
      {
        "id": "uuid",
        "name": "John Doe",
        "email": "john@example.com",
        "role": "DRIVER"
      }
    ],
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### POST /fleets

Create new fleet (Admin only).

**Request:**
```json
{
  "name": "Fleet B",
  "description": "Secondary fleet"
}
```

**Response:** `201 Created`

---

### PUT /fleets/:id

Update fleet (Admin only).

**Request:**
```json
{
  "name": "Updated Fleet Name",
  "description": "Updated description"
}
```

**Response:** `200 OK`

---

### DELETE /fleets/:id

Delete fleet (Admin only).

**Response:** `204 No Content`

---

## Training Program Endpoints

### GET /training-programs

List all training programs.

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `status` (string): Filter by status (DRAFT, PUBLISHED, ARCHIVED)
- `search` (string): Search by title

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Safety Training",
      "description": "Comprehensive safety training",
      "status": "PUBLISHED",
      "moduleCount": 5,
      "duration": 120,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### GET /training-programs/:id

Get training program with modules and lessons.

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "title": "Safety Training",
    "description": "Comprehensive safety training",
    "status": "PUBLISHED",
    "modules": [
      {
        "id": "uuid",
        "title": "Module 1",
        "order": 1,
        "lessons": [
          {
            "id": "uuid",
            "title": "Lesson 1",
            "type": "VIDEO",
            "duration": 15,
            "order": 1
          }
        ]
      }
    ],
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### POST /training-programs

Create training program (Admin, Supervisor).

**Request:**
```json
{
  "title": "New Training",
  "description": "Training description",
  "status": "DRAFT"
}
```

**Response:** `201 Created`

---

### PUT /training-programs/:id

Update training program (Admin, Supervisor).

**Request:**
```json
{
  "title": "Updated Training",
  "description": "Updated description",
  "status": "PUBLISHED"
}
```

**Response:** `200 OK`

---

### DELETE /training-programs/:id

Delete training program (Admin only).

**Response:** `204 No Content`

---

## Module Endpoints

### GET /modules

List modules for a training program.

**Query Parameters:**
- `trainingProgramId` (string, required): Training program ID

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Module 1",
      "description": "First module",
      "order": 1,
      "lessonCount": 3,
      "duration": 45
    }
  ]
}
```

---

### GET /modules/:id

Get module with lessons.

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "title": "Module 1",
    "description": "First module",
    "order": 1,
    "trainingProgram": {
      "id": "uuid",
      "title": "Safety Training"
    },
    "lessons": [
      {
        "id": "uuid",
        "title": "Lesson 1",
        "type": "VIDEO",
        "content": "...",
        "duration": 15,
        "order": 1
      }
    ]
  }
}
```

---

### POST /modules

Create module (Admin, Supervisor).

**Request:**
```json
{
  "trainingProgramId": "uuid",
  "title": "New Module",
  "description": "Module description",
  "order": 2
}
```

**Response:** `201 Created`

---

### PUT /modules/:id

Update module (Admin, Supervisor).

**Response:** `200 OK`

---

### DELETE /modules/:id

Delete module (Admin, Supervisor).

**Response:** `204 No Content`

---

## Lesson Endpoints

### GET /lessons

List lessons for a module.

**Query Parameters:**
- `moduleId` (string, required): Module ID

**Response:** `200 OK`

---

### GET /lessons/:id

Get lesson details.

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "title": "Lesson 1",
    "type": "VIDEO",
    "content": "Lesson content or video URL",
    "duration": 15,
    "order": 1,
    "module": {
      "id": "uuid",
      "title": "Module 1"
    },
    "quiz": {
      "id": "uuid",
      "questions": [...]
    }
  }
}
```

---

### POST /lessons

Create lesson (Admin, Supervisor).

**Request:**
```json
{
  "moduleId": "uuid",
  "title": "New Lesson",
  "type": "VIDEO",
  "content": "https://video-url.com",
  "duration": 20,
  "order": 3
}
```

**Response:** `201 Created`

---

### PUT /lessons/:id

Update lesson (Admin, Supervisor).

**Response:** `200 OK`

---

### DELETE /lessons/:id

Delete lesson (Admin, Supervisor).

**Response:** `204 No Content`

---

## Assignment Endpoints

### GET /assignments

List assignments.

**Query Parameters:**
- `userId` (string): Filter by user
- `trainingProgramId` (string): Filter by training program
- `status` (string): Filter by status (NOT_STARTED, IN_PROGRESS, COMPLETED)

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "user": {
        "id": "uuid",
        "name": "John Doe"
      },
      "trainingProgram": {
        "id": "uuid",
        "title": "Safety Training"
      },
      "status": "IN_PROGRESS",
      "progress": 45,
      "dueDate": "2024-02-15T00:00:00Z",
      "assignedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### GET /assignments/:id

Get assignment details with progress.

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "user": {...},
    "trainingProgram": {...},
    "status": "IN_PROGRESS",
    "progress": 45,
    "completedLessons": 5,
    "totalLessons": 11,
    "completionRecords": [
      {
        "lessonId": "uuid",
        "completedAt": "2024-01-16T14:30:00Z",
        "score": 85
      }
    ],
    "dueDate": "2024-02-15T00:00:00Z"
  }
}
```

---

### POST /assignments

Create assignment (Admin, Supervisor).

**Request:**
```json
{
  "userId": "uuid",
  "trainingProgramId": "uuid",
  "dueDate": "2024-02-15T00:00:00Z"
}
```

**Response:** `201 Created`

---

### PUT /assignments/:id

Update assignment status.

**Request:**
```json
{
  "status": "COMPLETED"
}
```

**Response:** `200 OK`

---

### DELETE /assignments/:id

Delete assignment (Admin, Supervisor).

**Response:** `204 No Content`

---

## Quiz Endpoints

### GET /quizzes/:lessonId

Get quiz for a lesson.

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "lessonId": "uuid",
    "questions": [
      {
        "id": "uuid",
        "question": "What is the speed limit?",
        "type": "MULTIPLE_CHOICE",
        "options": ["55 mph", "65 mph", "75 mph"],
        "correctAnswer": "65 mph",
        "order": 1
      }
    ]
  }
}
```

---

### POST /quizzes/:lessonId/submit

Submit quiz answers.

**Request:**
```json
{
  "answers": [
    {
      "questionId": "uuid",
      "answer": "65 mph"
    }
  ]
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "score": 85,
    "totalQuestions": 10,
    "correctAnswers": 8,
    "passed": true,
    "results": [
      {
        "questionId": "uuid",
        "correct": true,
        "userAnswer": "65 mph",
        "correctAnswer": "65 mph"
      }
    ]
  }
}
```

---

## Notification Endpoints

### GET /notifications

Get user notifications.

**Query Parameters:**
- `read` (boolean): Filter by read status
- `type` (string): Filter by type

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "ASSIGNMENT",
      "title": "New Training Assigned",
      "message": "You have been assigned Safety Training",
      "read": false,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### PUT /notifications/:id/read

Mark notification as read.

**Response:** `200 OK`

---

### PUT /notifications/read-all

Mark all notifications as read.

**Response:** `200 OK`

---

## Upload Endpoints

### POST /uploads

Upload file (Admin, Supervisor).

**Request:** `multipart/form-data`
```
file: <binary>
type: "TRAINING_MATERIAL" | "PROFILE_IMAGE" | "DOCUMENT"
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "uuid",
    "filename": "document.pdf",
    "url": "https://storage.example.com/uploads/document.pdf",
    "size": 1024000,
    "mimeType": "application/pdf",
    "uploadedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Limits:**
- Max file size: 50MB
- Allowed types: PDF, images (JPG, PNG), videos (MP4)

---

### GET /uploads/:id

Get upload details.

**Response:** `200 OK`

---

### DELETE /uploads/:id

Delete uploaded file (Admin, Supervisor).

**Response:** `204 No Content`

---

## Health Check Endpoints

### GET /health

Basic health check.

**Response:** `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

### GET /health/ready

Readiness check (includes database).

**Response:** `200 OK`
```json
{
  "status": "ready",
  "database": "connected",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

### GET /health/live

Liveness check.

**Response:** `200 OK`
```json
{
  "status": "alive",
  "uptime": 3600,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Webhooks

### POST /webhooks/email-status

Email delivery status webhook (internal).

**Request:**
```json
{
  "messageId": "uuid",
  "status": "delivered",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| `AUTH_001` | Invalid credentials | Email or password incorrect |
| `AUTH_002` | Token expired | Access token has expired |
| `AUTH_003` | Invalid token | Token is malformed or invalid |
| `AUTH_004` | Insufficient permissions | User lacks required role |
| `VAL_001` | Validation error | Request body validation failed |
| `VAL_002` | Invalid ID format | UUID format is invalid |
| `RES_001` | Resource not found | Requested resource doesn't exist |
| `RES_002` | Resource conflict | Resource already exists |
| `RATE_001` | Rate limit exceeded | Too many requests |
| `SYS_001` | Internal server error | Unexpected server error |

---

## Pagination

All list endpoints support pagination:

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)

**Response includes:**
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## Filtering and Sorting

### Filtering

Use query parameters to filter results:
```
GET /users?role=DRIVER&fleetId=uuid
```

### Sorting

Use `sortBy` and `order` parameters:
```
GET /users?sortBy=createdAt&order=desc
```

Supported sort fields vary by endpoint.

---

## Versioning

API version is included in the URL:
```
/api/v1/users
```

Current version: `v1`

---

## SDKs and Client Libraries

### JavaScript/TypeScript

```bash
npm install @dot-copilot/api-client
```

```typescript
import { DotCopilotClient } from '@dot-copilot/api-client';

const client = new DotCopilotClient({
  baseURL: 'https://api.dotcopilot.com',
  apiKey: 'your-api-key'
});

const users = await client.users.list();
```

### Python

```bash
pip install dot-copilot-sdk
```

```python
from dot_copilot import Client

client = Client(api_key='your-api-key')
users = client.users.list()
```

---

## Testing

### Postman Collection

Import the Postman collection for easy API testing:
```
docs/postman/DOT-Copilot-API.postman_collection.json
```

### cURL Examples

See [docs/API-EXAMPLES.md](./API-EXAMPLES.md) for cURL examples.

---

## Support

- **Documentation**: https://docs.dotcopilot.com
- **API Status**: https://status.dotcopilot.com
- **Support Email**: support@dotcopilot.com
- **GitHub Issues**: https://github.com/dobeutech/DOT-Copilot/issues
