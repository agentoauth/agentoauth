# Contributing to AgentOAuth

Thank you for your interest in contributing to AgentOAuth! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/agentoauth.git`
3. Install dependencies: `pnpm install`
4. Create a feature branch: `git checkout -b feature/your-feature-name`

## Development Setup

This project uses pnpm workspaces. Make sure you have:

- Node.js 18+ 
- pnpm 8+

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/agentoauth.git
cd agentoauth

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Running Tests

```bash
# Run all tests across all packages
pnpm test

# Run tests in watch mode (for development)
cd packages/sdk-js && pnpm test:watch

# Run tests for a specific package
cd packages/sdk-js && pnpm test

# Run with coverage
cd packages/sdk-js && pnpm test --coverage
```

### Development Workflow

```bash
# Start the verifier API (terminal 1)
cd packages/verifier-api
pnpm dev

# Start the playground (terminal 2)
cd packages/playground
pnpm dev

# Make changes to SDK
cd packages/sdk-js
pnpm dev  # Watches and rebuilds on changes
```

### Building

```bash
# Build all packages
pnpm build

# Build specific package
cd packages/sdk-js && pnpm build

# Clean and rebuild
pnpm -r run clean  # if clean script exists
pnpm build
```

### Linting

```bash
# Lint all packages
pnpm lint

# Lint specific package
cd packages/sdk-js && pnpm lint

# Auto-fix linting issues
cd packages/sdk-js && pnpm lint --fix
```

### Running the Full Suite

Before submitting a PR, run the complete test suite:

```bash
# From project root
pnpm install
pnpm -r build
pnpm -r lint
pnpm -r test
```

All commands should pass without errors.

## Code Style

- Use TypeScript for new code in SDK and API packages
- Follow existing code formatting (2 spaces, semicolons, etc.)
- Add JSDoc comments for public APIs
- Write tests for new features

## Pull Request Process

### Before Submitting

1. **Run the full test suite**:
   ```bash
   pnpm install && pnpm -r build && pnpm -r test
   ```
   All commands must pass.

2. **Update documentation**:
   - Update README.md if adding features
   - Update SPEC.md if changing protocol
   - Update package README if changing API
   - Add JSDoc comments to new functions

3. **Add tests**:
   - Write unit tests for new features
   - Ensure test coverage doesn't decrease
   - Add integration tests if appropriate

4. **Check your code**:
   ```bash
   pnpm lint  # Fix any linting errors
   pnpm test  # All tests must pass
   ```

### Submitting the PR

1. **Branch naming**:
   - Feature: `feat/your-feature-name`
   - Bug fix: `fix/issue-description`
   - Docs: `docs/what-you-changed`

2. **Commit messages** (follow conventional commits):
   ```
   feat(sdk-js): add ES256K algorithm support
   fix(verifier-api): handle missing audience field
   docs(spec): clarify nonce requirements
   test(sdk-js): add replay attack test
   ```

3. **PR description should include**:
   - What changed and why
   - How to test the changes
   - Screenshots (if UI changes)
   - Related issues (e.g., "Fixes #123")

4. **PR checklist**:
   - [ ] Tests added and passing
   - [ ] Documentation updated
   - [ ] Linting passes
   - [ ] No breaking changes (or clearly documented)
   - [ ] Changelog updated (if applicable)

### Review Process

1. Maintainers will review your PR
2. Address any feedback or requested changes
3. Once approved, maintainers will merge
4. Your contribution will be credited in release notes

### Common Checks

The CI will automatically run:
- Install dependencies
- Lint all packages
- Run all tests
- Build all packages
- Type checking (TypeScript)

Make sure these all pass locally before pushing.

## Commit Messages

Follow conventional commits format:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Test additions or changes
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks

Example: `feat(sdk-js): add ES256K algorithm support`

## Reporting Issues

- Use the GitHub issue tracker
- Include clear reproduction steps for bugs
- Provide context about your use case for feature requests

## Specification Changes

Changes to the protocol specification require:

1. Discussion in an issue before implementation
2. Updates to `packages/spec/SPEC.md`
3. Updates to JSON schema if payload changes
4. Example files demonstrating the change

## Code of Conduct

- Be respectful and constructive
- Welcome newcomers and help them learn
- Focus on what's best for the project and community

## License

By contributing, you agree that your contributions will be licensed under the same dual MIT/Apache 2.0 license as the project.

## Questions?

Open an issue with the "question" label or reach out to maintainers.

Thank you for contributing!

