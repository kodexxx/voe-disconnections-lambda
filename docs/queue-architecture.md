# Архітектура черг для системи сповіщень VOE

## Огляд

Система використовує AWS SQS для надійної обробки оновлень розкладу відключень та відправки сповіщень користувачам.

## Архітектура

```
EventBridge (кожні 10 хв)
       ↓
Lambda: QueueManager
       ↓
  SQS: update-queue (Standard)
       ↓
Lambda: UpdateProcessor (batching 1-5, concurrency 5)
       ↓ [якщо є зміни]
       ↓
  SQS: notification-queue (Standard)
       ↓
Lambda: NotificationProcessor (batching 1-50, concurrency 25)
       ↓ [при помилці 3 рази]
       ↓
  SQS: notification-dlq / update-dlq
       ↓
Lambda: DLQMonitor (CloudWatch Alarm)
```

## Компоненти

### 1. Update Queue (черга оновлень)

**Призначення:** Обробка оновлень розкладу відключень

**Конфігурація:**
- Visibility Timeout: 120s (2 хвилини на обробку)
- Message Retention: 4 дні
- Max Receive Count: 3 спроби
- Batch Size: 5 повідомлень
- Reserved Concurrency: 5 Lambda інстансів

**Структура повідомлення:**
```typescript
{
  subscriptionArgs: "cityId=1&streetId=2&houseId=3",
  userIds: [123, 456, 789],
  attempt: 1,
  enqueuedAt: "2025-11-05T10:00:00.000Z"
}
```

**Обробка:**
1. Fetch даних з voe.com.ua (з ретраями)
2. Порівняння зі старими даними в DynamoDB
3. Збереження оновлених даних
4. Якщо є зміни → закидає в notification-queue

### 2. Notification Queue (черга сповіщень)

**Призначення:** Відправка Telegram сповіщень користувачам

**Конфігурація:**
- Visibility Timeout: 30s (швидка відправка)
- Message Retention: 1 день
- Max Receive Count: 3 спроби
- Batch Size: 50 повідомлень
- Reserved Concurrency: 25 Lambda інстансів

**Обґрунтування налаштувань:**

Базуючись на Telegram Bot API rate limits:
- **~30 запитів/сек** загальний ліміт
- **До 100 одночасних з'єднань**
- Short bursts понад ліміт допускаються

**Оптимізація:**
- 25 concurrent Lambda × 50 batch = до 1250 повідомлень у черзі одночасно
- Реальна швидкість: ~25-30 повідомлень/сек (в межах Telegram limits)
- При rate limit (429) → автоматичний retry

**Структура повідомлення:**
```typescript
{
  userId: 123,
  data: VoeDisconnectionValueItem[],
  alias: "Київ, вул. Леніна 5",
  subscriptionArgs: "cityId=1&streetId=2&houseId=3",
  lastUpdatedAt: "2025-11-05T10:00:00.000Z",
  attempt: 1,
  enqueuedAt: "2025-11-05T10:00:05.000Z"
}
```

**Обробка помилок:**
- `403 Forbidden` (bot blocked) → Видалити з черги, не retry
- `400 Bad Request` → Видалити з черги, не retry
- `429 Too Many Requests` → Retry з затримкою
- Інші помилки → Retry до 3 разів

### 3. Dead Letter Queues (DLQ)

**Update DLQ:**
- Retention: 14 днів
- CloudWatch Alarm: Тривога при ≥1 повідомленні

**Notification DLQ:**
- Retention: 7 днів
- CloudWatch Alarm: Тривога при ≥5 повідомлень

## Потік даних

### Повний цикл оновлення

