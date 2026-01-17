# DOT-Copilot Monorepo

A comprehensive **Fleet Driver Training Management Platform** designed for transportation companies to manage driver training, compliance tracking, and regulatory adherence. Built with modern technologies and enterprise-grade architecture.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Projects](#projects)
- [Features](#features)
- [Roadmap](#roadmap)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

DOT-Copilot is a production-ready full-stack training management application, converted from Bubble.io to React + TypeScript + Express. It provides a complete solution for:

- **Driver Training**: Multi-format content delivery (video, PDF, SCORM, quizzes)
- **Compliance Tracking**: CDL, medical cards, HAZMAT endorsements, and more
- **Fleet Management**: Multi-tenant support with white-label capabilities
- **Regulatory Adherence**: FMCSA/DOT compliance with audit trails

### Target Users

| Role | Access Level |
|------|--------------|
| **Driver** | Mobile-first training experience, personal compliance dashboard |
| **Driver Coach** | Behind-the-wheel session management, trainee progress |
| **Supervisor** | Team management, assignment creation, reporting |
| **Branch Manager** | Location oversight, compliance reports |
| **Admin** | Full system control, fleet configuration, content management |

---

## Architecture

```mermaid
flowchart TB
    subgraph Client["Client Layer"]
        WEB[Web Application<br/>React + TypeScript]
        MOBILE[Mobile App<br/>Responsive PWA]
    end

    subgraph Gateway["API Gateway"]
        NGINX[Nginx Reverse Proxy<br/>Rate Limiting + SSL]
    end

    subgraph Services["Application Services"]
        API[Express.js API<br/>REST + JWT Auth]
        SWAGGER[Swagger UI<br/>API Documentation]
    end

    subgraph DataLayer["Data Layer"]
        PRISMA[Prisma ORM]
        PG[(PostgreSQL<br/>Primary Database)]
        REDIS[(Redis<br/>Caching + Sessions)]
    end

    subgraph Storage["File Storage"]
        S3[AWS S3 / Azure Blob<br/>Training Materials]
    end

    subgraph External["External Services"]
        SMTP[SMTP<br/>Email Notifications]
        FCM[Firebase Cloud Messaging<br/>Push Notifications]
        TWILIO[Twilio<br/>SMS Notifications]
        SENTRY[Sentry<br/>Error Tracking]
        APPINS[Azure App Insights<br/>Monitoring]
    end

    subgraph Integrations["Telematics Integrations"]
        SAMSARA[Samsara API]
        MOTIVE[Motive API]
        WEBHOOKS[Webhook System<br/>19 Event Types]
    end

    WEB --> NGINX
    MOBILE --> NGINX
    NGINX --> API
    API --> SWAGGER
    API --> PRISMA
    PRISMA --> PG
    API --> REDIS
    API --> S3
    API --> SMTP
    API --> FCM
    API --> TWILIO
    API --> SENTRY
    API --> APPINS
    SAMSARA --> WEBHOOKS
    MOTIVE --> WEBHOOKS
    WEBHOOKS --> API

    style Client fill:#e1f5fe
    style Gateway fill:#fff3e0
    style Services fill:#e8f5e9
    style DataLayer fill:#fce4ec
    style Storage fill:#f3e5f5
    style External fill:#fff8e1
    style Integrations fill:#e0f2f1
```

### Deployment Architecture

```mermaid
flowchart LR
    subgraph Development["Development Environment"]
        DEV_COMPOSE[Docker Compose<br/>Local Development]
        DEV_PG[(PostgreSQL)]
        DEV_COMPOSE --> DEV_PG
    end

    subgraph CI["CI/CD Pipeline"]
        GH[GitHub Actions]
        TRIVY[Trivy Scanner]
        TESTS[Test Suite]
        BUILD[Docker Build]
        GH --> TRIVY
        GH --> TESTS
        TESTS --> BUILD
    end

    subgraph Production["Azure Production"]
        STATIC[Azure Static Web Apps<br/>Frontend CDN]
        APP[Azure App Service<br/>Backend API]
        FLEX[(Azure PostgreSQL<br/>Flexible Server)]
        INSIGHTS[Application Insights]
        LOGS[Log Analytics]
        APP --> FLEX
        APP --> INSIGHTS
        APP --> LOGS
    end

    DEV_COMPOSE --> GH
    BUILD --> STATIC
    BUILD --> APP

    style Development fill:#e3f2fd
    style CI fill:#fff3e0
    style Production fill:#e8f5e9
```

---

## Repository Structure

```
DOT-Copilot/
├── cursor-projects/                    # Monorepo workspace
│   ├── DOT-Copilot/                   # Main training platform
│   │   ├── frontend/                  # React 19 + TypeScript + Vite
│   │   │   ├── src/
│   │   │   │   ├── components/        # Reusable UI components
│   │   │   │   ├── pages/             # Page components
│   │   │   │   ├── hooks/             # Custom React hooks
│   │   │   │   ├── services/          # API client layer
│   │   │   │   ├── store/             # Zustand state management
│   │   │   │   ├── types/             # TypeScript interfaces
│   │   │   │   └── __tests__/         # Vitest test suites
│   │   │   ├── Dockerfile             # Multi-stage production build
│   │   │   └── nginx.conf             # Nginx configuration
│   │   │
│   │   ├── backend/                   # Express.js + TypeScript API
│   │   │   ├── src/
│   │   │   │   ├── routes/            # 20+ API route handlers
│   │   │   │   ├── middleware/        # Auth, logging, rate limiting
│   │   │   │   ├── services/          # Business logic layer
│   │   │   │   ├── schemas/           # Zod validation schemas
│   │   │   │   ├── utils/             # JWT, password, helpers
│   │   │   │   └── config/            # Environment configuration
│   │   │   ├── prisma/
│   │   │   │   ├── schema.prisma      # 25+ database models
│   │   │   │   └── seed.ts            # Database seeder
│   │   │   ├── __tests__/             # Jest test suites
│   │   │   └── Dockerfile             # Multi-stage production build
│   │   │
│   │   ├── docs/                      # Project documentation
│   │   │   └── adr/                   # Architecture Decision Records
│   │   │
│   │   ├── infrastructure/
│   │   │   ├── azure/                 # Bicep IaC templates
│   │   │   └── k8s/                   # Kubernetes manifests
│   │   │
│   │   ├── .github/workflows/         # CI/CD pipelines
│   │   ├── docker-compose.yml         # Production configuration
│   │   └── docker-compose.dev.yml     # Development configuration
│   │
│   ├── dobeuinfo/                     # Software reviews platform
│   ├── accident-app/                  # Accident reporting app
│   └── digital-wharf-dynamics/        # Additional project
│
├── docker/                            # Shared Docker configurations
│   ├── api/                           # API gateway
│   └── mcp-gateway/                   # MCP gateway service
│
├── workspaces/                        # Development workspaces
├── scripts/                           # Utility scripts
│
├── INFRASTRUCTURE_ARCHITECTURE.md     # System diagrams
├── IAC_SECURITY_AUDIT.md             # Security audit findings
├── IMPLEMENTATION_SUMMARY.md          # Implementation checklist
├── OPERATIONAL_HANDBOOK.md            # Operations guide
└── DISASTER_RECOVERY.md               # DR procedures
```

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.x | UI Framework |
| TypeScript | 5.9 | Type Safety |
| Vite | 6.x | Build Tool |
| React Router | 7.x | Routing |
| Zustand | 5.x | State Management |
| Axios | 1.x | HTTP Client |
| Vitest | 4.x | Testing |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20+ | Runtime |
| Express.js | 4.21 | Web Framework |
| TypeScript | 5.7 | Type Safety |
| Prisma | 7.x | ORM |
| PostgreSQL | 16+ | Database |
| Zod | 4.x | Validation |
| Winston | 3.x | Logging |
| Jest | 30.x | Testing |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| Docker | Containerization |
| Azure App Service | Backend Hosting |
| Azure Static Web Apps | Frontend CDN |
| Azure PostgreSQL | Managed Database |
| Azure Application Insights | Monitoring |
| GitHub Actions | CI/CD |

### Security
| Technology | Purpose |
|------------|---------|
| JWT | Authentication |
| bcrypt | Password Hashing |
| Helmet.js | Security Headers |
| express-rate-limit | Rate Limiting |
| Sentry | Error Tracking |
| Trivy | Container Scanning |

---

## Getting Started

### Prerequisites

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **Docker** & Docker Compose ([Download](https://www.docker.com/))
- **Git** ([Download](https://git-scm.com/))

### Quick Start (Docker - Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/dobeutech/DOT-Copilot.git
cd DOT-Copilot/cursor-projects/DOT-Copilot

# 2. Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Start all services
docker compose -f docker-compose.dev.yml up -d

# 4. Run database migrations
docker compose exec backend npx prisma migrate dev

# 5. Seed the database
docker compose exec backend npx prisma db seed

# 6. Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:3001
# API Docs: http://localhost:3001/api-docs
```

### Local Development (Manual Setup)

```bash
# 1. Start PostgreSQL
docker run -d \
  --name dot-copilot-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=dot_copilot \
  -p 5432:5432 \
  postgres:16-alpine

# 2. Install backend dependencies
cd cursor-projects/DOT-Copilot/backend
npm install

# 3. Configure environment
cat > .env << 'EOF'
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dot_copilot?schema=public"
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters
JWT_REFRESH_SECRET=your-super-secret-refresh-key-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
EOF

# 4. Run migrations and seed
npx prisma migrate dev
npx prisma db seed

# 5. Start backend
npm run dev

# 6. In another terminal, start frontend
cd ../frontend
npm install
echo 'VITE_API_BASE_URL=http://localhost:3001/api' > .env
npm run dev
```

### Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@example.com | admin123456 |
| Supervisor | supervisor@example.com | supervisor123 |
| Driver | driver@example.com | driver123456 |

### Verify Installation

```bash
# Check backend health
curl http://localhost:3001/health

# Check database connection
curl http://localhost:3001/health/ready

# Test authentication
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123456"}'
```

---

## Projects

### DOT-Copilot (Primary)
The main fleet driver training platform with full feature set.

### dobeuinfo
Software reviews and information platform.

### accident-app
Accident reporting and documentation application.

### digital-wharf-dynamics
Logistics and dynamics modeling project.

---

## Features

### Core Training
- Multi-format content: Video, PDF, PowerPoint, SCORM, Text
- Quiz system with automatic scoring and explanations
- E-signature capture for training completion
- Progress tracking with video position memory
- Multilingual support (English, Spanish, Haitian Creole)

### Compliance Management
- CDL tracking with endorsements and restrictions
- Medical card and HAZMAT certification monitoring
- Document expiration alerts (90, 60, 30, 14, 7 days)
- Compliance status dashboard
- Certificate generation for completed trainings

### User Management
- Role-based access control (5 levels)
- JWT authentication with refresh tokens
- Password reset via email
- User preferences (language, timezone, notifications)

### Notifications
- Multi-channel: In-app, Email, SMS, Push
- Configurable notification preferences
- Automated reminder system
- Webhook integrations (19 event types)

### Behind-the-Wheel (BTW)
- Trainer-trainee session management
- Skills checklist with evaluation
- Digital signature capture
- Session history and reporting

### Integrations
- Samsara telematics integration
- Motive telematics integration
- Make.com / Zapier webhook compatibility
- Training triggers based on telematics events

### Administration
- Fleet management (multi-tenant)
- White-label branding (colors, logo)
- Training content builder
- Scheduled report generation
- Audit logging for compliance

---

## Roadmap

### Phase 1: Foundation (Completed)
- [x] Core authentication system
- [x] User management with RBAC
- [x] Basic training program structure
- [x] Quiz and completion tracking
- [x] PostgreSQL database schema
- [x] Docker containerization

### Phase 2: Enhanced Features (Completed)
- [x] Multi-format content support (Video, PDF, SCORM)
- [x] Compliance requirement tracking
- [x] Document management (CDL, medical cards)
- [x] Notification system (Email, SMS, Push)
- [x] Webhook system for integrations
- [x] Behind-the-wheel session tracking

### Phase 3: Infrastructure (Completed)
- [x] Azure deployment infrastructure (Bicep IaC)
- [x] CI/CD pipelines (GitHub Actions)
- [x] Security hardening (20 issues resolved)
- [x] Centralized logging architecture
- [x] Cost management and optimization
- [x] Disaster recovery documentation

### Phase 4: Advanced Capabilities (In Progress)
- [ ] Mobile app (React Native or PWA enhancement)
- [ ] Offline mode for training content
- [ ] Advanced analytics dashboard
- [ ] AI-powered training recommendations
- [ ] Video analytics (engagement, completion hotspots)
- [ ] SCORM 2004 full compliance

### Phase 5: Enterprise Features (Planned)
- [ ] SSO integration (SAML/OIDC)
- [ ] Multi-region deployment
- [ ] Advanced reporting (custom report builder)
- [ ] API rate limiting per customer
- [ ] Tenant isolation enhancements
- [ ] Compliance audit exports

### Phase 6: Scale & Performance (Future)
- [ ] Read replicas for high-traffic
- [ ] CDN for global content delivery
- [ ] Microservices architecture migration
- [ ] Event sourcing for audit trails
- [ ] Real-time collaboration features

---

## Documentation

| Document | Description |
|----------|-------------|
| [INFRASTRUCTURE_ARCHITECTURE.md](./INFRASTRUCTURE_ARCHITECTURE.md) | System architecture diagrams |
| [IAC_SECURITY_AUDIT.md](./IAC_SECURITY_AUDIT.md) | Security audit findings and remediations |
| [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) | Implementation checklist and progress |
| [OPERATIONAL_HANDBOOK.md](./OPERATIONAL_HANDBOOK.md) | Operations and maintenance guide |
| [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) | Disaster recovery procedures |
| [cursor-projects/DOT-Copilot/README.md](./cursor-projects/DOT-Copilot/README.md) | Detailed project documentation |

### Architecture Decision Records (ADRs)

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-0001](./cursor-projects/DOT-Copilot/docs/adr/0001-infrastructure-security-implementation.md) | Infrastructure Security Implementation | Accepted |
| [ADR-0002](./cursor-projects/DOT-Copilot/docs/adr/0002-docker-build-optimization.md) | Docker Build Optimization | Accepted |
| [ADR-0003](./cursor-projects/DOT-Copilot/docs/adr/0003-centralized-logging-architecture.md) | Centralized Logging Architecture | Accepted |
| [ADR-0004](./cursor-projects/DOT-Copilot/docs/adr/0004-azure-cost-management-strategy.md) | Azure Cost Management Strategy | Accepted |

---

## Contributing

### Development Workflow

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** changes (`git commit -m 'feat: add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

Types: feat, fix, docs, style, refactor, test, chore
```

### Code Quality

```bash
# Run linting
npm run lint

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions

---

## License

ISC License - See [LICENSE](./LICENSE) for details.

---

## Support

- **Issues**: [GitHub Issues](https://github.com/dobeutech/DOT-Copilot/issues)
- **Discussions**: [GitHub Discussions](https://github.com/dobeutech/DOT-Copilot/discussions)

---

Built with care by the DOT-Copilot team.
