# Міграційний гайд: Від in-memory обробки до SQS черг

## Огляд змін

Система була оновлена з in-memory Promise-based обробки на надійну архітектуру з AWS SQS чергами.

## Створені файли

### Update Manager
- `src/update-manager/update-queue.service.ts` - Сервіс для роботи з Update Queue
- `src/update-manager/queue-manager.ts` - Сервіс для закидання підписок в чергу
- `src/update-manager/queue-manager.handler.ts` - Lambda handler (EventBridge trigger)
- `src/update-manager/update-processor.ts` - Сервіс для обробки оновлень
- `src/update-manager/update-processor.handler.ts` - Lambda handler (SQS trigger)
- `src/update-manager/update-dlq-monitor.handler.ts` - Lambda handler для DLQ моніторингу

### Notification
- `src/notification/notification-queue.service.ts` - Сервіс для роботи з Notification Queue
- `src/notification/notification-processor.ts` - Сервіс для відправки сповіщень
- `src/notification/notification-processor.handler.ts` - Lambda handler (SQS trigger)
- `src/notification/notification-dlq-monitor.handler.ts` - Lambda handler для DLQ моніторингу

### Документація
- `docs/queue-architecture.md` - Детальна документація архітектури
- `docs/migration-guide.md` - Цей документ

## Оновлені файли

### serverless.yml
Додано:
- 4 SQS черги (Update Queue, Update DLQ, Notification Queue, Notification DLQ)
- 2 CloudWatch Alarms для DLQ
- 6 Lambda функцій (queueManager, updateProcessor, notificationProcessor, 2 DLQ monitors)
- SQS permissions в IAM role
- Outputs для Queue URLs

### package.json
Додано залежність:
- `@aws-sdk/client-sqs` - AWS SDK для роботи з SQS

## Deployment Steps

### 1. Встановити залежності
```bash
npm install
```

### 2. Зібрати проект
```bash
npm run build
```

### 3. Deploy на AWS
```bash
npm run deploy
# або для dev environment
npm run deploy:dev
```

### 4. Перевірити створення ресурсів
Після deploy перевірте у AWS Console:
- SQS: 4 черги створені
- Lambda: 6 нових функцій
- CloudWatch: 2 нових алерти
- EventBridge: Cron тригер для queueManager

### 5. Моніторинг

#### CloudWatch Logs
Кожна Lambda функція пише логи в CloudWatch:
- `/aws/lambda/disconnection-service-dev-queueManager`
- `/aws/lambda/disconnection-service-dev-updateProcessor`
- `/aws/lambda/disconnection-service-dev-notificationProcessor`
- `/aws/lambda/disconnection-service-dev-updateDLQMonitor`
- `/aws/lambda/disconnection-service-dev-notificationDLQMonitor`

#### CloudWatch Metrics
Основні метрики для моніторингу:
- `AWS/SQS/ApproximateNumberOfMessagesVisible` - Кількість повідомлень в черзі
- `AWS/SQS/ApproximateAgeOfOldestMessage` - Вік найстарішого повідомлення
- `AWS/Lambda/Duration` - Час виконання Lambda
- `AWS/Lambda/Errors` - Кількість помилок
- `AWS/Lambda/ConcurrentExecutions` - Кількість одночасних виконань

#### CloudWatch Alarms
Автоматично створені алерти:
- `disconnection-service-update-dlq-alarm-dev` - Тривога при повідомленнях в Update DLQ
- `disconnection-service-notification-dlq-alarm-dev` - Тривога при >5 повідомленнях в Notification DLQ

## Потік даних (Before/After)

### BEFORE (старий потік)
```
EventBridge (10 min)
       ↓
Lambda: prefetch
       ├→ getAllUsersWithSubscriptions()
       ├→ Promise.allSettled([
       │    updateSubscription(sub1, users),
       │    updateSubscription(sub2, users),
       │    ...
       │  ])
       └→ notifyUsers() - Promise.all()
```

**Проблеми:**
- ❌ При падінні Lambda втрата всіх завдань
- ❌ Немає ретраїв
- ❌ Timeout 60s може не вистачити
- ❌ Складно дебажити

### AFTER (новий потік)
```
EventBridge (10 min)
       ↓
Lambda: queueManager (60s)
       ↓
  SQS: update-queue
       ↓
Lambda: updateProcessor (120s, concurrency 5)
       ↓ [якщо є зміни]
       ↓
  SQS: notification-queue
       ↓
Lambda: notificationProcessor (30s, concurrency 25)
```

**Переваги:**
- ✅ Надійність - повідомлення зберігаються в SQS
- ✅ Автоматичні ретраї (3 спроби)
- ✅ Controlled concurrency
- ✅ Окремі DLQ для проблемних повідомлень
- ✅ Детальний моніторинг
- ✅ Масштабованість

## Backwards Compatibility

Legacy функція `prefetch` збережена для backward compatibility:
```yaml
prefetch:
  handler: src/functions.prefetch
  timeout: 60
  memorySize: 512
  events:
    - httpApi:
        path: /prefetch-local
        method: get
```

Ви можете викликати її локально для тестування:
```bash
curl https://your-api.execute-api.us-east-1.amazonaws.com/prefetch-local
```

**Рекомендація:** Після перевірки нової системи видаліть legacy функцію.

## Rollback Plan

Якщо потрібно повернутися до старої системи:

### 1. Увімкнути старий EventBridge тригер
```yaml
# serverless.yml
functions:
  prefetch:
    events:
      - eventBridge:
          schedule: cron(0/10 * * * ? *)
          enabled: true  # Увімкнути
```

### 2. Вимкнути новий тригер
```yaml
functions:
  queueManager:
    events:
      - eventBridge:
          enabled: false  # Вимкнути
```

