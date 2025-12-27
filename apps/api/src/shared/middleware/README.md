# Middleware Documentation

This directory contains middleware components for the ADAShield API.

## Available Middleware

- [Session Middleware](#session-middleware) - Guest session management
- [Rate Limiting Middleware](#rate-limiting-middleware) - Per-URL rate limiting

---

# Session Middleware

Guest session management for the ADAShield API via secure HTTP-only cookies.

## Features

- **Secure Token Generation**: 32-byte random tokens encoded as base64url
- **Redis Caching**: 1-hour TTL with automatic cache invalidation
- **Fingerprint Validation**: Device fingerprinting for session correlation
- **24-Hour Expiration**: Automatic session expiration
- **GDPR Compliance**: Supports session anonymization

## Usage

### Register Global Middleware

Apply session middleware to all routes:

```typescript
import { sessionMiddleware } from './shared/middleware/session.js';

// Register as global preHandler
server.addHook('preHandler', sessionMiddleware);
```

### Access Session in Route Handlers

```typescript
server.get('/api/v1/scans', async (request, reply) => {
  // Session is automatically attached to request
  if (!request.guestSession) {
    return reply.code(401).send({
      error: 'Session required',
    });
  }

  const { id, fingerprint } = request.guestSession;

  // Use session for database queries
  const scans = await prisma.scan.findMany({
    where: {
      guestSessionId: id,
    },
  });

  return { scans };
});
```

### Require Session for Specific Routes

Use `requireSession` middleware for routes that require authentication:

```typescript
import { requireSession } from './shared/middleware/session.js';

server.post(
  '/api/v1/scans',
  {
    preHandler: [requireSession],
  },
  async (request, reply) => {
    // Session is guaranteed to exist here
    const sessionId = request.guestSession!.id;

    // Create scan with session
    const scan = await prisma.scan.create({
      data: {
        guestSessionId: sessionId,
        url: request.body.url,
        email: request.body.email,
      },
    });

    return { scan };
  }
);
```

## Session Flow

### First Request (No Cookie)

1. Middleware detects no session cookie
2. Generates new 32-byte random token
3. Creates device fingerprint from request headers
4. Creates `GuestSession` in database
5. Caches session in Redis (1-hour TTL)
6. Sets secure HTTP-only cookie (`adashield_session`)
7. Attaches session to `request.guestSession`

### Subsequent Requests (With Cookie)

1. Middleware reads session token from cookie
2. Checks Redis cache first (fast path)
3. If not in cache, queries database
4. Validates session:
   - Not expired (`expiresAt > now`)
   - Not anonymized (`anonymizedAt === null`)
   - Fingerprint matches (logs warning if mismatch)
5. Attaches session to `request.guestSession`

### Session Expiration

Sessions expire after 24 hours. The middleware automatically:
- Generates new session for expired tokens
- Sets new cookie with fresh expiration
- Logs session rotation events

## Cookie Configuration

```typescript
{
  httpOnly: true,           // Prevents JavaScript access
  secure: true,             // HTTPS only (production)
  sameSite: 'strict',       // CSRF protection
  maxAge: 86400,            // 24 hours in seconds
  path: '/'                 // All routes
}
```

## Fingerprint Components

Device fingerprints are generated from request headers:

- `User-Agent`: Browser and OS information
- `Accept-Language`: Language preferences
- `Accept-Encoding`: Compression support

Combined hash provides semi-stable device identifier (16 hex characters).

## Error Handling

The middleware is designed to be non-blocking:

- Database failures: Logs error, continues without session
- Cache failures: Falls back to database, continues without cache
- Invalid tokens: Generates new session
- Fingerprint mismatch: Logs warning, continues with session

For routes requiring sessions, use `requireSession` middleware to enforce.

## Security Considerations

### Token Security

- 32 bytes of entropy (256 bits)
- Base64url encoding (URL-safe)
- Cryptographically secure random generation
- HTTP-only cookies prevent XSS theft

### Fingerprint Limitations

- **Not cryptographically secure**: Can be spoofed
- **Not for authentication**: Used for correlation only
- **May change legitimately**: Browser updates, language changes
- **Privacy-friendly**: No persistent tracking identifiers

### GDPR Compliance

Sessions support anonymization via `anonymizedAt` field:

```typescript
// Anonymize session on user request
await prisma.guestSession.update({
  where: { id: sessionId },
  data: { anonymizedAt: new Date() },
});
```

Anonymized sessions are rejected by the middleware.

## Performance

- **Redis caching**: Sub-millisecond session lookup
- **Database fallback**: ~5-10ms session lookup
- **Token generation**: <1ms
- **Fingerprint hashing**: <1ms

## Monitoring

The middleware logs:

- Session creation events
- Fingerprint mismatches (potential security concern)
- Database/cache errors
- Session validation failures

Monitor logs for unusual patterns:
- High rate of session creation (potential attack)
- Frequent fingerprint mismatches (user behavior or spoofing)
- Database connection failures

## Testing

See `session.test.ts` for unit tests covering:

- Session creation
- Session validation
- Error handling
- Cookie setting
- Fingerprint generation

## Related Files

- `session.ts` - Session middleware implementation
- `fingerprint.ts` - Device fingerprint utilities
- `fingerprint.test.ts` - Fingerprint unit tests
- `session.test.ts` - Session middleware tests
- `../../config/database.ts` - Prisma client configuration
- `../../config/redis.ts` - Redis client configuration

---

# Rate Limiting Middleware

Per-URL rate limiting for guest users to prevent abuse and ensure fair usage.

## Features

- **URL-Based Limiting**: 10 scans per hour per URL + fingerprint combination
- **Redis Storage**: Counter storage with automatic TTL expiration
- **Standard Headers**: X-RateLimit-* headers and Retry-After
- **Graceful Degradation**: Fails open if Redis unavailable
- **URL Normalization**: Case-insensitive and trimmed URLs
- **Configurable**: Custom URL parameter names supported

## Configuration

```typescript
export const RATE_LIMIT_CONFIG = {
  MAX_REQUESTS: 10,        // Maximum requests per window
  WINDOW_SECONDS: 3600,    // Window duration (1 hour)
} as const;
```

## Usage

### Basic Usage (Default)

Apply to scan endpoint with default 'url' parameter:

```typescript
import { sessionMiddleware } from './shared/middleware/session.js';
import { rateLimitMiddleware } from './shared/middleware/rate-limit.js';

server.post(
  '/api/v1/scan',
  {
    preHandler: [sessionMiddleware, rateLimitMiddleware],
  },
  async (request, reply) => {
    // Rate limit already checked
    // Headers automatically set: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset

    const { url } = request.body;
    // Process scan...
    return { scanId: '123' };
  }
);
```

### Custom URL Parameter

Use custom parameter name:

```typescript
import { createRateLimitMiddleware } from './shared/middleware/rate-limit.js';

const customRateLimit = createRateLimitMiddleware('targetUrl');

server.post(
  '/api/v1/custom-scan',
  {
    preHandler: [sessionMiddleware, customRateLimit],
  },
  async (request, reply) => {
    const { targetUrl } = request.body;
    // Process scan...
  }
);
```

### Query Parameter Support

Works with query parameters too:

```typescript
server.get(
  '/api/v1/quick-scan',
  {
    preHandler: [sessionMiddleware, rateLimitMiddleware],
  },
  async (request, reply) => {
    // Rate limit checks request.query.url
    const { url } = request.query;
    // Process scan...
  }
);
```

## Response Headers

### Successful Request

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1640000000
```

### Rate Limit Exceeded

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1640000000
Retry-After: 1800

{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Maximum 10 scans per hour per URL.",
  "retryAfter": 1800
}
```

## Rate Limiting Strategy

### Key Generation

Rate limits are enforced per **URL + fingerprint** combination:

```typescript
// Redis key format: rate_limit_url:{url_hash}:{fingerprint}
// Example: rate_limit_url:a1b2c3d4e5f6g7h8:test-fingerprint
```

### URL Normalization

URLs are normalized for consistent rate limiting:

```typescript
// All these URLs produce the same hash
'https://example.com'
'HTTPS://EXAMPLE.COM'
'  https://example.com  '
```

### Sliding Window

- **Window**: 1 hour (3600 seconds)
- **Limit**: 10 requests per window
- **TTL**: Automatic expiration after 1 hour
- **Reset**: Counter resets when TTL expires

## Error Handling

### Fail Open Strategy

If Redis is unavailable, the middleware **allows the request** to prevent service disruption:

```typescript
// Redis connection failed
// → Log error
// → Allow request (fail open)
// → Continue processing
```

### Error Scenarios

| Scenario | Behavior | User Impact |
|----------|----------|-------------|
| Redis unavailable | Allow request | None - service continues |
| Redis timeout | Allow request | None - service continues |
| Invalid URL format | Skip rate limiting | None - processed normally |
| Missing URL | Skip rate limiting | None - processed normally |

## Security Considerations

### Fingerprint-Based Limiting

- **Why**: Prevents single user from scanning same URL repeatedly
- **How**: Combines URL hash with device fingerprint
- **Limitation**: Users can bypass by changing fingerprint (different browser/device)

### URL Hashing

- **Algorithm**: SHA-256 (first 16 characters)
- **Purpose**: Consistent key generation, privacy-friendly
- **Security**: Not cryptographically critical (rate limiting only)

### Redis Key Expiration

```typescript
// Automatic cleanup prevents unbounded growth
await redis.expire(key, 3600); // 1 hour TTL
```

## Performance

- **Cache Lookup**: Sub-millisecond (Redis GET)
- **Counter Increment**: ~1ms (Redis INCR + EXPIRE pipeline)
- **TTL Check**: Sub-millisecond (Redis TTL)
- **Hash Generation**: <1ms (SHA-256)
- **Total Overhead**: ~2-5ms per request

## Monitoring

### Key Metrics

Monitor these patterns in logs:

```typescript
// Rate limit exceeded events
'Rate limit exceeded for URL: https://example.com'

// Redis errors (should be rare)
'Rate limit read error: Connection refused'
'Rate limit increment error: Timeout'
'Rate limit TTL error: Connection reset'
```

### Redis Key Patterns

Monitor Redis for rate limit keys:

```bash
# Count active rate limits
redis-cli KEYS "rate_limit_url:*" | wc -l

# Check specific URL rate limit
redis-cli GET "rate_limit_url:a1b2c3d4e5f6g7h8:fingerprint123"
```

## Testing

See `rate-limit.test.ts` for comprehensive unit tests covering:

- ✅ Allow request under rate limit
- ✅ Block request when limit exceeded
- ✅ First request (no existing count)
- ✅ Skip when no URL provided
- ✅ URL from query parameter
- ✅ Custom URL parameter name
- ✅ URL normalization
- ✅ Redis error handling (fail open)
- ✅ Pipeline error handling
- ✅ TTL error handling
- ✅ Correct reset time calculation
- ✅ Exact rate limit enforcement (10 requests)
- ✅ Different rate limits per URL
- ✅ Correct TTL on key creation

## Related Files

- `rate-limit.ts` - Rate limiting middleware implementation
- `rate-limit.test.ts` - Comprehensive unit tests
- `session.ts` - Session middleware (provides fingerprint)
- `../utils/fingerprint.ts` - Device fingerprint generation
- `../constants/redis-keys.ts` - Redis key patterns
- `../../config/redis.ts` - Redis client configuration

## Examples

### Production Deployment

```typescript
// High-traffic production setup
import { createRateLimitMiddleware } from './shared/middleware/rate-limit.js';

// Different limits for different endpoints
const scanRateLimit = createRateLimitMiddleware('url');
const quickScanRateLimit = createRateLimitMiddleware('url'); // Same limit

server.post('/api/v1/scan', { preHandler: [scanRateLimit] }, scanHandler);
server.post('/api/v1/quick-scan', { preHandler: [quickScanRateLimit] }, quickScanHandler);
```

### Testing Rate Limits

```bash
# Test rate limit with curl
for i in {1..12}; do
  echo "Request $i"
  curl -X POST http://localhost:3000/api/v1/scan \
    -H "Content-Type: application/json" \
    -d '{"url":"https://example.com"}' \
    -v 2>&1 | grep -E "(< HTTP|X-RateLimit|429)"
  sleep 1
done

# Expected output:
# Requests 1-10: 200 OK with X-RateLimit-Remaining decreasing
# Request 11+: 429 Too Many Requests with Retry-After header
```
