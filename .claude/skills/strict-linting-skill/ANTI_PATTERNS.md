# Anti-Patterns Reference

Comprehensive reference of linting anti-patterns and their proper fixes.

## Underscore Variables

### Pattern
Variables or parameters prefixed with `_` to silence "unused" warnings.

### Examples

**❌ BAD:**
```typescript
// Unused parameter
function handler(data: Data, _event: Event) {
  return process(data);
}

// Unused variable
const _result = expensiveOperation();
doSomething();

// Unused in destructuring
const { value, _unused } = getData();
```

**✅ GOOD:**
```typescript
// Remove unused parameter
function handler(data: Data) {
  return process(data);
}

// Remove unused variable
doSomething();

// Remove unused from destructuring
const { value } = getData();
```

### Detection
- Search for: `^_[a-zA-Z]` pattern in variable/parameter names
- Check if variable is actually unused
- Verify removal is safe

### Fix
- Remove the unused code
- If parameter required by interface, document why it's unused
- Never use `_` prefix as workaround

## Unused Imports

### Pattern
Imports that are never used in the file.

### Examples

**❌ BAD:**
```typescript
import { ServiceA, ServiceB, UnusedService } from './services';
import { helper } from './utils'; // Never used
```

**✅ GOOD:**
```typescript
import { ServiceA, ServiceB } from './services';
// Removed unused imports
```

### Detection
- ESLint reports unused imports
- Check import statements
- Verify imports are actually used

### Fix
- Remove unused imports
- Use IDE "organize imports" feature
- Don't leave "for later" imports

## Unused Exports

### Pattern
Exported functions, classes, or constants that are never imported elsewhere.

### Examples

**❌ BAD:**
```typescript
// Exported but never used
export function unusedHelper() {
  return true;
}

export const UNUSED_CONSTANT = 'value';
```

**✅ GOOD:**
```typescript
// Remove if truly unused
// OR document if it's a public API
/**
 * Public API for external consumers
 * @public
 */
export function publicHelper() {
  return true;
}
```

### Detection
- Search for `export` statements
- Check if exported items are imported elsewhere
- Distinguish between public API and internal code

### Fix
- Remove if truly unused
- Keep if it's a public API (document it)
- Don't export "just in case"

## Type Suppressions

### Pattern
Using `@ts-ignore`, `@ts-expect-error`, or `eslint-disable` without proper justification.

### Examples

**❌ BAD:**
```typescript
// @ts-ignore
const result = unsafeOperation();

// eslint-disable-next-line
const value = problematicCode();

// @ts-expect-error - No reason given
const data = legacyCall();
```

**✅ GOOD:**
```typescript
// Fix the type issue
const result: SafeType = safeOperation();

// Fix the lint issue
const value = fixedCode();

// @ts-expect-error - Legacy API returns incorrect type, will be refactored in Q2
// See: https://github.com/org/repo/issues/123
const data = legacyCall();
```

### Detection
- Search for suppression comments
- Check if suppression has justification
- Verify if issue can be fixed properly

### Fix
- Fix the underlying issue when possible
- Document why suppression is necessary
- Include issue/ticket reference
- Set timeline for proper fix

## Empty Catch Blocks

### Pattern
Catch blocks that silently swallow errors.

### Examples

**❌ BAD:**
```typescript
try {
  riskyOperation();
} catch (_error) {
  // Ignore
}

try {
  operation();
} catch {
  // Silent failure
}
```

**✅ GOOD:**
```typescript
try {
  riskyOperation();
} catch (error) {
  logger.warn('Operation failed, continuing', error);
  // Handle appropriately
}

try {
  operation();
} catch (error) {
  // Log and handle
  logger.error('Operation failed', error);
  throw new OperationError('Failed to perform operation', error);
}
```

### Detection
- Search for empty catch blocks
- Check for catch blocks with only comments
- Verify error handling

### Fix
- Log errors appropriately
- Handle errors meaningfully
- Don't silently swallow exceptions
- Re-throw if appropriate

## Any Types

### Pattern
Excessive use of `any` type instead of proper typing.

### Examples

**❌ BAD:**
```typescript
function process(data: any): any {
  return data.value;
}

const result: any = getData();
```

**✅ GOOD:**
```typescript
interface Data {
  value: string;
}

function process(data: Data): string {
  return data.value;
}

const result: Data = getData();
```

### Detection
- Search for `: any` type annotations
- Check if proper types can be used
- Verify if `any` is truly necessary

### Fix
- Define proper interfaces/types
- Use type guards
- Document why `any` is necessary if used
- Use `unknown` if type is truly unknown

## Unused Variables

### Pattern
Variables declared but never used.

### Examples

**❌ BAD:**
```typescript
const unused = getValue();
doSomething();

let result;
result = compute();
// result never used
```

**✅ GOOD:**
```typescript
doSomething();

// Remove unused variable
const result = compute();
useResult(result);
```

### Detection
- ESLint reports unused variables
- Check variable declarations
- Verify variables are actually used

### Fix
- Remove unused variables
- Use variables if they should be used
- Don't prefix with `_` to silence

## Detection Commands

### Find Underscore Variables
```bash
# Find underscore-prefixed variables
grep -r "^\s*const _[a-zA-Z]" apps/
grep -r "^\s*let _[a-zA-Z]" apps/
grep -r "function.*_[a-zA-Z]" apps/
```

### Find Suppressions
```bash
# Find TypeScript suppressions
grep -r "@ts-ignore\|@ts-expect-error" apps/

# Find ESLint suppressions
grep -r "eslint-disable" apps/
```

### Find Empty Catch Blocks
```bash
# Find empty catch blocks
grep -A 3 "catch" apps/ | grep -B 1 -A 1 "^\s*}\s*$"
```

## Fix Priority

1. **Remove unused code** (highest priority)
2. **Fix type issues** (use proper types)
3. **Handle errors properly** (log and handle)
4. **Document exceptions** (if suppression truly necessary)

