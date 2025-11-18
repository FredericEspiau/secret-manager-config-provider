# Effect.js Patterns and Conventions Research

## Project Overview
- **Name**: @inato/secret-manager-config-provider
- **Type**: Effect.js TypeScript package
- **Purpose**: Provides a GCP Secret Manager ConfigProvider for Effect applications
- **Effect Version**: ^3.18.0 (peer dependency)
- **Structure**: Minimal monorepo template with src/ and test/ directories

## Current File Structure
```
/src
  ├── GcpSecretManagerConfigProvider.ts (main service file)
  └── index.ts (barrel export)
/test
  └── GcpSecretManagerConfigProvider.test.ts
```

## 1. EFFECT.SERVICE AND CONTEXT USAGE PATTERNS

### Context.Reference Pattern
The project uses `Context.Reference` to define service dependencies:

```typescript
export class SecretMap extends Context.Reference<SecretMap>()(
  "@inato/GcpSecretManagerConfigProvider/SecretMap",
  { defaultValue: () => new Map<string, string>() }
) {}
```

**Key Points**:
- Uses class-based context with inheritance from `Context.Reference`
- Provides a unique identifier string as namespace: `@inato/GcpSecretManagerConfigProvider/SecretMap`
- Includes a `defaultValue` factory function for the context value
- This allows dependency injection throughout the application

### Effect.fn Pattern
The project uses `Effect.fn` with generator syntax for main business logic:

```typescript
const fromSecretManager = Effect.fn(function*({
  projectId,
  secrets
}: ConfigProviderInput) {
  // Uses yield* for composing Effects
  const secretManagerClient = yield* Effect.acquireRelease(...)
  // ... more operations
})
```

**Key Points**:
- Uses generator functions (`function*`) with `yield*` for Effect composition
- Built-in resource management with `Effect.acquireRelease`
- Structured around input parameters

### No Explicit Effect.Service Found
The codebase does NOT use `Effect.Service` directly - instead it uses:
- `Context.Reference` for defining dependencies
- `ConfigProvider` (Effect built-in) for configuration
- Direct layer composition without service definitions

## 2. LAYER COMPOSITION AND STRUCTURE PATTERNS

### Layer Creation Functions
Three layer creation functions are exported, all following a similar pattern:

#### Pattern 1: Basic Layer
```typescript
export const layerGcp = flow(
  fromSecretManager,
  Effect.map(Layer.setConfigProvider),
  Layer.unwrapScoped
)
```

#### Pattern 2: Layer with Fallback
```typescript
export const layerGcpWithEnvFallback = flow(
  fromSecretManager,
  Effect.map(ConfigProvider.orElse(() => ConfigProvider.fromEnv())),
  Effect.map(Layer.setConfigProvider),
  Layer.unwrapScoped
)
```

#### Pattern 3: Layer with Parameterized Fallback
```typescript
export const layerGcpWithJsonFallback = ({ json, projectId, secrets }: ConfigProviderInput & { json: unknown }) =>
  pipe(
    fromSecretManager({ projectId, secrets }),
    Effect.map(ConfigProvider.orElse(() => ConfigProvider.fromJson(json))),
    Effect.map(Layer.setConfigProvider),
    Layer.unwrapScoped
  )
```

### Key Layer Composition Techniques:
1. **Layer.setConfigProvider()** - Integrates ConfigProvider into the Layer
2. **Layer.unwrapScoped()** - Converts Scoped effects into regular layers
3. **ConfigProvider.orElse()** - Creates fallback chains for configuration
4. **flow()** - Function composition (from effect library)
5. **pipe()** - Explicit data piping for more complex transformations

### Scoped Effects
- Uses `Effect.acquireRelease` for resource management (e.g., SecretManagerServiceClient)
- Resources are automatically cleaned up when the layer scope ends

## 3. NAMING CONVENTIONS

### File Naming
- **Service File**: `GcpSecretManagerConfigProvider.ts`
  - PascalCase
  - Descriptive of functionality (Gcp + SecretManager + ConfigProvider)
  - Singular noun form
  - No "Service" suffix in filename

- **Test File**: `GcpSecretManagerConfigProvider.test.ts`
  - Matches service filename exactly
  - Appends `.test.ts` suffix

