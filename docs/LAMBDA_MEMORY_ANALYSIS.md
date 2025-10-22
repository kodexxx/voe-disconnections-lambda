# Lambda Memory Configuration Analysis

## 🎯 Мета
Оптимізувати memory/CPU allocation для кожної Lambda функції, щоб досягти найкращого співвідношення performance/cost.

---

## 📊 AWS Lambda Memory vs CPU

AWS Lambda виділяє CPU **пропорційно** до memory:

| Memory (MB) | vCPU | Cost (per 1ms) | Use Case |
|-------------|------|----------------|----------|
| 128 | 0.083 | $0.0000000021 | Дуже легкі задачі |
| 256 | 0.167 | $0.0000000042 | Легкі I/O операції |
| 384 | 0.250 | $0.0000000063 | Середні задачі |
| 512 | 0.333 | $0.0000000083 | Важкі задачі |
| 1024 | 0.667 | $0.0000000167 | CPU-intensive |

**Правило:** Більше memory = більше CPU = швидше виконання = **менше загальна вартість!**

---

## 🔍 Аналіз наших функцій

### Базові dependency розміри

**node_modules:** 317MB (але не все завантажується!)

**Основні залежності в runtime:**
```
@aws-sdk/client-dynamodb    ~30MB  (кешується!)
grammy                      ~10MB  (кешується!)
@grammyjs/conversations     ~3MB
@grammyjs/menu              ~2MB
node-html-parser            ~5MB
ics                         ~2MB
date-fns                    ~3MB
class-validator             ~4MB
Compiled code (dist)        ~1MB
Node.js runtime             ~50-70MB
```

**Завдяки module caching** більшість залежностей завантажується тільки при холодному старті!

---

## 📈 Рекомендації по функціях

### 1. **disconnectionCalendar**
**Рекомендовано: 256MB**

**Що робить:**
- ✅ DynamoDB GetItem (1 запит)
- ✅ Генерація ICS calendar
- ✅ Валідація query parameters

**Завантажує в пам'ять:**
- DynamoDBClient (кешується)
- DisconnectionService
- ICS generator
- ~100-150MB total

**Чому 256MB достатньо:**
- Проста операція: read + transform
- Мало CPU-intensive logic
- Швидкий response потрібен (<500ms)
- Warm invocation uses cache

**Очікуваний performance:**
- Cold start: ~800ms
- Warm: ~100-150ms

**Вартість (при 10,000 requests/month):**
```
Avg duration: 150ms
Memory: 256MB
Cost: 10,000 × 150ms × $0.0000000042 = $0.0063/month
```

---

### 2. **botWebhookHandler**
**Рекомендовано: 384MB**

**Що робить:**
- ✅ Grammy bot middleware chain
- ✅ Conversation state management
- ✅ DynamoDB reads/writes
- ✅ VOE API calls (іноді)
- ✅ Telegram API calls

**Завантажує в пам'ять:**
- DynamoDBClient (кешується)
- Bot instance + middlewares (кешується)
- Session state per user
- Conversation context
- ~150-200MB total

**Чому 384MB оптимально:**
- ⚡ Telegram вимагає відповіді <10 секунд
- 🧠 Grammy + conversations plugin = CPU-intensive
- 🔄 Module caching дає велику перевагу
- 💰 Sweet spot: достатньо CPU, не переплата

**Очікуваний performance:**
- Cold start: ~1200-1500ms
- Warm: ~100-200ms

**Вартість (при 50,000 requests/month):**
```
Avg duration: 180ms (warm) + occasional cold starts
Memory: 384MB
Cost: 50,000 × 180ms × $0.0000000063 = $0.057/month
```

**Альтернатива 256MB:**
- Slower execution: ~250-300ms warm
- Total cost може бути БІЛЬША: 50,000 × 300ms × $0.0000000042 = $0.063/month
- Гірший user experience

**Висновок:** 384MB дає кращий UX за ту саму ціну!

---

### 3. **prefetch**
**Рекомендовано: 512MB**

**Що робить:**
- ✅ Scan DynamoDB table (всі підписки)
- ✅ VOE API calls (багато, concurrent)
- ✅ HTML parsing (багато)
- ✅ DynamoDB updates
- ✅ Broadcast notifications

**Завантажує в пам'ять:**
- Всі modules (кешуються)
- Багато HTTP responses одночасно
- Багато HTML DOM trees
- ~200-300MB total

**Чому 512MB необхідно:**
- 🔥 Найважча функція
- 🌐 10-50 concurrent HTTP requests
- 🧮 HTML parsing CPU-intensive
- ⏱️ Не critical latency (background job)

**Очікуваний performance:**
```
50 адрес × (500ms fetch + 100ms parse) = ~30 секунд total
З 512MB CPU: може паралелити 5-10 запитів = ~10-15 секунд
```

**Вартість (запускається кожні 10 хвилин):**
```
Runs: 6 times/hour × 24 hours × 30 days = 4,320 invocations/month
Avg duration: 15,000ms
Memory: 512MB
Cost: 4,320 × 15,000ms × $0.0000000083 = $0.54/month
```