```
1. EventBridge тригер (кожні 10 хв)
   └→ QueueManager Lambda
       ├→ Отримує всіх користувачів з підписками
       ├→ Групує по subscriptionArgs
       └→ Закидає ~100 завдань в UpdateQueue

2. UpdateQueue → UpdateProcessor Lambda
   ├→ Обробляє 5 підписок паралельно
   ├→ Fetch від voe.com.ua з експоненційним backoff (1s, 2s, 4s)
   ├→ Порівнює з існуючими даними в DynamoDB
   ├→ Зберігає оновлення
   └→ Якщо є зміни:
       └→ Закидає N сповіщень в NotificationQueue

3. NotificationQueue → NotificationProcessor Lambda
   ├→ Обробляє до 50 сповіщень паралельно
   ├→ 25 Lambda інстансів одночасно
   ├→ Відправка через Telegram Bot API
   └→ Обробка помилок:
       ├→ 403 (blocked) → Видалити, skip retry
       ├→ 400 (bad request) → Видалити, skip retry
       ├→ 429 (rate limit) → Retry
       └→ Інші → Retry (макс 3)

4. DLQ (якщо всі 3 спроби провалилися)
   └→ DLQMonitor Lambda
       ├→ Логування в CloudWatch
       ├→ CloudWatch Alarm нотифікація
       └→ TODO: Збереження в failed-notifications таблицю
```

## Вартість (орієнтовно)

### Припущення
- 1000 користувачів
- 100 унікальних адрес
- Перевірка кожні 10 хвилин (144 рази/день)
- 50% оновлень мають зміни
- В середньому 10 користувачів на адресу

### SQS
- **Update Queue:** 144 runs × 100 addresses = 14,400 msg/day ≈ 432K/month
- **Notification Queue:** 14,400 × 50% × 10 users = 72K/month
- **Всього:** ~504K messages/month
- **Вартість:** **БЕЗКОШТОВНО** (< 1M безкоштовних запитів)

### Lambda
- **QueueManager:** 144 × 60s = 8,640 sec/day
- **UpdateProcessor:** 14,400 × 10s = 144,000 sec/day
- **NotificationProcessor:** 72,000 × 3s = 216,000 sec/day
- **Вартість:** **~$8-12/місяць**

### CloudWatch
- Logs + Alarms: **~$2-3/місяць**

### DynamoDB
- Існуюча вартість (без змін)

**Загальна вартість: ~$10-15/місяць**

## Переваги рішення

### Надійність
✅ Автоматичні ретраї з експоненційним backoff
✅ Dead Letter Queues для проблемних повідомлень
✅ Graceful handling Telegram помилок (403, 400, 429)
✅ При падінні Lambda повідомлення повертаються в чергу

### Масштабованість
✅ SQS автоматично масштабується
✅ До 25 concurrent Lambda для сповіщень
✅ До 50 повідомлень в batch
✅ Незалежне масштабування оновлень та сповіщень

### Ефективність
✅ Batch processing (5 оновлень, 50 сповіщень)
✅ Long polling (20s wait time)
✅ Оптимізовано під Telegram rate limits (~30 msg/sec)
✅ Паралельна обробка через reserved concurrency

### Моніторинг
✅ CloudWatch Alarms для DLQ
✅ Окремі метрики для кожної черги
✅ Детальне логування помилок
✅ Visibility в кожному етапі обробки

### Вартість
✅ Безкоштовно для SQS (< 1M requests)
✅ Мінімальна вартість Lambda
✅ Pay-per-request DynamoDB

### Debugging
✅ Легко відстежити де виникла проблема
✅ Окремі DLQ для різних типів помилок
✅ Повна історія повідомлень (retention 4-14 днів)

## Telegram Rate Limits

### Офіційні ліміти
- **~30 запитів/сек** - загальний ліміт на бота
- **1 повідомлення/сек** - в приватні чати
- **20 повідомлень/хв** - в групи/канали
- **До 100 одночасних з'єднань**

### Наша конфігурація
- 25 concurrent Lambdas × 50 batch = 1250 msg в обробці
- Реальна швидкість: ~25-30 msg/sec (в межах лімітів)
- Short bursts понад ліміт - допускаються Telegram

### Обробка 429 (Too Many Requests)
```typescript
if (error.error_code === 429) {
  // SQS автоматично зробить retry
  // Visibility timeout = 30s забезпечує затримку
  throw error;
}
```

### Paid Broadcasts (опціонально)
- Можна увімкнути для збільшення до **1000 msg/sec**
- Платна опція через Telegram Stars
- Параметр: `allow_paid_broadcast: true`

## Структура файлів

