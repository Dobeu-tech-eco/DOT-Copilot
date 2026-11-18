# API Examples

Practical examples for using the DOT Copilot API.

## Authentication

### Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123456"
  }'
```

Response:
```json
{
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "admin@example.com",
      "name": "Admin User",
      "role": "ADMIN"
    },
    "accessToken": "<example-token>",
    "refreshToken": "<example-token>"
  }
}
```

### Using Access Token

```bash
# Store token in variable
TOKEN="<example-token>"

# Use in subsequent requests
curl -X GET http://localhost:3001/api/users \
  -H "Authorization: Bearer $TOKEN"
```

### Refresh Token

```bash
curl -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<example-token>"
  }'
```

## User Management

### List Users

```bash
curl -X GET "http://localhost:3001/api/users?page=1&limit=20&role=DRIVER" \
  -H "Authorization: Bearer $TOKEN"
```

### Get User by ID

```bash
curl -X GET http://localhost:3001/api/users/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

### Create User

```bash
curl -X POST http://localhost:3001/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newdriver@example.com",
    "password": "securePassword123",
    "name": "John Driver",
    "role": "DRIVER",
    "fleetId": "660e8400-e29b-41d4-a716-446655440000"
  }'
```

### Update User

```bash
curl -X PUT http://localhost:3001/api/users/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Updated Driver",
    "email": "updated@example.com"
  }'
```

### Delete User

```bash
curl -X DELETE http://localhost:3001/api/users/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

## Fleet Management

### List Fleets

```bash
curl -X GET http://localhost:3001/api/fleets \
  -H "Authorization: Bearer $TOKEN"
```

### Create Fleet

```bash
curl -X POST http://localhost:3001/api/fleets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Fleet Alpha",
    "description": "Primary fleet for east coast operations"
  }'
```

### Get Fleet with Members

```bash
curl -X GET http://localhost:3001/api/fleets/660e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

## Training Programs

### List Training Programs

```bash
curl -X GET "http://localhost:3001/api/training-programs?status=PUBLISHED" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Training Program Details

```bash
curl -X GET http://localhost:3001/api/training-programs/770e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

### Create Training Program

```bash
curl -X POST http://localhost:3001/api/training-programs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Advanced Safety Training",
    "description": "Comprehensive safety training for experienced drivers",
    "status": "DRAFT"
  }'
```

### Update Training Program

```bash
curl -X PUT http://localhost:3001/api/training-programs/770e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "PUBLISHED"
  }'
```

## Modules

### Create Module

```bash
curl -X POST http://localhost:3001/api/modules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "trainingProgramId": "770e8400-e29b-41d4-a716-446655440000",
    "title": "Module 1: Introduction",
    "description": "Introduction to safety procedures",
    "order": 1
  }'
```

### List Modules for Training Program

```bash
curl -X GET "http://localhost:3001/api/modules?trainingProgramId=770e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN"
```

## Lessons

### Create Lesson

```bash
curl -X POST http://localhost:3001/api/lessons \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "moduleId": "880e8400-e29b-41d4-a716-446655440000",
    "title": "Lesson 1: Safety Basics",
    "type": "VIDEO",
    "content": "https://video-storage.com/safety-basics.mp4",
    "duration": 15,
    "order": 1
  }'
```

### Get Lesson Details

```bash
curl -X GET http://localhost:3001/api/lessons/990e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

## Assignments

### Create Assignment

```bash
curl -X POST http://localhost:3001/api/assignments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "trainingProgramId": "770e8400-e29b-41d4-a716-446655440000",
    "dueDate": "2024-02-15T00:00:00Z"
  }'
```

### List User Assignments

```bash
curl -X GET "http://localhost:3001/api/assignments?userId=550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Assignment Progress

```bash
curl -X GET http://localhost:3001/api/assignments/aa0e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

### Update Assignment Status

```bash
curl -X PUT http://localhost:3001/api/assignments/aa0e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "COMPLETED"
  }'
```

## Quizzes

### Get Quiz for Lesson

```bash
curl -X GET http://localhost:3001/api/quizzes/990e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

### Submit Quiz Answers

```bash
curl -X POST http://localhost:3001/api/quizzes/990e8400-e29b-41d4-a716-446655440000/submit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [
      {
        "questionId": "bb0e8400-e29b-41d4-a716-446655440000",
        "answer": "65 mph"
      },
      {
        "questionId": "cc0e8400-e29b-41d4-a716-446655440000",
        "answer": "True"
      }
    ]
  }'
```

## Notifications

### Get User Notifications

```bash
curl -X GET "http://localhost:3001/api/notifications?read=false" \
  -H "Authorization: Bearer $TOKEN"
```

### Mark Notification as Read

```bash
curl -X PUT http://localhost:3001/api/notifications/dd0e8400-e29b-41d4-a716-446655440000/read \
  -H "Authorization: Bearer $TOKEN"
```

### Mark All Notifications as Read

```bash
curl -X PUT http://localhost:3001/api/notifications/read-all \
  -H "Authorization: Bearer $TOKEN"
```

## File Uploads

### Upload File

```bash
curl -X POST http://localhost:3001/api/uploads \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/document.pdf" \
  -F "type=TRAINING_MATERIAL"
```

### Get Upload Details

```bash
curl -X GET http://localhost:3001/api/uploads/ee0e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

### Delete Upload

```bash
curl -X DELETE http://localhost:3001/api/uploads/ee0e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

## Health Checks

### Basic Health Check

