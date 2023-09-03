import { createClient } from 'redis';

class RedisClient {
  constructor() {
    this.client = createClient();
    this.client.on('error', (err) => {
      console.error(err);
    });
  }

  isAlive() {
    return new Promise((resolve) => {
      this.client.ping((err) => {
        if (err) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  async get(key) {
    const value = await this.client.get(key);
    return value;
  }

  async set(key, value, duration) {
    await this.client.setex(key, duration, value);
  }

  async del(key) {
    await this.client.del(key);
  }
}

const redisClient = new RedisClient();
module.exports = redisClient;
