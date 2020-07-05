import {ClientOpts, createClient, RedisClient} from 'redis';

export interface HealthService {
  name(): string;
  build(data: Map<string, any>, error: any): Map<string, any>;
  check(): Promise<Map<string, any>>;
}

export interface CacheService<K, V> {
  isEnabled?(): boolean;
  put(key: K, obj: V, expiresInSeconds?: number): Promise<boolean>;
  expire(key: K, timeToLive: number): Promise<boolean>;
  get(key: K): Promise<V>;
  getMany(keys: K[]): Promise<V[]>;
  containsKey(key: K): Promise<boolean>;
  remove(key: K): Promise<boolean>;
  clear(): Promise<boolean>;
  keys?(): Promise<string[]>;
  count?(): Promise<number>;
  size?(): Promise<number>;
}

export function createRedisClient(url: string, options?: ClientOpts): RedisClient {
  const redisClient = createClient(url, options);
  redisClient.on('ready', () => {
    console.log('Connected successfully to Redis server');
  });
  redisClient.on('error', (err) => {
    console.warn(err.message);
  });
  return redisClient;
}

export function ping(client: RedisClient): Promise<string> {
  return new Promise((resolve, reject) => {
    client.ping((err, result) => err ? reject(err) : resolve(result));
  });
}

export function set(client: RedisClient, key: string, value: string, expiresInSeconds?: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (!expiresInSeconds || expiresInSeconds <= 0) {
      client.set(key, value, (err, result) => err ? reject(err) : resolve(result === 'OK'));
    } else {
      client.set(key, value, 'EX', expiresInSeconds, (err, result) => err ? reject(err) : resolve(result === 'OK'));
    }
  });
}

export function expire(client: RedisClient, key: string, expiresInseconds: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    return client.expire(key, expiresInseconds, (err, result) => err ? reject(err) : resolve(result !== 0));
  });
}

export function get(client: RedisClient, key: string): Promise<string> {
  return new Promise((resolve, reject) => {
    client.get(key, (err, result) => err ? reject(err) : resolve(result));
  });
}

export function getMany(client: RedisClient, arr: string[]): Promise<string[]> {
  return new Promise(((resolve, reject) => {
    client.mget(arr, (err, result) => err ? reject(err) : resolve(result));
  }));
}

export function exists(client: RedisClient, key: string): Promise<boolean> {
  return new Promise(((resolve, reject) => {
    client.exists(key, (err, result) => err ? reject(err) : resolve(result === 1));
  }));
}

export function deleteKey(client: RedisClient, key: string): Promise<boolean> {
  return new Promise(((resolve, reject) => {
    client.del(key, (err, result) => err ? reject(err) : resolve(result === 1));
  }));
}

export function clear(client: RedisClient): Promise<boolean> {
  return new Promise(((resolve, reject) => {
    client.flushdb((err, result) => err ? reject(err) : resolve(result === 'OK'));
  }));
}

export function keys(client: RedisClient): Promise<string[]> {
  return new Promise((resolve, reject) => {
    client.keys('*', (err, result) => err ? reject(err) : resolve(result));
  });
}

export function count(client: RedisClient): Promise<number> {
  return new Promise((resolve, reject) => {
    client.dbsize((err, result) => err ? reject(err) : resolve(result));
  });
}

export class RedisHealthService implements HealthService {
  constructor(public client: RedisClient, private service?: string, private timeout?: number) {
    if (!this.timeout) {
      this.timeout = 5000;
    }
    if (!this.service) {
      this.service = 'mongo';
    }
    this.check = this.check.bind(this);
    this.name = this.name.bind(this);
    this.build = this.build.bind(this);
    this.promiseTimeOut = this.promiseTimeOut.bind(this);
  }

  name(): string {
    return this.service;
  }
  check(): Promise<Map<string, any>> {
    const promise = new Promise<Map<string, any>>((resolve, reject) => {
      this.client.ping((err, result) => err ? reject(err) : resolve(new Map<string, any>()));
    });
    if (this.timeout > 0) {
      return this.promiseTimeOut(this.timeout, promise);
    } else {
      return promise;
    }
  }
  build(data: Map<string, any>, err: any): Map<string, any> {
    if (err) {
      data.set('error', err);
    }
    return data;
  }

  private promiseTimeOut(timeoutInMilliseconds: number, promise: Promise<Map<string, any>>): Promise<Map<string, any>> {
    return Promise.race([
      promise,
      new Promise<Map<string, any>>((resolve, reject) => {
        setTimeout(() => {
          reject(`Timed out in: ${timeoutInMilliseconds} milliseconds!`);
        }, timeoutInMilliseconds);
      })
    ]);
  }
}

export class RedisService implements CacheService<string, string> {
  private enabled: boolean;
  constructor(public client: RedisClient) {
    this.enabled = client.connected;
    client.on('end', () => {
      console.log('RedisService will not be working because the connection has closed.');
      this.enabled = false;
    });
    client.on('ready', () => {
      console.log('The connection is established and RedisService is working now.');
      this.enabled = true;
    });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  put(key: string, value: string, expiresInSeconds?: number): Promise<boolean> {
    if (!this.isEnabled()) {
      return Promise.reject(false);
    }
    return set(this.client, key, value, expiresInSeconds);
  }
  expire(key: string, timeToLive: number): Promise<boolean> {
    return expire(this.client, key, timeToLive);
  }

  get(key: string): Promise<string> {
    if (this.isEnabled()) {
      return get(this.client, key);
    } else {
      return new Promise((resolve, reject) => resolve(null));
    }
  }

  getMany(arr: string[]): Promise<string[]> {
    if (this.isEnabled()) {
      return getMany(this.client, arr);
    } else {
      const res = Array.apply(null, new Array(arr.length));
      return res;
    }
  }

  containsKey(key: string): Promise<boolean> {
    return exists(this.client, key);
  }

  remove(key: string): Promise<boolean> {
    return deleteKey(this.client, key);
  }

  clear(): Promise<boolean> {
    return clear(this.client);
  }
  keys(): Promise<string[]> {
    return keys(this.client);
  }
  count(): Promise<number> {
    return count(this.client);
  }
}
