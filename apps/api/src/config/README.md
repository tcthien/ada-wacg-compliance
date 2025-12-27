# Configuration

This directory contains configuration modules for the ADAShield API server.

## Redis Configuration

### Overview

The Redis configuration module provides a singleton Redis client with connection pooling, automatic reconnection, and error handling.

### Usage

```typescript
import { getRedisClient, checkRedisHealth, closeRedisConnection } from './config/redis.js';

// Get Redis client instance
const redis = getRedisClient();

// Set a value with expiration
await redis.set('key', 'value', 'EX', 3600);

// Get a value
const value = await redis.get('key');

// Check Redis health
const health = await checkRedisHealth();
console.log(health.status); // 'healthy' or 'unhealthy'

// Close connection gracefully (e.g., on shutdown)
await closeRedisConnection();
```

### Environment Variables

Configure Redis connection using the `REDIS_URL` environment variable:

```bash
# Format: redis://[:password@]host[:port][/db]
REDIS_URL=redis://localhost:6379/0

# With authentication
REDIS_URL=redis://:mypassword@localhost:6379/0

# With custom database
REDIS_URL=redis://localhost:6379/1
```

If `REDIS_URL` is not set, the client defaults to `localhost:6379/0`.

### Connection Features

- **Connection Pooling**: Optimized for concurrent requests
- **Auto-Reconnection**: Automatic reconnection with exponential backoff
- **Error Handling**: Comprehensive error logging and recovery
- **Health Checks**: Built-in health check for monitoring
- **Graceful Shutdown**: Clean connection closure on process termination

### Redis Key Constants

Use the centralized Redis key patterns from `shared/constants/redis-keys.ts`:

```typescript
import { RedisKeys } from '../shared/constants/redis-keys.js';

// Build rate limit key
const rateLimitKey = RedisKeys.RATE_LIMIT.build('192.168.1.1');
await redis.set(rateLimitKey, '10', 'EX', RedisKeys.RATE_LIMIT.ttl);

// Build scan status key
const scanStatusKey = RedisKeys.SCAN_STATUS.build('scan-123');
await redis.set(scanStatusKey, 'in_progress', 'EX', RedisKeys.SCAN_STATUS.ttl);

// Build session key
const sessionKey = RedisKeys.SESSION.build('session-abc');
await redis.set(sessionKey, JSON.stringify({ userId: '123' }), 'EX', RedisKeys.SESSION.ttl);
```

### Development with Docker

Start Redis using Docker Compose:

```bash
# Start Redis service
docker-compose up -d redis

# View Redis logs
docker-compose logs -f redis

# Stop Redis service
docker-compose down
```

### Health Monitoring

The `/api/v1/health` endpoint includes Redis health status:

```bash
curl http://localhost:3001/api/v1/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-12-25T22:00:00.000Z",
  "environment": "development",
  "version": "0.1.0",
  "services": {
    "redis": {
      "status": "healthy",
      "message": "Redis connection is healthy",
      "latency": 5
    }
  }
}
```

### Troubleshooting

**Connection Refused**
- Ensure Redis is running: `docker-compose ps redis`
- Check Redis URL: `echo $REDIS_URL`

**Authentication Required**
- Add password to REDIS_URL: `redis://:password@host:port/db`
- Check Redis config: `redis-cli CONFIG GET requirepass`

**High Latency**
- Monitor connection pool: Check logs for reconnection events
- Verify network connectivity: `redis-cli -h localhost -p 6379 ping`
