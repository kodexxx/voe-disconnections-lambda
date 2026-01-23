# VOE Proxy Service

Мікросервіс на Fastify для обробки запитів через FlareSolverr.

## Призначення

- Обходить Cloudflare та інші анти-бот захисти
- Надає простий HTTP API для основного VOE додатку
- Ізольований сервіс, легко масштабувати

## API Endpoints

### GET /disconnections

Отримати графік відключень для адреси через session pool.

**Query Parameters:**
- `cityId` - ID міста
- `streetId` - ID вулиці
- `houseId` - ID будинку

**Response:**
```json
{
  "success": true,
  "sessionId": "session-3",
  "data": [
    {
      "from": "2026-01-22T00:00:00.000Z",
      "to": "2026-01-22T01:00:00.000Z",
      "possibility": "(точно)"
    }
  ]
}
```

### GET /autocomplete/city

Автокомпліт міст.

**Query Parameters:**
- `q` - пошуковий запит

**Response:**
```json
{
  "success": true,
  "sessionId": "session-5",
  "cities": [
    { "id": "510100000", "name": "м.. Вінниця" }
  ]
}
```

### GET /autocomplete/street

Автокомпліт вулиць.

**Query Parameters:**
- `cityId` - ID міста
- `q` - пошуковий запит

### GET /autocomplete/house

Автокомпліт будинків.

**Query Parameters:**
- `streetId` - ID вулиці
- `q` - пошуковий запит

### GET /health

Перевірка здоров'я сервісу.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-22T12:00:00.000Z"
}
```

### GET /pool/stats

Статистика session pool.

**Response:**
```json
{
  "isInitialized": true,
  "initializationProgress": 100,
  "poolSize": 10,
  "activeSessions": 10,
  "sessions": [
    {
      "id": "session-0",
      "proxy": "http://proxy1.com:8080",
      "lifetime": "1234s",
      "requestCount": 45,
      "failCount": 2,
      "status": "live",
      "lastUsed": "2026-01-22T12:00:00.000Z"
    }
  ]
}
```

## Запуск

### Development

```bash
# Встановити залежності
npm install

# Запустити в dev режимі
npm run dev:proxy
```