### 3. Deploy
```bash
npm run deploy
```

### 4. Очистити черги (опціонально)
```bash
# Purge Update Queue
aws sqs purge-queue --queue-url <UPDATE_QUEUE_URL>

# Purge Notification Queue
aws sqs purge-queue --queue-url <NOTIFICATION_QUEUE_URL>
```

## Testing

### 1. Локальне тестування (serverless-offline)
```bash
npm run dev
```

### 2. Invoke queueManager вручну
```bash
aws lambda invoke \
  --function-name disconnection-service-dev-queueManager \
  --payload '{}' \
  response.json
```

### 3. Перевірити черги
```bash
# Кількість повідомлень в Update Queue
aws sqs get-queue-attributes \
  --queue-url <UPDATE_QUEUE_URL> \
  --attribute-names ApproximateNumberOfMessages

# Кількість повідомлень в Notification Queue
aws sqs get-queue-attributes \
  --queue-url <NOTIFICATION_QUEUE_URL> \
  --attribute-names ApproximateNumberOfMessages
```

### 4. Перевірити DLQ
```bash
# Update DLQ
aws sqs get-queue-attributes \
  --queue-url <UPDATE_DLQ_URL> \
  --attribute-names ApproximateNumberOfMessages

# Notification DLQ
aws sqs get-queue-attributes \
  --queue-url <NOTIFICATION_DLQ_URL> \
  --attribute-names ApproximateNumberOfMessages
```

## Performance Tuning

### Збільшити throughput
```yaml
# serverless.yml
notificationProcessor:
  reservedConcurrency: 50  # Збільшити з 25 до 50
  events:
    - sqs:
        batchSize: 100  # Збільшити з 50 до 100
```

**Увага:** Стежте за Telegram rate limits (~30 msg/sec)

### Зменшити затримку
```yaml
notificationProcessor:
  events:
    - sqs:
        maximumBatchingWindowInSeconds: 0  # Зменшити з 5 до 0
```

### Збільшити час на обробку
```yaml
updateProcessor:
  timeout: 180  # Збільшити зі 120 до 180 секунд
  events:
    - sqs:
        VisibilityTimeout: 180  # Синхронізувати з timeout
```

## Cost Optimization

### Поточна вартість
- SQS: **Безкоштовно** (< 1M requests/month)
- Lambda: **~$8-12/month**
- CloudWatch: **~$2-3/month**

### Як зменшити вартість

1. **Збільшити batch size** (менше Lambda invocations):
```yaml
updateProcessor:
  events:
    - sqs:
        batchSize: 10  # Збільшити з 5 до 10
```

2. **Зменшити memory** (якщо не потрібно):
```yaml
notificationProcessor:
  memorySize: 256  # Зменшити з 384 до 256
```

3. **Збільшити batching window** (більше повідомлень в batch):
```yaml
notificationProcessor:
  events:
    - sqs:
        maximumBatchingWindowInSeconds: 10  # Збільшити з 5 до 10
```

## Troubleshooting

### Повідомлення не обробляються

**Перевірити:**
1. Lambda має права на SQS
2. Event source mapping активний
3. Lambda не throttling
4. Черга не empty

```bash
# Перевірити event source mapping
aws lambda list-event-source-mappings \
  --function-name disconnection-service-dev-updateProcessor

# Перевірити Lambda метрики
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Throttles \
  --dimensions Name=FunctionName,Value=disconnection-service-dev-updateProcessor \
  --start-time 2025-11-05T00:00:00Z \
  --end-time 2025-11-05T23:59:59Z \
  --period 300 \
  --statistics Sum
```

### Повідомлення потрапляють в DLQ

**Перевірити логи:**
```bash
aws logs tail /aws/lambda/disconnection-service-dev-updateProcessor --follow
```

**Перевірити DLQ:**
```bash
# Отримати повідомлення з DLQ
aws sqs receive-message \
  --queue-url <UPDATE_DLQ_URL> \
  --max-number-of-messages 10
```

**Повторно відправити з DLQ в main queue:**
```bash
# Через AWS Console: SQS → DLQ → Start DLQ redrive
```

### Telegram rate limit (429)

**Рішення:**
1. Зменшити `reservedConcurrency`
2. Зменшити `batchSize`
3. Додати затримку між повідомленнями (не рекомендується)

## Наступні кроки

### Short-term
- [ ] Налаштувати SNS topic для critical alerts
- [ ] Створити CloudWatch Dashboard
- [ ] Додати custom metrics
- [ ] Видалити legacy `prefetch` функцію після перевірки

### Mid-term
- [ ] Створити DynamoDB таблицю `failed-notifications` для аналітики
- [ ] Додати деактивацію підписок після N помилок 403
- [ ] Імплементувати circuit breaker для voe.com.ua API
- [ ] A/B тестування різних batch sizes

### Long-term
- [ ] Розглянути Paid Broadcasts для >1000 users
- [ ] Міграція на FIFO queues (якщо потрібен порядок)
- [ ] Додати WebSocket для real-time оновлень
- [ ] Розглянути Step Functions для складніших workflow

## Підтримка

При виникненні проблем:
1. Перевірити CloudWatch Logs
2. Перевірити CloudWatch Alarms
3. Перевірити SQS черги (main + DLQ)
4. Перевірити Lambda metrics (Errors, Throttles, Duration)

Документація:
- [docs/queue-architecture.md](./queue-architecture.md) - Детальна архітектура
- AWS SQS: https://docs.aws.amazon.com/sqs/
- AWS Lambda: https://docs.aws.amazon.com/lambda/
- Telegram Bot API: https://core.telegram.org/bots/api
