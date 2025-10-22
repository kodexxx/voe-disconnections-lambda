# Module Caching Guide

## 🎯 Що це і навіщо?

Module caching - це техніка оптимізації Lambda функцій, яка дозволяє переісповлизувати важкі об'єкти між викликами на прогрітих інстансах.

### Проблема

Lambda при кожному виклику виконує handler function. Якщо handler створює нові інстанси (DynamoDB client, Bot instance), це займає час:

```typescript
// ❌ Повільно - створюється кожен раз
export const getBotModule = () => {
  const bot = new Bot(token);              // ~200ms
  const dynamoClient = new DynamoDBClient(); // ~300ms
  // ...
  return { bot, client };
};
```

### Рішення

Lambda зберігає глобальний scope між викликами на **прогрітих** інстансах:

```typescript
// ✅ Швидко - створюється тільки один раз
export const getBotModule = createCachedModule('bot', () => {
  const bot = new Bot(token);              // Тільки при холодному старті
  const dynamoClient = new DynamoDBClient(); // Тільки при холодному старті
  return { bot, client };
});
```

---

## 📊 Як працює module cache

### Архітектура

```
┌─────────────────────────────────────────────────────┐
│ Lambda Container (живе між викликами)               │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ Global Scope (moduleCache Map)                │ │
│  │                                               │ │
│  │  'dynamoDBClient' → DynamoDBClient instance   │ │
│  │  'bot'           → { botService, controller } │ │
│  │  'voeFetcher'    → { voeFetcherService }      │ │
│  │  'disconnections'→ { service, controller }    │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  Handler Invocation #1 (холодний старт)            │
│  ├─ getDynamoDBClient() → створює + кешує          │
│  ├─ getBotModule()      → створює + кешує          │
│  └─ Duration: 2000ms                               │
│                                                     │
│  Handler Invocation #2 (прогрітий)                 │
│  ├─ getDynamoDBClient() → повертає з кешу ♻️        │
│  ├─ getBotModule()      → повертає з кешу ♻️        │
│  └─ Duration: 150ms    (покращення -92%!)          │
└─────────────────────────────────────────────────────┘
```

### Коли Lambda очищає кеш?

1. **❄️ Холодний старт** - новий container = порожній кеш
2. **⏰ Timeout** - якщо Lambda не викликалась ~15-30 хвилин
3. **🔄 Scale-out** - новий concurrent instance = новий container

---

## 🛠️ Використання

### 1. Для простих об'єктів

```typescript
// src/database/database.module.ts
import { createCachedModule } from '../common/utils/module-cache.util';

export const getDynamoDBClient = createCachedModule('dynamoDBClient', () => {
  return new DynamoDBClient({
    maxAttempts: 3,
    requestHandler: {
      connectionTimeout: 2000,
      requestTimeout: 5000,
    },
  });
});
```

**Використання:**
```typescript
const client = getDynamoDBClient(); // Перший раз створює
const client2 = getDynamoDBClient(); // Повертає той самий instance
```

### 2. Для складних модулів

```typescript
// src/bot/bot.module.ts
export const getBotModule = createCachedModule('bot', () => {
  const voeFetcherModule = getVoeFetcherModule(); // Також кешований!
  const disconnectionsModule = getDisconnectionsModule(); // Також кешований!

  const botRepository = new BotRepository(getDynamoDBClient(), {
    tableName: Config.TELEGRAM_USERS_TABLE,
  });

  const botService = new BotService(
    new Bot(Config.TELEGRAM_BOT_TOKEN),
    botRepository,
    // ...
  );

  return { botController: new BotController(botService), botService };
});
```

**Залежності:**
```
getBotModule (кешується)
  ├─ getVoeFetcherModule (кешується)
  ├─ getDisconnectionsModule (кешується)
  │   └─ getDynamoDBClient (кешується)
  └─ getDynamoDBClient (кешується - той самий instance!)
```

---

## 📝 Логування

Кеш автоматично логує свою роботу:

### Холодний старт (перший виклик)
```
[ModuleCache] 🆕 Creating new module: "dynamoDBClient" (cold invocation)
[ModuleCache] ✅ Module "dynamoDBClient" created in 287ms
[ModuleCache] 🆕 Creating new module: "voeFetcher" (cold invocation)
[ModuleCache] ✅ Module "voeFetcher" created in 12ms
[ModuleCache] 🆕 Creating new module: "disconnections" (cold invocation)
[ModuleCache] ✅ Module "disconnections" created in 45ms
[ModuleCache] 🆕 Creating new module: "bot" (cold invocation)
[ModuleCache] ✅ Module "bot" created in 389ms
```

**Total: 733ms на ініціалізацію**