```
src/
├── update-manager/
│   ├── queue-manager.ts              # Lambda: закидає в update-queue
│   ├── update-processor.ts           # Lambda: обробляє оновлення
│   ├── update-queue.service.ts       # SQS service для update-queue
│   ├── update-dlq-monitor.ts         # Lambda: моніторинг Update DLQ
│   └── update-manager.service.ts     # (legacy - видалити після міграції)
│
├── notification/
│   ├── notification-processor.ts     # Lambda: відправка сповіщень
│   ├── notification-queue.service.ts # SQS service для notification-queue
│   └── notification-dlq-monitor.ts   # Lambda: моніторинг Notification DLQ
│
├── bot/
│   └── bot.service.ts                # Telegram Bot API wrapper
│
├── disconnections/
│   └── disconnection.service.ts      # DynamoDB operations
│
└── voe-fetcher/
    └── voe-fetcher.service.ts        # Fetch from voe.com.ua
```

## Міграція з поточної системи

### Поточна система (Promise.allSettled)
```typescript
// update-manager.service.ts - LEGACY
const promises = Array.from(usersBySubscription.entries()).map(
  ([subscriptionArgs, userIds]) =>
    this.updateSubscription(subscriptionArgs, userIds),
);
const results = await Promise.allSettled(promises);
```

**Проблеми:**
❌ Немає ретраїв при помилках
❌ При падінні Lambda втрата всіх завдань
❌ Немає контролю навантаження
❌ Складно дебажити помилки

### Нова система (SQS Queues)
```typescript
// queue-manager.ts
await this.queueService.enqueueBatch(messages);

// update-processor.ts
await this.notificationQueueService.enqueueNotificationsForUsers(...);

// notification-processor.ts
await this.botService.notifyUserWithUpdate(...);
```

**Переваги:**
✅ Автоматичні ретраї
✅ Persistent storage в SQS
✅ Controlled concurrency
✅ Окремі DLQ для помилок

## TODO / Майбутні покращення

### Короткострокові
- [ ] Додати метрики в CloudWatch (успішні/провалені сповіщення)
- [ ] Створити DynamoDB таблицю `failed-notifications` для аналітики
- [ ] Додати SNS topic для critical alerts з DLQ
- [ ] Деактивувати підписки користувачів після N помилок 403

### Середньострокові
- [ ] Імплементувати circuit breaker для voe.com.ua API
- [ ] Додати caching для часто запитуваних адрес
- [ ] A/B тестування різних batch sizes
- [ ] Dashboard в CloudWatch для моніторингу

### Довгострокові
- [ ] Розглянути Paid Broadcasts для масштабування >1000 users
- [ ] Міграція на FIFO queues якщо потрібен строгий порядок
- [ ] Розглянути Step Functions для складніших workflow
- [ ] Додати WebSocket для real-time оновлень

## Моніторинг та алерти

### CloudWatch Metrics
- `UpdateQueue/ApproximateNumberOfMessagesVisible`
- `UpdateQueue/ApproximateAgeOfOldestMessage`
- `NotificationQueue/ApproximateNumberOfMessagesVisible`
- `UpdateDLQ/ApproximateNumberOfMessagesVisible` → Alarm
- `NotificationDLQ/ApproximateNumberOfMessagesVisible` → Alarm

### Lambda Metrics
- `QueueManager/Duration`
- `UpdateProcessor/Errors`
- `NotificationProcessor/Throttles`
- `NotificationProcessor/ConcurrentExecutions`

### Custom Metrics (TODO)
- Успішні сповіщення / загальна кількість
- Середній час обробки оновлення
- Кількість змін в розкладах
- Rate limit 429 помилки

## Висновки

Ця архітектура забезпечує:

1. **Надійність** через автоматичні ретраї та DLQ
2. **Масштабованість** через SQS та Lambda concurrency
3. **Ефективність** через оптимізований batching
4. **Економічність** через безкоштовний SQS tier
5. **Observability** через CloudWatch метрики та алерти

Система оптимізована під Telegram rate limits і забезпечує стабільну роботу навіть при збільшенні кількості користувачів у 10-100 разів.
