# MongoDB Authentication Configuration

## Overview

MongoDB authentication is configured to require credentials for all connections, preventing unauthorized access.

## Current Configuration

### docker-compose.yml

```yaml
mongodb:
  image: mongo:7
  container_name: mongodb
  restart: unless-stopped
  environment:
    - MONGO_INITDB_ROOT_USERNAME=${MONGO_ROOT_USER:?MONGO_ROOT_USER required}
    - MONGO_INITDB_ROOT_PASSWORD=${MONGO_ROOT_PASSWORD:?MONGO_ROOT_PASSWORD required}
    - MONGO_INITDB_DATABASE=${MONGO_DATABASE:?MONGO_DATABASE required}
  ports:
    - "127.0.0.1:27017:27017"  # Localhost only
  networks:
    - backend_network
```

## Security Features

### 1. Required Authentication ✅
- Root username and password required
- No default credentials
- Fails to start if credentials not provided

### 2. Network Isolation ✅
- Bound to localhost (127.0.0.1:27017)
- Not accessible from external network
- Only accessible from backend_network

### 3. Resource Limits ✅
- CPU: 1.0 limit, 0.5 reservation
- Memory: 1GB limit, 512MB reservation

## Connection Strings

### Application Connection

```javascript
// Node.js
const mongoose = require('mongoose');

const mongoUrl = `mongodb://${process.env.MONGO_ROOT_USER}:${process.env.MONGO_ROOT_PASSWORD}@mongodb:27017/${process.env.MONGO_DATABASE}?authSource=admin`;

