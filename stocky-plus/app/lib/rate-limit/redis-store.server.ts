import IORedis from "ioredis";
import { requireRedisUrl } from "../../jobs/queue.server";
import type { RateLimitStore } from "./rate-limit.server";

const KEY_PREFIX = "propo:rate-limit:";

/** Longest a request waits on Redis before the limiter gives up. */
const COMMAND_TIMEOUT_MS = 250;

// INCR and the expiry must be one step: a counter left without a TTL would
// block its key forever.
const HIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if count == 1 or ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
`;

type EvalClient = Pick<IORedis, "eval">;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`rate limit store timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function createRedisRateLimitStore(client: EvalClient): RateLimitStore {
  return {
    async hit(key, windowMs) {
      const reply = await withTimeout(
        client.eval(HIT_SCRIPT, 1, KEY_PREFIX + key, String(windowMs)),
        COMMAND_TIMEOUT_MS,
      );
      if (
        !Array.isArray(reply) ||
        typeof reply[0] !== "number" ||
        typeof reply[1] !== "number"
      ) {
        throw new Error("rate limit store returned an unexpected reply");
      }
      return { count: reply[0], resetInMs: reply[1] };
    },
  };
}

let sharedStore: RateLimitStore | null = null;

/**
 * Store on the app's Redis. It uses its own connection: the queue connection
 * retries commands without limit, which would hold web requests open during a
 * Redis outage.
 */
export function getRedisRateLimitStore(): RateLimitStore {
  if (!sharedStore) {
    const client = new IORedis(requireRedisUrl(), { maxRetriesPerRequest: 1 });
    // Connection errors surface on each command; without a listener ioredis
    // also prints every reconnect failure.
    client.on("error", () => {});
    sharedStore = createRedisRateLimitStore(client);
  }
  return sharedStore;
}
