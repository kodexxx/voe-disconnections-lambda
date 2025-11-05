# Queue System - Quick Start

## 🚀 Швидкий старт

### 1. Встановити залежності
```bash
npm install
```

### 2. Зібрати проект
```bash
npm run build
```

### 3. Deploy
```bash
npm run deploy
```

## 📊 Архітектура

```
EventBridge (10 хв) → QueueManager → UpdateQueue → UpdateProcessor
                                                          ↓
                                            NotificationQueue → NotificationProcessor
```

## 📁 Структура файлів

### Update Manager
```
src/update-manager/
├── queue-manager.ts              # Сервіс для закидання в чергу
├── queue-manager.handler.ts      # Lambda handler (EventBridge)
├── update-queue.service.ts       # SQS client для Update Queue
├── update-processor.ts           # Сервіс для обробки оновлень
├── update-processor.handler.ts   # Lambda handler (SQS)
└── update-dlq-monitor.handler.ts # DLQ моніторинг
```

### Notification
```
src/notification/
├── notification-queue.service.ts       # SQS client для Notification Queue
├── notification-processor.ts           # Сервіс для відправки
├── notification-processor.handler.ts   # Lambda handler (SQS)
└── notification-dlq-monitor.handler.ts # DLQ моніторинг
```

## 🔧 Конфігурація

### Update Queue
- **Batch Size:** 5
- **Concurrency:** 5
- **Timeout:** 120s
- **Visibility Timeout:** 120s
- **Retention:** 4 дні
- **Max Retries:** 3

### Notification Queue
- **Batch Size:** 50
- **Concurrency:** 25
- **Timeout:** 30s
- **Visibility Timeout:** 30s
- **Retention:** 1 день
- **Max Retries:** 3

## 📈 Моніторинг

### CloudWatch Logs
```bash
# Queue Manager
aws logs tail /aws/lambda/disconnection-service-dev-queueManager --follow

# Update Processor
aws logs tail /aws/lambda/disconnection-service-dev-updateProcessor --follow

# Notification Processor
aws logs tail /aws/lambda/disconnection-service-dev-notificationProcessor --follow
```

### Перевірити черги
```bash
# Update Queue
aws sqs get-queue-attributes \
  --queue-url $(aws cloudformation describe-stacks \
    --stack-name disconnection-service-dev \
    --query 'Stacks[0].Outputs[?OutputKey==`UpdateQueueUrl`].OutputValue' \
    --output text) \
  --attribute-names ApproximateNumberOfMessages

# Notification Queue
aws sqs get-queue-attributes \
  --queue-url $(aws cloudformation describe-stacks \
    --stack-name disconnection-service-dev \
    --query 'Stacks[0].Outputs[?OutputKey==`NotificationQueueUrl`].OutputValue' \
    --output text) \
  --attribute-names ApproximateNumberOfMessages
```

### Перевірити DLQ
```bash
# Update DLQ
aws sqs get-queue-attributes \
  --queue-url $(aws cloudformation describe-stacks \
    --stack-name disconnection-service-dev \
    --query 'Stacks[0].Outputs[?OutputKey==`UpdateDLQUrl`].OutputValue' \
    --output text) \
  --attribute-names ApproximateNumberOfMessages

# Notification DLQ
aws sqs get-queue-attributes \
  --queue-url $(aws cloudformation describe-stacks \
    --stack-name disconnection-service-dev \
    --query 'Stacks[0].Outputs[?OutputKey==`NotificationDLQUrl`].OutputValue' \
    --output text) \
  --attribute-names ApproximateNumberOfMessages
```

## 🧪 Тестування

### Викликати QueueManager вручну
```bash
aws lambda invoke \
  --function-name disconnection-service-dev-queueManager \
  --payload '{}' \
  response.json && cat response.json
```

### Очистити черги
```bash
# Update Queue
aws sqs purge-queue --queue-url <UPDATE_QUEUE_URL>

# Notification Queue
aws sqs purge-queue --queue-url <NOTIFICATION_QUEUE_URL>
```

## 🐛 Troubleshooting

### Повідомлення не обробляються
1. Перевірити Lambda permissions для SQS
2. Перевірити event source mapping активний
3. Перевірити Lambda не throttling

```bash
aws lambda list-event-source-mappings \
  --function-name disconnection-service-dev-updateProcessor
```

### Повідомлення в DLQ
1. Перевірити логи Lambda
2. Перевірити повідомлення в DLQ
3. Повторно відправити через AWS Console (DLQ redrive)

### Rate limit (429)
1. Зменшити `reservedConcurrency` для notificationProcessor
2. Зменшити `batchSize`

## 💰 Вартість

- **SQS:** Безкоштовно (< 1M requests/month)
- **Lambda:** ~$8-12/month
- **CloudWatch:** ~$2-3/month

**Всього:** ~$10-15/month

## 📚 Документація

- [docs/queue-architecture.md](./queue-architecture.md) - Детальна архітектура
- [docs/migration-guide.md](./migration-guide.md) - Міграційний гайд

## ✅ Переваги

- ✅ Надійність через автоматичні ретраї
- ✅ Масштабованість через SQS + Lambda
- ✅ Ефективність через батчинг (5 + 50)
- ✅ Економічність (безкоштовно для SQS)
- ✅ Observability через CloudWatch
- ✅ Оптимізовано під Telegram rate limits (~30 msg/sec)
