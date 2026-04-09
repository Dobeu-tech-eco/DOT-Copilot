# DOT-Copilot Monorepo

A comprehensive **Fleet Driver Training Management Platform** designed for transportation companies to manage driver training, compliance tracking, and regulatory adherence.

> [!IMPORTANT]
> **Architecture Update (April 2026)**: The root frontend (`/src`) is now the canonical UI for the platform. The "inner frontend" located in `cursor-projects/DOT-Copilot/frontend/` is **DEPRECATED** and will be removed in a future release.

---

## Repository Structure

```
DOT-Copilot/
├── src/                                # CANONICAL Frontend (React 19 + Vite 6)
├── cursor-projects/                    # Monorepo workspace
│   ├── DOT-Copilot/                   # Main training platform
│   │   ├── backend/                   # CANONICAL Backend (Express.js + Prisma 7)
│   │   ├── frontend/                  # DEPRECATED (Original React frontend)
│   │   ├── infrastructure/            # Bicep IaC templates
│   │   └── ...
│   └── ...
├── docker/                            # MCP Gateway & Shared Services
├── scripts/                           # Automation & Utility scripts
└── ...
```

---

## Quick Start (Development)

### 1. Start the Backend & Database
```bash
cd cursor-projects/DOT-Copilot
# Follow instructions in backend/README.md to start Postgres and the Express API
```

### 2. Start the Canonical Frontend
```bash
# From the repository root
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173` and is configured to proxy requests to the backend at `http://localhost:3001/api`.

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
