# Contributing to Orchestrator AI

Thank you for your interest in contributing to Orchestrator AI! This document
provides guidelines and information for contributors.

## License

This project is licensed under the [Polyform Noncommercial License 1.0.0](LICENSE).
By contributing, you agree that your contributions will be licensed under the
same terms, with additional rights granted to the project maintainer as
described in our CLA.

## Contributor License Agreement (CLA)

Before we can accept your contribution, you must agree to our
[Contributor License Agreement](CLA.md).

### Why a CLA?

The CLA grants the project maintainer the right to:
- Relicense the project in the future (e.g., to a more permissive license)
- Offer commercial licenses to organizations that need them
- Ensure the long-term sustainability of the project

This is a common practice for projects that may need licensing flexibility
in the future.

### How to Sign the CLA

When submitting a pull request, include the following in your PR description:

```
I have read the Contributor License Agreement and I agree to its terms.

Signed-off-by: Your Name <your.email@example.com>
```

Or use `git commit -s` to add a Signed-off-by line to your commits.

## Getting Started

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting (`npm run test && npm run lint`)
5. Commit your changes with sign-off (`git commit -s -m 'Add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/orchestrator-ai-v2.git
cd orchestrator-ai-v2

# Install dependencies
npm install

# Start local Supabase
npx supabase start

# Start development servers
npm run dev
```

## Code Style

- We use ESLint and Prettier for code formatting
- Run `npm run lint` before committing
- Run `npm run format` to auto-fix formatting issues
- Follow existing patterns in the codebase

## Pull Request Guidelines

1. **Keep PRs focused** - One feature or fix per PR
2. **Write clear commit messages** - Describe what and why
3. **Include tests** - For new features and bug fixes
4. **Update documentation** - If your change affects usage
5. **Sign the CLA** - Required for all contributions

## Reporting Issues

- Use GitHub Issues for bug reports and feature requests
- Search existing issues before creating a new one
- Provide as much detail as possible (steps to reproduce, expected vs actual behavior)

## Questions?

- For general questions: Open a GitHub Discussion
- For CLA questions: golfergeek@orchestratorai.io
- For licensing inquiries: golfergeek@orchestratorai.io

---

Thank you for contributing to Orchestrator AI!
