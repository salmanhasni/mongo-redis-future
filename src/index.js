const _ = require('underscore');
const Redis = require('./redis');
const { redisInsert, redisRemove, redisUpdate } = Redis;


let Future;
try {
  Future = require("fibers/future");
}
catch (e) {
  Future = null;
}

function cursorFetch() {
  const waitForFind = new Future();
  this.toArray()
  .then(arr => waitForFind.return(arr))
  .catch(err => waitForFind.throw(err));
  return waitForFind.wait();
}

function cursorForEach(fn) {
  const waitForFind = new Future();
  this.forEach(fn)
  .then(arr => waitForFind.return(arr))
  .catch(err => waitForFind.throw(err));
  return waitForFind.wait();
}

function cursorMap(fn) {
  const waitForFind = new Future();
  this.map(fn).toArray()
  .then(arr => waitForFind.return(arr))
  .catch(err => waitForFind.throw(err));
  return waitForFind.wait();
}

function cursorCount(fn) {
  const waitForFind = new Future();
  this.count(fn)
  .then(arr => waitForFind.return(arr))
  .catch(err => waitForFind.throw(err));
  return waitForFind.wait();
}

/* eslint-disable import/prefer-default-export */
class MongoCollection {
  constructor(collectionName, mongoDb, redisDb, { nativeSync = false } = {}) {
    this._collectionName = collectionName;
    this._mongoDb = mongoDb;
    this._redisDb = redisDb;
    this.nativeSync = nativeSync;
  }

  // TODO: for both of these we need to handle if the connection has died.
  _getDbSync() {
    return this._mongoDb;
  }

  _getDb() {
    return Promise.resolve(this._mongoDb);
  }

  _find(selector, options = {}) {
    const db = this._getDbSync();
    let cursor = db.collection(this._collectionName).find(selector, options || {});
    if (options.sort) {
      cursor = cursor.sort(options.sort);
    }
    if (options.skip) {
      cursor.skip(options.skip);
    }
    if (options.limit) {
      cursor.limit(options.limit);
    }

    cursor.toArraySync = cursorFetch.bind(cursor);
    cursor.fetchSync = cursorFetch.bind(cursor);
    cursor.fetchSync = cursorFetch.bind(cursor);
    cursor.forEachSync = cursorForEach.bind(cursor);
    cursor.mapSync = cursorMap.bind(cursor);
    cursor.countSync = cursorCount.bind(cursor);

    if (this.nativeSync) {
      cursor.fetch = cursor.fetchSync;
      cursor.map = cursor.mapSync;
    }

    return cursor;
  }

  findOneSync(selector, options = {}) {
    return this._find(selector, _.extend(options, { limit: 1 })).toArraySync()[0];
  }

  updateSync(selector, modifier, options) {
    const waitForUpsert = new Future();
    this._update(selector, modifier, options)
    .then(res => waitForUpsert.return(res))
    .catch(err => waitForUpsert.throw(err));
    return waitForUpsert.wait();
  }

  insertSync(doc) {
    const waitForInsert = new Future();
    this._insert(doc)
    .then(res => waitForInsert.return(res.ops))
    .catch(err => waitForInsert.throw(err));
    return waitForInsert.wait();
  }

  removeSync(selector) {
    const waitForRemove = new Future();
    this._remove(selector)
    .then(res => waitForRemove.return(res))
    .catch(err => waitForRemove.throw(err));
    return waitForRemove.wait();
  }

  aggregateSync(pipeline) {
    const waitForAggregate = new Future();
    this._aggregate(pipeline)
    .then(res => waitForAggregate.return(res))
    .catch(err => waitForAggregate.throw(err));
    return waitForAggregate.wait();
  }

  _aggregate(pipeline) {
    const db = this._getDbSync();
    return db.collection(this._collectionName)
    .aggregate(pipeline)
    .toArray();
  }

  _update(selector, modifier, options) {
    return this._getDb()
    .then(db => db.collection(this._collectionName).updateMany(selector, modifier, options))
    .then((res) => {
      if (this._redisDb) {
        const fields = _.flatten(Object.keys(modifier).map(sub => Object.keys(sub)));
        if (!selector._id || (typeof selector._id) !== "string") {
          return this.find(selector, { fields: { _id: 1 } }).forEach((doc) => {
            redisUpdate(this._redisDb, this._collectionName, doc._id, fields);
          })
          .then(() => res);
        }
        redisUpdate(this._redisDb, this._collectionName, selector._id, fields);
      }
      return res;
    });
  }

  _remove(selector) {
    return this._getDb()
    .then((db) => {
      if (this._redisDb) {
        return this.find(selector, { fields: { _id: 1 } }).forEach((doc) => {
          redisRemove(this._redisDb, this._collectionName, doc._id);
        })
        .then(() => db);
      }
      return db;
    })
    .then(db => db.collection(this._collectionName).deleteMany(selector));
  }

  _insert(doc, options) {
    return this._getDb()
    .then(db => db.collection(this._collectionName).insertOne(doc))
    .then((res) => {
      if (this._redisDb) {
        redisInsert(this._redisDb, this._collectionName, res.ops ? res.ops[0]._id : res.insertedId, options);
      }
      return res;
    });
  }

  find(selector, options) {
    return this._find(selector, options);
  }

  insert(doc) {
    if (this.nativeSync) {
      return this.insertSync(doc);
    }
    return this._insert(doc);
  }

  update(selector, modifier, options) {
    if (this.nativeSync) {
      return this.updateSync(selector, modifier, options);
    }
    return this._update(selector, modifier, options);
  }

  remove(selector) {
    if (this.nativeSync) {
      return this.removeSync(selector);
    }
    return this._remove(selector);
  }

  aggregate(pipeline) {
    if (this.nativeSync) {
      return this.aggregateSync(pipeline);
    }
    return this._aggregate(pipeline);
  }
}

module.exports = MongoCollection