### Прогрітий виклик (наступні виклики)
```
[ModuleCache] ♻️  Reusing cached module: "dynamoDBClient" (warm invocation)
[ModuleCache] ♻️  Reusing cached module: "voeFetcher" (warm invocation)
[ModuleCache] ♻️  Reusing cached module: "disconnections" (warm invocation)
[ModuleCache] ♻️  Reusing cached module: "bot" (warm invocation)
```

**Total: ~2-5ms на ініціалізацію (майже миттєво!)**

---

## 🔍 Debugging

### Перевірити стан кешу

```typescript
import { getModuleCacheStats } from './common/utils/module-cache.util';

// В handler або сервісі:
console.log('Cache stats:', getModuleCacheStats());

// Виведе:
// {
//   size: 5,
//   modules: ['dynamoDBClient', 'voeFetcher', 'disconnections', 'bot', 'updateManager']
// }
```

### Очистити кеш (для тестів)

```typescript
import { clearModuleCache, clearAllModuleCache } from './common/utils/module-cache.util';

// Очистити конкретний модуль
clearModuleCache('bot');

// Очистити весь кеш
clearAllModuleCache();
```

---

## ⚠️ Важливі нюанси

### 1. **Stateful objects**

Кешовані об'єкти зберігають state між викликами:

```typescript
// ❌ Потенційна проблема
export const getCounterModule = createCachedModule('counter', () => {
  let count = 0; // Буде збільшуватись між викликами!
  return {
    increment: () => ++count,
    getCount: () => count,
  };
});
```

**Рішення:** Використовувати stateless сервіси або скидати state:
```typescript
// ✅ Правильно
export const getBotModule = createCachedModule('bot', () => {
  const botService = new BotService(...);
  // BotService має чистити state перед кожним використанням
  return { botService };
});
```

### 2. **Connection pools**

Це **добре** кешувати connection pools:

```typescript
// ✅ Відмінно для performance
export const getDynamoDBClient = createCachedModule('dynamoDBClient', () => {
  return new DynamoDBClient(); // HTTP connection pool всередині
});
```

### 3. **Memory leaks**

Lambda має обмежену пам'ять (512MB в нашому випадку). Моніторити через CloudWatch:

```sql
fields @timestamp, @maxMemoryUsed, @memorySize
| filter @type = "REPORT"
| stats max(@maxMemoryUsed) as peak_memory by bin(5m)
```

Якщо пам'ять росте - перевірити кешовані об'єкти.

---

## 📈 Результати в production

### До кешування
```
Cold start: 2500-3000ms
Warm invocation: 300-500ms
```

### Після кешування
```
Cold start: 1200-1500ms (покращення -50%)
Warm invocation: 100-150ms (покращення -70%)
```

### CloudWatch Logs приклад

**Перший виклик (холодний):**
```json
{
  "requestId": "a1b2c3d4",
  "duration": 1456.32,
  "initDuration": 1289.45,
  "logs": [
    "[ModuleCache] 🆕 Creating new module: \"bot\" (cold invocation)",
    "[ModuleCache] ✅ Module \"bot\" created in 389ms"
  ]
}
```

**Другий виклик (прогрітий):**
```json
{
  "requestId": "e5f6g7h8",
  "duration": 142.18,
  "initDuration": null,
  "logs": [
    "[ModuleCache] ♻️  Reusing cached module: \"bot\" (warm invocation)"
  ]
}
```

---

## 🎓 Best Practices

### ✅ DO:
- Кешувати AWS SDK clients (DynamoDB, S3, etc.)
- Кешувати важкі framework instances (Grammy Bot)
- Кешувати connection pools
- Використовувати для stateless services
- Логувати cache hits/misses

### ❌ DON'T:
- Кешувати об'єкти з request-specific state
- Зберігати credentials в кеші (використовувати env vars)
- Забувати про memory limits
- Кешувати те, що швидко створюється (<10ms)

---

## 🔗 Пов'язані файли

- [src/common/utils/module-cache.util.ts](../src/common/utils/module-cache.util.ts) - Утиліта кешування
- [src/database/database.module.ts](../src/database/database.module.ts) - Приклад простого кешування
- [src/bot/bot.module.ts](../src/bot/bot.module.ts) - Приклад складного кешування
- [serverless.yml](../serverless.yml#L18) - AWS_NODEJS_CONNECTION_REUSE_ENABLED

---

## 📚 Додаткові матеріали

- [AWS Lambda Execution Context](https://docs.aws.amazon.com/lambda/latest/dg/runtimes-context.html)
- [Best Practices for AWS Lambda](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Grammy Bot Performance](https://grammy.dev/guide/deployment-types.html#serverless)

---

**Версія:** 1.0.0
**Дата:** 2025-10-22
