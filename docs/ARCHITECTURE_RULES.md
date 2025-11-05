# Архітектурні правила проекту

Цей документ містить ключові архітектурні правила та принципи, яких необхідно дотримуватись при розробці проекту.

## 🏗️ Структура модулів

### Принцип організації

Проект використовує **NestJS-подібну архітектуру** з чіткою модульною структурою.

### Правила структури папок

1. **Кожен модуль в окремій папці**
   ```
   src/
     module-name/
       module-name.module.ts
       module-name.controller.ts
       module-name.service.ts
       module-name.handler.ts (якщо є Lambda handler)
       interfaces/
       utils/
   ```

2. **Naming conventions**
   - Всі файли іменуються за шаблоном: `name.type.ts`
   - Приклади:
     - `update-processor.service.ts`
     - `notification-queue.service.ts`
     - `update-queue-message.interface.ts`

### Модульна архітектура

1. **Module Pattern з createCachedModule**
   - Кожен модуль використовує фабрику з кешуванням
   - Singleton pattern для Lambda холодних стартів

   ```typescript
   export const getModuleName = createCachedModule(() => ({
     controller: new ModuleController(dependencies),
     service: new ModuleService(dependencies)
   }));
   ```

2. **Dependency Injection через constructors**
   - Всі залежності передаються через конструктор
   - Не створювати сервіси безпосередньо в handlers

   ```typescript
   // ✅ Правильно
   export class UpdateProcessorService {
     constructor(
       private readonly disconnectionService: DisconnectionService,
       private readonly voeFetcherService: VoeFetcherService
     ) {}
   }

   // ❌ Неправильно
   export class UpdateProcessorService {
     private disconnectionService = new DisconnectionService();
   }
   ```

## 📁 Організація коду

### Single Responsibility Principle (SRP)

**Кожен файл повинен містити ОДНУ річ:**

