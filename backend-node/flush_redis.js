const Redis = require('ioredis');

async function flush() {
  console.log("Connecting to Redis...");
  const redis = new Redis("rediss://default:gQAAAAAAAVYOAAIgcDJiMzBjZmJiZmZmN2I0ZmViYTBmM2U3ZDFiOTU4M2RlYQ@merry-vervet-87566.upstash.io:6379");

  console.log("Flushing all keys...");
  await redis.flushdb();

  console.log("Redis flushed successfully!");
  process.exit(0);
}

flush().catch(console.error);