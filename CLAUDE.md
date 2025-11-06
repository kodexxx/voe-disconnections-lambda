# CLAUDE.md - AI Assistant Guidelines

This document contains essential guidelines and architectural rules for AI assistants (like Claude, GPT-4, etc.) working on this codebase. **Read this file first** before making any changes.

## 🎯 Project Overview

This is a TypeScript/Node.js project built with:
- **Runtime**: Node.js 20.x
- **Framework**: Serverless Framework (AWS Lambda)
- **Database**: DynamoDB
- **Queues**: AWS SQS
- **Bot**: Telegram Bot (grammy)
- **Language**: TypeScript with strict mode

## 📐 Architecture Principles

### 1. Module Structure (NestJS-like)

Each feature is organized as a **separate module** in its own folder:

```
src/
  module-name/
    module-name.module.ts       # Module factory with createCachedModule
    module-name.controller.ts   # Thin controller layer
    module-name.service.ts      # Business logic
    module-name.handler.ts      # Lambda entry point (if needed)
    interfaces/                 # TypeScript interfaces
      *.interface.ts
    utils/                      # Module-specific utilities
      *.utils.ts
```

**Key Rules:**
- Each module in a **separate folder**
- **Never** mix multiple modules in one folder
- Use **NestJS naming patterns**: `name.type.ts`

### 2. Handler References in serverless.yml

**All Lambda handlers use direct module paths:**

```yaml
functions:
  # Queue processors and event-driven functions
  queueManager:
    handler: src/queue-manager/queue-manager.handler

  updateProcessor:
    handler: src/update-processor/update-processor.handler

  # HTTP API handlers
  prefetch:
    handler: src/update-manager/prefetch.handler

  botWebhookHandler:
    handler: src/bot/webhook.handler
```

**Key rules:**
- Each Lambda function has its own `.handler.ts` file
- Handler files export `handler` (not named exports)
- Direct path reference in serverless.yml: `src/module-name/function-name.handler`
- No exports through `src/functions.ts` (kept for backward compatibility only)

### 3. Single Responsibility Per File

**CRITICAL RULE**: Each file must contain **ONLY ONE** thing:

✅ **Allowed:**
- One class per file
- One function/module per file
- Multiple related interfaces per file (in `interfaces/` folder)

❌ **Forbidden:**
- Class + interface in same file
- Class + utility function in same file
- Multiple unrelated classes in same file

**Examples:**

```typescript
// ❌ WRONG - mixing class and interface
export interface UpdateQueueMessage { ... }
export class UpdateQueueService { ... }

// ✅ CORRECT - separate files:
// interfaces/update-queue-message.interface.ts
export interface UpdateQueueMessage { ... }

// update-queue.service.ts
import { UpdateQueueMessage } from './interfaces/update-queue-message.interface';
export class UpdateQueueService { ... }
```

### 4. Configuration Centralization

**ALL environment variables MUST go through `src/config.ts`**

```typescript
// ❌ WRONG - direct process.env access
const region = process.env.AWS_REGION;

// ✅ CORRECT - through Config
import { Config } from '../config';
const region = Config.AWS_REGION;
```

**Why?**
- Single source of truth
- Easy to find all env variables
- Type safety
- Testability (can mock Config)

### 5. Dependency Injection

Use **constructor injection** for all dependencies:

```typescript
// ✅ CORRECT
export class UpdateProcessorService {
  constructor(
    private readonly disconnectionService: DisconnectionService,
    private readonly voeFetcherService: VoeFetcherService,
  ) {}
}

// ❌ WRONG - creating instances directly
export class UpdateProcessorService {
  private disconnectionService = new DisconnectionService();
}
```

### 6. Module Pattern with Caching

Use `createCachedModule` for Lambda cold start optimization:

