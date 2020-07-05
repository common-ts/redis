"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = exports.RedisHealthService = exports.count = exports.keys = exports.clear = exports.deleteKey = exports.exists = exports.getMany = exports.get = exports.expire = exports.set = exports.ping = exports.createRedisClient = void 0;
var redis_1 = require("redis");
function createRedisClient(url, options) {
  var redisClient = redis_1.createClient(url, options);
  redisClient.on('ready', function () {
    console.log('Connected successfully to Redis server');
  });
  redisClient.on('error', function (err) {
    console.warn(err.message);
  });
  return redisClient;
}
exports.createRedisClient = createRedisClient;
function ping(client) {
  return new Promise(function (resolve, reject) {
    client.ping(function (err, result) { return err ? reject(err) : resolve(result); });
  });
}
exports.ping = ping;
function set(client, key, value, expiresInSeconds) {
  return new Promise(function (resolve, reject) {
    if (!expiresInSeconds || expiresInSeconds <= 0) {
      client.set(key, value, function (err, result) { return err ? reject(err) : resolve(result === 'OK'); });
    }
    else {
      client.set(key, value, 'EX', expiresInSeconds, function (err, result) { return err ? reject(err) : resolve(result === 'OK'); });
    }
  });
}
exports.set = set;
function expire(client, key, expiresInseconds) {
  return new Promise(function (resolve, reject) {
    return client.expire(key, expiresInseconds, function (err, result) { return err ? reject(err) : resolve(result !== 0); });
  });
}
exports.expire = expire;
function get(client, key) {
  return new Promise(function (resolve, reject) {
    client.get(key, function (err, result) { return err ? reject(err) : resolve(result); });
  });
}
exports.get = get;
function getMany(client, arr) {
  return new Promise((function (resolve, reject) {
    client.mget(arr, function (err, result) { return err ? reject(err) : resolve(result); });
  }));
}
exports.getMany = getMany;
function exists(client, key) {
  return new Promise((function (resolve, reject) {
    client.exists(key, function (err, result) { return err ? reject(err) : resolve(result === 1); });
  }));
}
exports.exists = exists;
function deleteKey(client, key) {
  return new Promise((function (resolve, reject) {
    client.del(key, function (err, result) { return err ? reject(err) : resolve(result === 1); });
  }));
}
exports.deleteKey = deleteKey;
function clear(client) {
  return new Promise((function (resolve, reject) {
    client.flushdb(function (err, result) { return err ? reject(err) : resolve(result === 'OK'); });
  }));
}
exports.clear = clear;
function keys(client) {
  return new Promise(function (resolve, reject) {
    client.keys('*', function (err, result) { return err ? reject(err) : resolve(result); });
  });
}
exports.keys = keys;
function count(client) {
  return new Promise(function (resolve, reject) {
    client.dbsize(function (err, result) { return err ? reject(err) : resolve(result); });
  });
}
exports.count = count;
var RedisHealthService = (function () {
  function RedisHealthService(client, service, timeout) {
    this.client = client;
    this.service = service;
    this.timeout = timeout;
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
  RedisHealthService.prototype.name = function () {
    return this.service;
  };
  RedisHealthService.prototype.check = function () {
    var _this = this;
    var promise = new Promise(function (resolve, reject) {
      _this.client.ping(function (err, result) { return err ? reject(err) : resolve(new Map()); });
    });
    if (this.timeout > 0) {
      return this.promiseTimeOut(this.timeout, promise);
    }
    else {
      return promise;
    }
  };
  RedisHealthService.prototype.build = function (data, err) {
    if (err) {
      data.set('error', err);
    }
    return data;
  };
  RedisHealthService.prototype.promiseTimeOut = function (timeoutInMilliseconds, promise) {
    return Promise.race([
      promise,
      new Promise(function (resolve, reject) {
        setTimeout(function () {
          reject("Timed out in: " + timeoutInMilliseconds + " milliseconds!");
        }, timeoutInMilliseconds);
      })
    ]);
  };
  return RedisHealthService;
}());
exports.RedisHealthService = RedisHealthService;
var RedisService = (function () {
  function RedisService(client) {
    var _this = this;
    this.client = client;
    this.enabled = client.connected;
    client.on('end', function () {
      console.log('RedisService will not be working because the connection has closed.');
      _this.enabled = false;
    });
    client.on('ready', function () {
      console.log('The connection is established and RedisService is working now.');
      _this.enabled = true;
    });
  }
  RedisService.prototype.isEnabled = function () {
    return this.enabled;
  };
  RedisService.prototype.put = function (key, value, expiresInSeconds) {
    if (!this.isEnabled()) {
      return Promise.reject(false);
    }
    return set(this.client, key, value, expiresInSeconds);
  };
  RedisService.prototype.expire = function (key, timeToLive) {
    return expire(this.client, key, timeToLive);
  };
  RedisService.prototype.get = function (key) {
    if (this.isEnabled()) {
      return get(this.client, key);
    }
    else {
      return new Promise(function (resolve, reject) { return resolve(null); });
    }
  };
  RedisService.prototype.getMany = function (arr) {
    if (this.isEnabled()) {
      return getMany(this.client, arr);
    }
    else {
      var res = Array.apply(null, new Array(arr.length));
      return res;
    }
  };
  RedisService.prototype.containsKey = function (key) {
    return exists(this.client, key);
  };
  RedisService.prototype.remove = function (key) {
    return deleteKey(this.client, key);
  };
  RedisService.prototype.clear = function () {
    return clear(this.client);
  };
  RedisService.prototype.keys = function () {
    return keys(this.client);
  };
  RedisService.prototype.count = function () {
    return count(this.client);
  };
  return RedisService;
}());
exports.RedisService = RedisService;
