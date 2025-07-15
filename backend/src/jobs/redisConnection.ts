import { URL } from 'url';

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL environment variable is not defined!");
}

const redisUrl = new URL(process.env.REDIS_URL);

export const redisConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port),
  // If your Redis instance had a password, you'd parse it here too:
  // password: redisUrl.password
};