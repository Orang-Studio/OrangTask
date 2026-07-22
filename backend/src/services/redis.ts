import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  reconnectOnError: (err) => {
    console.error('Redis reconnect on error:', err.message)
    return true
  },
})

redis.on('connect', () => console.log('Redis connected'))
redis.on('error', (err) => console.error('Redis error:', err.message))

export default redis