1. **Один клас**, АБО
2. **Одна функція/модуль**, АБО
3. **Інтерфейси** (можливо декілька пов'язаних)

**Заборонено:**
- Міксувати класи та інтерфейси в одному файлі
- Міксувати класи та функції в одному файлі
- Декілька непов'язаних класів в одному файлі

```typescript
// ❌ Неправильно
export interface UpdateQueueMessage { ... }
export class UpdateQueueService { ... }

// ✅ Правильно - розділити на файли:
// interfaces/update-queue-message.interface.ts
export interface UpdateQueueMessage { ... }

// update-queue.service.ts
import { UpdateQueueMessage } from './interfaces/update-queue-message.interface';
export class UpdateQueueService { ... }
```

### Організація допоміжних файлів

1. **Інтерфейси**
   - Зберігаються в папці `interfaces/` всередині модуля
   - Файли називаються `name.interface.ts`
   - Можна групувати пов'язані інтерфейси в одному файлі

2. **Утиліти**
   - Модуль-специфічні: `module-name/utils/`
   - Загальні (shared): `src/common/utils/`
   - Файли називаються `name.utils.ts`

## ⚙️ Конфігурація

### Правило централізації env змінних

**Всі змінні оточення ОБОВ'ЯЗКОВО проходять через `src/config.ts`**

```typescript
// ❌ Неправильно - пряме використання process.env
export class SomeService {
  constructor() {
    const apiKey = process.env.API_KEY;
  }
}

// ✅ Правильно - через Config
import { Config } from '../config';

export class SomeService {
  constructor() {
    const apiKey = Config.API_KEY;
  }
}
```

### Структура config.ts

```typescript
import * as process from 'node:process';

export const Config = {
  // Database
  DYNAMODB_TABLE: process.env.DYNAMODB_TABLE,
  TELEGRAM_USERS_TABLE: process.env.TELEGRAM_USERS_TABLE,

  // AWS
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',

  // Queues
  UPDATE_QUEUE_URL: process.env.UPDATE_QUEUE_URL,
  NOTIFICATION_QUEUE_URL: process.env.NOTIFICATION_QUEUE_URL,

  // External APIs
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
} as const;
```

**Переваги централізації:**
- Одне джерело правди для всіх env змінних
- Легко знайти всі використовувані змінні
- Можливість додати валідацію
- Типізація через TypeScript
- Легше тестувати (можна замокати Config)

## 🔄 Ін'єкція залежностей

### Controllers

Controllers - тонкий шар між handlers та services.

```typescript
export class UpdateProcessorController {
  constructor(
    private readonly updateProcessorService: UpdateProcessorService
  ) {}

  async processUpdate(message: UpdateQueueMessage) {
    return this.updateProcessorService.processUpdate(message);
  }
}
```

### Services

Services містять бізнес-логіку.

```typescript
export class UpdateProcessorService {
  constructor(
    private readonly disconnectionService: DisconnectionService,
    private readonly voeFetcherService: VoeFetcherService,
    private readonly notificationQueueService: NotificationQueueService
  ) {}

  async processUpdate(message: UpdateQueueMessage): Promise<void> {
    // Бізнес логіка
  }
}
```

### Handlers

Lambda handlers - entry points, використовують модулі.

```typescript
import { getUpdateProcessorModule } from './update-processor.module';

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const module = getUpdateProcessorModule();

  for (const record of event.Records) {
    const message = JSON.parse(record.body);
    await module.controller.processUpdate(message);
  }

  return { batchItemFailures };
};
```

## 📦 Імпорти

### Правила імпортів

1. **Використовувати відносні шляхи для проектних файлів**
   ```typescript
   import { Config } from '../config';
   import { UpdateQueueMessage } from './interfaces/update-queue-message.interface';
   ```

2. **Імпорти інтерфейсів через окремі файли**
   ```typescript
   // ❌ Неправильно
   import { UpdateQueueMessage } from './update-queue.service';

   // ✅ Правильно
   import { UpdateQueueMessage } from './interfaces/update-queue-message.interface';
   ```

3. **Порядок імпортів** (не обов'язковий, але рекомендований):
   - Node.js built-ins
   - External dependencies
   - Project imports (config, interfaces, services)

## 🧪 Тестування

### Unit Tests

- Файли: `*.spec.ts` поруч з файлом що тестується
- Мокати залежності через DI

### Integration Tests

- Файли: `*.integration.spec.ts`
- Тестувати взаємодію модулів

## 📝 Документація

### Коментарі в коді

1. **JSDoc для публічних методів**
   ```typescript
   /**
    * Обробляє оновлення для однієї підписки
    */
   async processUpdate(message: UpdateQueueMessage): Promise<void> {
   ```

2. **Пояснення бізнес-логіки**
   - Чому, а не що
   - Складні алгоритми
   - Нетривіальні рішення

### Markdown документація

- Архітектурні рішення → `docs/ARCHITECTURE_*.md`
- Міграції → `docs/migration-guide.md`
- Performance → `docs/PERFORMANCE_*.md`
- README для кожної значної фічі

## 🚫 Антипаттерни

### Що робити НЕ можна

1. **Створювати сервіси в handlers**
   ```typescript
   // ❌ Неправильно
   export const handler = async (event) => {
     const service = new UpdateService();
   };
   ```

2. **Міксувати різні типи в одному файлі**
   ```typescript
   // ❌ Неправильно
   export interface Message { }
   export class Service { }
   export function helper() { }
   ```

3. **Використовувати process.env напряму**
   ```typescript
   // ❌ Неправильно
   const token = process.env.BOT_TOKEN;

   // ✅ Правильно
   const token = Config.BOT_TOKEN;
   ```

4. **Декілька модулів в одній папці**
   ```
   ❌ src/processors/
       update-processor.service.ts
       notification-processor.service.ts

   ✅ src/update-processor/
       update-processor.service.ts
     src/notification-processor/
       notification-processor.service.ts
   ```

## ✅ Чеклист перед комітом

- [ ] Кожен файл містить одну річ (клас/функція/інтерфейси)
- [ ] Всі env змінні через Config
- [ ] Файли названі за шаблоном `name.type.ts`
- [ ] DI через конструктори
- [ ] Модулі використовують createCachedModule
- [ ] Інтерфейси в окремих файлах
- [ ] Утиліти винесені в `utils/`
- [ ] Build проходить без помилок
- [ ] Lint проходить без помилок

---

**Важливо:** Ці правила не лише рекомендації - вони критичні для підтримки коду. При code review обов'язково перевіряти дотримання цих принципів.