**Альтернатива 256MB:**
- Slower: ~30-40 секунд
- Cost: 4,320 × 35,000ms × $0.0000000042 = $0.64/month
- **Переплата $0.10/month + гірший performance!**

---

### 4. **broadcastMessage**
**Рекомендовано: 384MB**

**Що робить:**
- ✅ Scan DynamoDB users table
- ✅ Telegram API calls (багато sequential)
- ✅ Rate limit handling

**Завантажує в пам'ять:**
- Bot instance (кешується)
- User list in memory
- ~150-200MB

**Чому 384MB:**
- Середня складність
- Багато I/O, мало CPU
- Викликається рідко (manual)

**Вартість:** Мінімальна (рідкі виклики)

---

## 💰 Загальна вартість порівняння

### Сценарій: Середнє навантаження
- **disconnectionCalendar:** 10,000 req/month, 150ms avg
- **botWebhookHandler:** 50,000 req/month, 180ms avg
- **prefetch:** 4,320 runs/month, 15s avg
- **broadcastMessage:** 100 runs/month, 10s avg

### Конфігурація 1: Все 512MB
```
disconnectionCalendar: 10,000 × 150ms × $0.0000000083 = $0.012
botWebhookHandler:     50,000 × 180ms × $0.0000000083 = $0.075
prefetch:              4,320 × 15,000ms × $0.0000000083 = $0.54
broadcastMessage:      100 × 10,000ms × $0.0000000083 = $0.008
TOTAL: $0.635/month
```

### Конфігурація 2: Оптимізована (256/384/512/384)
```
disconnectionCalendar: 10,000 × 150ms × $0.0000000042 = $0.006
botWebhookHandler:     50,000 × 180ms × $0.0000000063 = $0.057
prefetch:              4,320 × 15,000ms × $0.0000000083 = $0.54
broadcastMessage:      100 × 10,000ms × $0.0000000063 = $0.006
TOTAL: $0.609/month
```

**Економія:** $0.026/month (4%)

**Але більш важливо:**
- ✅ Кращий performance на botWebhookHandler (critical path)
- ✅ Не переплата за просту disconnectionCalendar
- ✅ Правильний CPU allocation

---

## 🎯 Фінальні рекомендації

### Поточна конфігурація в serverless.yml ✅

```yaml
provider:
  memorySize: 256  # Default

functions:
  disconnectionCalendar:
    memorySize: 256  # ✅ Легка функція

  botWebhookHandler:
    memorySize: 384  # ✅ Sweet spot для Grammy bot

  prefetch:
    memorySize: 512  # ✅ Найважча функція

  broadcastMessage:
    memorySize: 384  # ✅ Середня складність
```

---

## 📊 Моніторинг в production

Після deployment моніторити CloudWatch Metrics:

### 1. Memory Usage
```sql
fields @timestamp, @memorySize, @maxMemoryUsed
| filter @type = "REPORT"
| stats
    max(@maxMemoryUsed) as peak_mb,
    avg(@maxMemoryUsed) as avg_mb,
    pct(@maxMemoryUsed, 95) as p95_mb
  by @functionName
```

**Red flags:**
- Peak близько до limit → збільшити memory
- Peak < 50% limit → зменшити memory

### 2. Duration Tracking
```sql
fields @timestamp, @duration, @memorySize
| filter @type = "REPORT"
| stats
    avg(@duration) as avg_ms,
    pct(@duration, 95) as p95_ms
  by @memorySize, @functionName
```

### 3. Cost per Function
```sql
fields @timestamp, @duration, @memorySize, @billedDuration
| filter @type = "REPORT"
| stats
    sum(@billedDuration) as total_ms,
    count() as invocations
  by @functionName
| extend cost_usd = total_ms * @memorySize * 0.0000000001 / 128
```

---

## 🧪 A/B Testing Memory

Якщо хочете експериментувати:

```yaml
# Зробити 2 версії функції з різною пам'яттю
botWebhookHandlerV1:
  memorySize: 256
  events:
    - httpApi:
        path: /tg-webhook-handler-v1
        method: post

botWebhookHandlerV2:
  memorySize: 384
  events:
    - httpApi:
        path: /tg-webhook-handler-v2
        method: post
```

Направити 50% трафіку на кожну версію і порівняти:
- Duration (CloudWatch)
- Cost (billing)
- User experience (якщо можливо)

---

## 📚 Ресурси

- [AWS Lambda Pricing](https://aws.amazon.com/lambda/pricing/)
- [Lambda Power Tuning Tool](https://github.com/alexcasalboni/aws-lambda-power-tuning)
- [Optimizing Lambda Memory](https://docs.aws.amazon.com/lambda/latest/operatorguide/computing-power.html)

---

**Версія:** 1.0.0
**Дата:** 2025-10-22
**Статус:** ✅ Оптимізовано