```bash
curl -X GET http://localhost:3001/health
```

### Readiness Check

```bash
curl -X GET http://localhost:3001/health/ready
```

### Liveness Check

```bash
curl -X GET http://localhost:3001/health/live
```

## Advanced Examples

### Pagination

```bash
# Get page 2 with 50 items per page
curl -X GET "http://localhost:3001/api/users?page=2&limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

### Filtering and Sorting

```bash
# Get drivers from specific fleet, sorted by creation date
curl -X GET "http://localhost:3001/api/users?role=DRIVER&fleetId=660e8400-e29b-41d4-a716-446655440000&sortBy=createdAt&order=desc" \
  -H "Authorization: Bearer $TOKEN"
```

### Search

```bash
# Search users by name or email
curl -X GET "http://localhost:3001/api/users?search=john" \
  -H "Authorization: Bearer $TOKEN"
```

## Error Handling

### Invalid Credentials

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "wrong@example.com",
    "password": "wrongpassword"
  }'
```

Response:
```json
{
  "error": "Invalid credentials"
}
```

### Unauthorized Access

```bash
curl -X GET http://localhost:3001/api/users \
  -H "Authorization: Bearer <access-token>"
```

Response:
```json
{
  "error": "Invalid token"
}
```

### Validation Error

```bash
curl -X POST http://localhost:3001/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "invalid-email",
    "password": "short"
  }'
```

Response:
```json
{
  "error": "Validation error",
  "details": {
    "email": "Invalid email format",
    "password": "Password must be at least 8 characters"
  }
}
```

### Rate Limit Exceeded

```bash
# After too many requests
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{...}'
```

Response:
```json
{
  "error": "Too many requests, please try again later"
}
```

Headers:
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1640000900
Retry-After: 900
```

## Batch Operations

### Create Multiple Assignments

```bash
curl -X POST http://localhost:3001/api/assignments/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assignments": [
      {
        "userId": "550e8400-e29b-41d4-a716-446655440000",
        "trainingProgramId": "770e8400-e29b-41d4-a716-446655440000",
        "dueDate": "2024-02-15T00:00:00Z"
      },
      {
        "userId": "551e8400-e29b-41d4-a716-446655440000",
        "trainingProgramId": "770e8400-e29b-41d4-a716-446655440000",
        "dueDate": "2024-02-15T00:00:00Z"
      }
    ]
  }'
```

## Testing with Scripts

### Bash Script Example

```bash
#!/bin/bash

# Login and store token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123456"
  }' | jq -r '.data.accessToken')

# Use token to get users
curl -X GET http://localhost:3001/api/users \
  -H "Authorization: Bearer $TOKEN" | jq .

# Create new user
curl -X POST http://localhost:3001/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "password123",
    "name": "New User",
    "role": "DRIVER"
  }' | jq .
```

### Python Script Example

```python
import requests

BASE_URL = "http://localhost:3001/api"

# Login
response = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "admin@example.com",
    "password": "admin123456"
})
token = response.json()["data"]["accessToken"]

# Set headers
headers = {"Authorization": f"Bearer {token}"}

# Get users
users = requests.get(f"{BASE_URL}/users", headers=headers)
print(users.json())

# Create user
new_user = requests.post(
    f"{BASE_URL}/users",
    headers=headers,
    json={
        "email": "newuser@example.com",
        "password": "password123",
        "name": "New User",
        "role": "DRIVER"
    }
)
print(new_user.json())
```

### JavaScript/Node.js Example

```javascript
const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function main() {
  // Login
  const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
    email: 'admin@example.com',
    password: 'admin123456'
  });
  
  const token = loginResponse.data.data.accessToken;
  
  // Set headers
  const headers = { Authorization: `Bearer ${token}` };
  
  // Get users
  const usersResponse = await axios.get(`${BASE_URL}/users`, { headers });
  console.log(usersResponse.data);
  
  // Create user
  const newUserResponse = await axios.post(
    `${BASE_URL}/users`,
    {
      email: 'newuser@example.com',
      password: 'password123',
      name: 'New User',
      role: 'DRIVER'
    },
    { headers }
  );
  console.log(newUserResponse.data);
}

main().catch(console.error);
```

## Postman Collection

Import the Postman collection for interactive testing:

1. Open Postman
2. Click "Import"
3. Select `docs/postman/DOT-Copilot-API.postman_collection.json`
4. Set environment variables:
   - `base_url`: http://localhost:3001/api
   - `access_token`: (will be set automatically after login)

## WebSocket Examples

### Connect to Real-time Updates

```javascript
const socket = io('http://localhost:3001', {
  auth: {
    token: accessToken
  }
});

// Listen for assignment updates
socket.on('assignment:updated', (data) => {
  console.log('Assignment updated:', data);
});

// Listen for notifications
socket.on('notification:new', (data) => {
  console.log('New notification:', data);
});
```

## GraphQL Examples (if enabled)

### Query Users

```graphql
query GetUsers {
  users(page: 1, limit: 20) {
    data {
      id
      email
      name
      role
      fleet {
        id
        name
      }
    }
    pagination {
      total
      totalPages
    }
  }
}
```

### Create Assignment

```graphql
mutation CreateAssignment {
  createAssignment(input: {
    userId: "550e8400-e29b-41d4-a716-446655440000"
    trainingProgramId: "770e8400-e29b-41d4-a716-446655440000"
    dueDate: "2024-02-15T00:00:00Z"
  }) {
    id
    status
    progress
  }
}
```