```typescript
// update-processor.module.ts
import { createCachedModule } from '../common/utils/cached-module.utils';

export const getUpdateProcessorModule = createCachedModule(() => {
  const disconnectionService = new DisconnectionService();
  const voeFetcherService = new VoeFetcherService();
  const notificationQueueService = new NotificationQueueService();

  const updateProcessorService = new UpdateProcessorService(
    disconnectionService,
    voeFetcherService,
    notificationQueueService
  );

  return {
    updateProcessorController: new UpdateProcessorController(updateProcessorService),
    updateProcessorService,
  };
});
```

**Never create services directly in handlers!**

### 7. Module Ownership and Boundaries

**CRITICAL RULE**: Each service must be created in its own module, not in consuming modules.

```typescript
// ❌ WRONG - update-processor creating notification service
export const getUpdateProcessorModule = createCachedModule(() => {
  const notificationQueueService = new NotificationQueueService(sqsClient);
  // ...
});

// ✅ CORRECT - notification-processor creates its own services
export const getNotificationProcessorModule = createCachedModule(() => {
  const awsModule = getAwsModule();
  const notificationQueueService = new NotificationQueueService(
    awsModule.sqsClient
  );

  return {
    notificationProcessorService,
    notificationQueueService, // Export for other modules
  };
});

// ✅ CORRECT - update-processor consumes via module
export const getUpdateProcessorModule = createCachedModule(() => {
  const notificationModule = getNotificationProcessorModule();

  const updateProcessorService = new UpdateProcessorService(
    disconnectionService,
    voeFetcherService,
    notificationModule.notificationQueueService // Use via module
  );

  return { updateProcessorService };
});
```

**Why this matters:**
- Maintains clear module boundaries
- Prevents tight coupling
- Makes testing easier (can mock entire modules)
- Explicit dependencies (update-processor depends on notification-processor module, not on AWS)
- Changes in one module don't leak into others

## 🗂️ File Organization

### Naming Conventions

**Pattern**: `name.type.ts`

Examples:
- `update-processor.service.ts`
- `notification-queue.service.ts`
- `update-queue-message.interface.ts`
- `array.utils.ts`
- `cached-module.utils.ts`

### Interface Files

- Location: `module-name/interfaces/`
- Naming: `name.interface.ts`
- Can contain multiple related interfaces
- **Never** mix with classes

### Utility Files

- Module-specific: `module-name/utils/name.utils.ts`
- Shared utilities: `src/common/utils/name.utils.ts`

## 📝 Code Style

### Comments Language

**ALL comments must be in English** (already enforced in the codebase).

```typescript
// ✅ CORRECT
/**
 * Process an update for a single subscription
 */
async processUpdate(message: UpdateQueueMessage): Promise<void> {
  // Fetch new data with retries
  const data = await this.fetchWithRetry(...);
}

// ❌ WRONG - Ukrainian/Russian comments
/**
 * Обробляє оновлення для однієї підписки
 */
```

### JSDoc for Public Methods

```typescript
/**
 * Enqueue multiple updates to the queue (batch)
 */
async enqueueBatch(messages: UpdateQueueMessage[]): Promise<void> {
  // implementation
}
```

## 🚀 Queue Architecture

### Two-Queue System

1. **Update Queue**
   - Processes subscription updates
   - Batch size: 5
   - Reserved concurrency: 5
   - Timeout: 120s

2. **Notification Queue**
   - Sends Telegram notifications
   - Batch size: 50
   - Reserved concurrency: 25
   - Timeout: 30s
   - Optimized for Telegram rate limits (~30 req/sec)

### Error Handling

**SQS with ReportBatchItemFailures:**
```typescript
// In handlers
const batchItemFailures = [];

for (const record of event.Records) {
  try {
    await processMessage(record);
  } catch (e) {
    // Add to failures - SQS will retry only this message
    batchItemFailures.push({
      itemIdentifier: record.messageId
    });
  }
}

return { batchItemFailures };
```