### Export/Variable Naming
- **Context Class**: `SecretMap` (PascalCase, single word or compound noun)
- **Context Identifier String**: `@inato/GcpSecretManagerConfigProvider/SecretMap`
  - Format: `@org/package-name/ContextName`
  - Uses kebab-case for package part
  - Uses PascalCase for context name

- **Layer Functions**: `layer` + Feature + Optional Suffix
  - `layerGcp` - basic layer
  - `layerGcpWithEnvFallback` - with fallback
  - `layerGcpWithJsonFallback` - parameterized fallback
  - Prefix: `layer` (lowercase)
  - Feature: PascalCase (Gcp)
  - Suffix: `With` + Feature description (if applicable)

- **Internal Effect Functions**: `from` + Source
  - `fromSecretManager` - creates effect from secret manager
  - Prefix: `from` (lowercase)
  - Source: PascalCase

- **Test Utilities**: Descriptive names
  - `createMockSecretManagerClient`
  - `setupTestEnvironment`
  - `cleanupTestEnvironment`
  - `retrieveSecrets`

### Configuration/Input Types
- `ConfigProviderInput` - Input interface (PascalCase, "Input" suffix)
- `SecretInput` - Type union for flexibility

## 4. DIRECTORY STRUCTURE PATTERNS

### Source Organization
```
src/
├── GcpSecretManagerConfigProvider.ts  (main implementation)
└── index.ts                            (barrel export)
```

**Single Feature Approach**:
- One main service/provider per file
- Single responsibility principle
- Barrel export for clean API surface

### Test Organization
```
test/
└── GcpSecretManagerConfigProvider.test.ts
```

- Test file mirrors source file name
- Co-located in separate test/ directory
- Uses @effect/vitest integration

## 5. BEST PRACTICES OBSERVED

### Resource Management
- Uses `Effect.acquireRelease` for proper cleanup
- Third-party clients (SecretManagerServiceClient) are properly released

### Concurrency Handling
```typescript
Effect.forEach(
  // operation
  { concurrency: "unbounded" }
)
```
- Explicit concurrency configuration
- "unbounded" for parallel operations

### Error Handling
- Uses `Effect.option()` to handle failures gracefully
- Combines `ConfigProvider.orElse()` for fallback chains
- Allows partial failures (one secret fails, continues with others)

### Effect Composition
- Uses `pipe()` and `flow()` for readable transformations
- Generator functions with `yield*` for sequential operations
- Proper use of `Effect.flatMap`, `Effect.map`, `Effect.forEach`

### Testing
- Uses @effect/vitest for Effect-specific test utilities
- `it.effect()` for Effect tests
- Proper environment setup/cleanup
- Mocking of external dependencies (Google Cloud SDK)

## 6. LAYER USAGE EXAMPLE (FROM TESTS)

```typescript
const layer = layerGcpWithEnvFallback({
  projectId: "test-project",
  secrets: [FAILING_SECRET_NAME, SUCCESSFUL_SECRET_NAME]
})

const secrets = yield* retrieveSecrets(
  [FAILING_SECRET_NAME, SUCCESSFUL_SECRET_NAME],
  layer
)

// Use with Effect.provide()
Config.string(name).pipe(Effect.provide(layer))
```

## 7. CONFIGURATION PATTERNS

The project uses Effect's built-in `ConfigProvider` system:
- `ConfigProvider.orElse()` - Compose multiple config sources
- `Layer.setConfigProvider()` - Set config provider for a layer
- Fallback chain: SecretManager -> Environment -> JSON

## Key Insights

1. **No Effect.Service** - This project doesn't use `Effect.Service` despite being an Effect package. It relies on `Context.Reference` and direct layer composition instead.

2. **Minimal but Focused** - Single feature package with three related layer variants

3. **Generator-Based Effects** - Prefers `Effect.fn()` with generator syntax over imperative Effect chaining

4. **ConfigProvider Focus** - The entire package is about providing a ConfigProvider layer, not general-purpose services

5. **Resource Safety** - Emphasizes proper resource management with `acquireRelease`

6. **Composition Over Complexity** - Uses function composition patterns to create layer variants

7. **Organized Naming** - Consistent, descriptive naming that follows TypeScript/Effect conventions
