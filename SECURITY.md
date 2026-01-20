# Security Policy

## Supported Versions

We currently support security updates for the latest stable version of Orchestrator AI.

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < Latest| :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: **golfergeek@orchestratorai.io**

### What to Include

When reporting a security vulnerability, please include:

- **Description**: A clear description of the vulnerability
- **Impact**: The potential impact if exploited
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Suggested Fix**: If you have a suggestion for how to fix it
- **Affected Versions**: Which versions are affected

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution**: Depends on severity and complexity

### Security Best Practices

Orchestrator AI is designed with security as a fundamental principle:

#### Inside-the-Firewall Deployment

- **Self-Hosted**: Designed for deployment within your infrastructure
- **Data Sovereignty**: All data stays within your control
- **No External Dependencies**: Optional cloud integration only when explicitly configured

#### PII Protection

- **Pseudonymization**: Built-in dictionary-based pseudonymization for PII
- **Pattern Detection**: Automatic detection and redaction of sensitive patterns
- **Reversible**: Pseudonyms restored in user-facing responses
- **Auditable**: All pseudonymization mappings tracked

#### Authentication & Authorization

- **JWT Authentication**: Secure token-based authentication
- **RBAC**: Role-based access control with fine-grained permissions
- **Organization Isolation**: Multi-tenant architecture with strict boundaries
- **Audit Logging**: All access tracked and logged

#### Local LLM Support

- **Ollama Integration**: Full support for local LLM execution
- **Self-Hosted RAG**: Complete RAG pipeline runs within your firewall
- **No Data Leakage**: Sensitive documents never leave your infrastructure

#### Configuration Security

- **No Hardcoded Defaults**: Explicit configuration required
- **No Silent Fallbacks**: Fail-fast with clear error messages
- **Environment Variables**: Sensitive data via environment variables only
- **Secrets Management**: Support for secure secrets management solutions

### Security Checklist for Deployment

Before deploying Orchestrator AI in production:

- [ ] Review and configure authentication settings
- [ ] Set up proper RBAC roles and permissions
- [ ] Configure PII dictionaries for your organization
- [ ] Set up local LLM infrastructure (Ollama recommended)
- [ ] Configure database with proper RLS policies
- [ ] Set up monitoring and observability
- [ ] Review and configure network security
- [ ] Set up backup and disaster recovery procedures
- [ ] Review security audit documentation
- [ ] Configure secrets management (if applicable)

### Known Security Considerations

#### Current Status

- **Security Audit**: Not yet completed (hardening is first priority)
- **Production Hardening**: In progress
- **Threat Modeling**: Planned

#### Areas Under Active Hardening

- Authentication and authorization boundaries
- Organization isolation and RLS correctness
- Data retention policies and audit logs
- Secrets management and key handling
- Error handling and failure modes

### Security Resources

- [Enterprise Hardening Assessment](docs/ENTERPRISE_HARDENING_ASSESSMENT.md)
- [Security Audit Summary](docs/security/SECURITY-AUDIT-SUMMARY.md)
- [Security Checklist](docs/security/SECURITY-CHECKLIST.md)
- [Hardening Documentation](docs/hardening/)

### Disclosure Policy

We follow responsible disclosure practices:

1. **Private Reporting**: Report vulnerabilities privately
2. **Confirmation**: We'll confirm receipt and assess the issue
3. **Fix Development**: We'll develop a fix
4. **Coordination**: We'll coordinate disclosure timing
5. **Public Disclosure**: After fix is available, we'll disclose publicly

### Security Updates

Security updates will be:

- Released as patches for supported versions
- Documented in [CHANGELOG.md](CHANGELOG.md)
- Announced via GitHub releases
- Prioritized over feature development

---

**For security concerns or questions, contact: golfergeek@orchestratorai.io**