**Specific Telegram Error Handling:**
```typescript
if (e?.error_code === 403) {
  // User blocked bot - don't retry
  return;
} else if (e?.error_code === 429) {
  // Rate limit - throw to retry with delay
  throw e;
}
```

## 🧪 Before Committing

### Checklist

- [ ] Each file contains one class/function OR interfaces only
- [ ] All env variables go through `Config`
- [ ] Files named as `name.type.ts`
- [ ] Handler files export `handler` (not named exports)
- [ ] serverless.yml uses direct paths (e.g., `src/module/function.handler`)
- [ ] Dependency injection through constructors
- [ ] Modules use `createCachedModule`
- [ ] Interfaces in separate files
- [ ] Utilities in `utils/` folders
- [ ] All comments in English
- [ ] Build passes: `npm run build`
- [ ] Lint passes: `npm run lint`

### Commands

```bash
# Build
npm run build

# Lint (with auto-fix)
npm run lint

# Deploy
npm run deploy
```

## 📚 Key Documentation

- [ARCHITECTURE_RULES.md](docs/ARCHITECTURE_RULES.md) - Detailed architectural guidelines
- [queue-architecture.md](docs/queue-architecture.md) - Queue system design
- [migration-guide.md](docs/migration-guide.md) - Migration from old to new architecture
- [PERFORMANCE_OPTIMIZATIONS.md](docs/PERFORMANCE_OPTIMIZATIONS.md) - Performance tips
- [MODULE_CACHING_GUIDE.md](docs/MODULE_CACHING_GUIDE.md) - Module caching pattern

## 🔍 Common Mistakes to Avoid

### ❌ Creating Services in Handlers

```typescript
// ❌ WRONG
export const handler = async (event) => {
  const service = new UpdateService();
  await service.process(event);
};
```

**Why wrong?** Violates module pattern, bypasses caching, breaks DI.

### ❌ Mixing Types in One File

```typescript
// ❌ WRONG - update-queue.service.ts
export interface UpdateQueueMessage { }
export class UpdateQueueService { }
```

**Why wrong?** Violates Single Responsibility Principle.

### ❌ Direct process.env Access

```typescript
// ❌ WRONG
const queueUrl = process.env.UPDATE_QUEUE_URL;
```

**Why wrong?** Not centralized, hard to test, no type safety.

### ❌ Multiple Modules in One Folder

```
❌ src/processors/
    update-processor.service.ts
    notification-processor.service.ts
```

**Why wrong?** Makes code organization unclear, violates module separation.

## 💡 When Making Changes

### Adding a New Feature

1. Create a new module folder: `src/feature-name/`
2. Create module files following the structure above
3. Extract interfaces to `interfaces/` folder
4. Extract utilities to `utils/` folder
5. Add env variables to `config.ts`
6. Update `serverless.yml` if needed
7. Write tests
8. Update relevant documentation

### Refactoring Existing Code

1. Check if it follows all architectural rules
2. If not, refactor to align with rules first
3. Then make your functional changes
4. Update tests
5. Update documentation if architecture changed

### Adding Dependencies

```bash
npm install package-name
npm install -D @types/package-name  # if TypeScript types needed
```

## 🤖 AI Assistant Best Practices

1. **Always read this file first** before making changes
2. **Ask for clarification** if user request conflicts with architecture
3. **Suggest architectural improvements** if you see violations
4. **Be proactive** about code quality
5. **Document significant changes** in appropriate docs
6. **Run build and lint** before finishing

## 📞 Getting Help

If you're unsure about:
- Architecture decisions → Read `docs/ARCHITECTURE_RULES.md`
- Queue system → Read `docs/queue-architecture.md`
- Performance → Read `docs/PERFORMANCE_OPTIMIZATIONS.md`
- Module pattern → Read `docs/MODULE_CACHING_GUIDE.md`

---

**Remember**: These rules exist to maintain code quality, consistency, and maintainability. Follow them strictly, and the codebase will thank you! 🚀
