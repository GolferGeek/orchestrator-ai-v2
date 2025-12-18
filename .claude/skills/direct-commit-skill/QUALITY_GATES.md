# Quality Gates

Before committing, **ALWAYS** run these checks in order. All must pass before committing.

## Quality Gate Commands

### 1. Format Code
```bash
npm run format
```
- Formats all code according to project standards
- May modify files (uses Write tool)
- Must complete successfully

### 2. Lint Code
```bash
npm run lint
```
**CRITICAL: Must pass with no errors** - if lint fails, fix issues before committing.

### 3. Build
```bash
npm run build
```
**CRITICAL: Must pass** - if build fails, fix issues before committing.

## Quality Gate Workflow

```bash
# Step 1: Format code
npm run format

# Step 2: Lint code (must pass)
npm run lint

# Step 3: Build (must pass)
npm run build

# Step 4: Only commit if all gates pass
```

## Quality Gate Failures

### ❌ Format Failure
If format command fails or reports issues:
- Re-run `npm run format` until no changes
- Ensure all files are properly formatted

### ❌ Lint Failure
If lint reports errors:
- Fix lint errors manually
- Or run auto-fix: `npm run lint -- --fix` (if available)
- **DO NOT commit** until lint passes

### ❌ Build Failure
If build fails:
- Fix TypeScript compilation errors
- Fix import/export issues
- Fix type errors
- **DO NOT commit** until build succeeds

## Integration with quality-gates-skill

For detailed quality gate patterns and troubleshooting, see the `quality-gates-skill` which provides comprehensive quality gate documentation.

## Checklist

Before committing, verify:
- [ ] `npm run format` - Code formatted
- [ ] `npm run lint` - No lint errors
- [ ] `npm run build` - Build succeeds
- [ ] All quality gates pass