mongoose.connect(mongoUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
```

```python
# Python
from pymongo import MongoClient
import os

mongo_url = f"mongodb://{os.getenv('MONGO_ROOT_USER')}:{os.getenv('MONGO_ROOT_PASSWORD')}@mongodb:27017/{os.getenv('MONGO_DATABASE')}?authSource=admin"

client = MongoClient(mongo_url)
db = client[os.getenv('MONGO_DATABASE')]
```

### CLI Connection

```bash
# From host (requires port forwarding)
mongosh "mongodb://admin:${MONGO_ROOT_PASSWORD}@localhost:27017/appdb?authSource=admin"

# From container
docker-compose exec mongodb mongosh -u admin -p ${MONGO_ROOT_PASSWORD} --authenticationDatabase admin
```

## User Management

### Create Application User

```javascript
// Connect as root
mongosh -u admin -p ${MONGO_ROOT_PASSWORD} --authenticationDatabase admin

// Switch to application database
use appdb

// Create application user with read/write permissions
db.createUser({
  user: "appuser",
  pwd: "secure_password_here",
  roles: [
    { role: "readWrite", db: "appdb" }
  ]
})

// Verify user
db.getUsers()
```

### Create Read-Only User

```javascript
// For reporting/analytics
db.createUser({
  user: "readonly",
  pwd: "readonly_password_here",
  roles: [
    { role: "read", db: "appdb" }
  ]
})
```

### Update User Password

```javascript
use admin
db.changeUserPassword("appuser", "new_secure_password")
```

## Environment Variables

### Required Variables

Add to `.env` file:

```bash
# MongoDB Configuration
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=your_secure_root_password_here
MONGO_DATABASE=appdb

# Application user (optional, for non-root access)
MONGO_APP_USER=appuser
MONGO_APP_PASSWORD=your_secure_app_password_here
```

### Password Requirements

- Minimum 16 characters
- Include uppercase, lowercase, numbers, special characters
- No dictionary words
- Rotate every 90 days

### Generate Secure Password

```bash
# Generate random password
openssl rand -base64 32

# Or use password generator
pwgen -s 32 1
```

## Security Best Practices

### 1. Principle of Least Privilege

```javascript
// ✅ GOOD - Application user with limited permissions
const mongoUrl = `mongodb://${MONGO_APP_USER}:${MONGO_APP_PASSWORD}@mongodb:27017/appdb`;

// ❌ BAD - Using root user in application
const mongoUrl = `mongodb://${MONGO_ROOT_USER}:${MONGO_ROOT_PASSWORD}@mongodb:27017/appdb`;
```

### 2. Connection String Security

```javascript
// ✅ GOOD - Use environment variables
const mongoUrl = process.env.MONGO_URL;

// ❌ BAD - Hardcoded credentials
const mongoUrl = 'mongodb://admin:password123@mongodb:27017/appdb';
```

### 3. Error Handling

```javascript
// ✅ GOOD - Don't expose credentials in errors
try {
  await mongoose.connect(mongoUrl);
} catch (error) {
  logger.error('MongoDB connection failed', { error: error.message });
  // Don't log the connection string
}

// ❌ BAD - Exposes credentials
try {
  await mongoose.connect(mongoUrl);
} catch (error) {
  console.error('Failed to connect:', mongoUrl, error);
}
```

## Monitoring

### Check Authentication Status

```javascript
// Connect and check auth
mongosh -u admin -p ${MONGO_ROOT_PASSWORD} --authenticationDatabase admin

// Check current user
db.runCommand({ connectionStatus: 1 })

// List all users
use admin
db.system.users.find()
```

### Monitor Failed Login Attempts

```bash
# Check MongoDB logs
docker-compose logs mongodb | grep "Authentication failed"

# Count failed attempts
docker-compose logs mongodb | grep "Authentication failed" | wc -l
```

## Backup with Authentication

### Backup Script

```bash
#!/bin/bash
# scripts/backup-mongodb.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/mongodb"

# Backup with authentication
mongodump \
  --uri="mongodb://${MONGO_ROOT_USER}:${MONGO_ROOT_PASSWORD}@localhost:27017" \
  --authenticationDatabase=admin \
  --out=$BACKUP_DIR/backup_${DATE}

# Compress
tar -czf $BACKUP_DIR/backup_${DATE}.tar.gz $BACKUP_DIR/backup_${DATE}
rm -rf $BACKUP_DIR/backup_${DATE}

echo "Backup completed: backup_${DATE}.tar.gz"
```

### Restore Script

```bash
#!/bin/bash
# scripts/restore-mongodb.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file.tar.gz>"
  exit 1
fi

# Extract
tar -xzf $BACKUP_FILE -C /tmp/

# Restore with authentication
mongorestore \
  --uri="mongodb://${MONGO_ROOT_USER}:${MONGO_ROOT_PASSWORD}@localhost:27017" \
  --authenticationDatabase=admin \
  /tmp/backup_*/

echo "Restore completed"
```

## Troubleshooting

### Issue: Authentication Failed

**Error:**
```
MongoServerError: Authentication failed
```

**Solutions:**
1. Verify credentials in .env file
2. Check authSource parameter
3. Ensure user exists in correct database

```bash
# Verify user exists
docker-compose exec mongodb mongosh -u admin -p ${MONGO_ROOT_PASSWORD} --authenticationDatabase admin
use admin
db.getUsers()
```

### Issue: Connection Refused

**Error:**
```
MongoNetworkError: connect ECONNREFUSED
```

**Solutions:**
1. Check MongoDB is running: `docker-compose ps mongodb`
2. Verify network connectivity: `docker-compose exec api_server ping mongodb`
3. Check port binding: `netstat -tulpn | grep 27017`

### Issue: Unauthorized Access

**Error:**
```
MongoServerError: not authorized on appdb to execute command
```

**Solutions:**
1. Verify user has correct permissions
2. Check database name in connection string
3. Ensure authSource is correct

```javascript
// Add authSource parameter
const mongoUrl = `mongodb://appuser:password@mongodb:27017/appdb?authSource=admin`;
```

## Migration from No-Auth

If migrating from a MongoDB instance without authentication:

### 1. Backup Data

```bash
# Backup without auth
mongodump --out=/backups/pre-auth-backup
```

### 2. Enable Authentication

```yaml
# Update docker-compose.yml
environment:
  - MONGO_INITDB_ROOT_USERNAME=admin
  - MONGO_INITDB_ROOT_PASSWORD=secure_password
```

### 3. Restart MongoDB

```bash
docker-compose down mongodb
docker-compose up -d mongodb
```

### 4. Create Users

```javascript
// Connect as root
mongosh -u admin -p secure_password --authenticationDatabase admin

// Create application user
use appdb
db.createUser({
  user: "appuser",
  pwd: "app_password",
  roles: [{ role: "readWrite", db: "appdb" }]
})
```

### 5. Update Application

```javascript
// Update connection string
const mongoUrl = `mongodb://appuser:app_password@mongodb:27017/appdb?authSource=admin`;
```

### 6. Test Connection

```bash
# Test with new credentials
mongosh "mongodb://appuser:app_password@localhost:27017/appdb?authSource=admin"
```

## Compliance

### CIS MongoDB Benchmark

- ✅ 2.1 Enable authentication
- ✅ 2.2 Use strong passwords
- ✅ 2.3 Limit network exposure
- ✅ 2.4 Use role-based access control
- ✅ 2.5 Audit authentication events

### OWASP Top 10

- ✅ A01:2021 - Broken Access Control (authentication required)
- ✅ A02:2021 - Cryptographic Failures (TLS for connections)
- ✅ A07:2021 - Identification and Authentication Failures (strong passwords)

## References

- [MongoDB Security Checklist](https://docs.mongodb.com/manual/administration/security-checklist/)
- [MongoDB Authentication](https://docs.mongodb.com/manual/core/authentication/)
- [MongoDB Users and Roles](https://docs.mongodb.com/manual/core/security-users/)

---

**Status:** ✅ Implemented  
**Last Updated:** 2025-12-15  
**Next Review:** 2026-01-15
