import _ from 'underscore';
import { redisInsert, redisUpdate, redisRemove } from './redis';

let Future;
try {
  Future = require('fibers/future');
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
export class MongoCollection {
  constructor(collectionName, mongoDb, redisDb) {
    this._collectionName = collectionName;
    this._mongoDb = mongoDb;
    this._redisDb = redisDb;
  }

  // TODO: for both of these we need to handle if the connection has died.
  _getDbSync() {
    return this._mongoDb;
  }

  _getDb() {
    return Promise.resolve(this._mongoDb);
  }

  find(selector, options = {}) {
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
    cursor.forEachSync = cursorForEach.bind(cursor);
    cursor.mapSync = cursorMap.bind(cursor);
    cursor.countSync = cursorCount.bind(cursor);

    return cursor;
  }

  findOneSync(selector, options = {}) {
    return this.find(selector, _.extend(options, { limit: 1 })).toArraySync()[0];
  }

  updateSync(selector, modifier, options) {
    const waitForUpsert = new Future();
    this.update(selector, modifier, options)
    .then(res => waitForUpsert.return(res))
    .catch(err => waitForUpsert.throw(err));
    return waitForUpsert.wait();
  }

  insertSync(doc) {
    const waitForInsert = new Future();
    this.insert(doc)
    .then(res => waitForInsert.return(res.ops))
    .catch(err => waitForInsert.throw(err));
    return waitForInsert.wait();
  }

  removeSync(selector) {
    const waitForRemove = new Future();
    this.remove(selector)
    .then(res => waitForRemove.return(res))
    .catch(err => waitForRemove.throw(err));
    return waitForRemove.wait();
  }

  aggregateSync(pipeline) {
    const db = this._getDbSync();
    const waitForAggregate = new Future();
    db.collection(this._collectionName).aggregate(pipeline).toArray()
    .then(res => waitForAggregate.return(res))
    .catch(err => waitForAggregate.throw(err));
    return waitForAggregate.wait();
  }

  update(selector, modifier, options) {
    return this._getDb()
    .then(db => db.collection(this._collectionName).updateMany(selector, modifier, options))
    .then((res) => {
      if (this._redisDb) {
        const fields = _.flatten(Object.keys(modifier).map(sub => Object.keys(sub)));
        return this.find(selector, { fields: { _id: 1 } }).forEach((doc) => {
          redisUpdate(this._redisDb, this._collectionName, doc._id, fields);
        })
        .then(() => res);
      }
      return res;
    });
  }

  remove(selector) {
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

  insert(doc) {
    return this._getDb()
    .then(db => db.collection(this._collectionName).insertOne(doc))
    .then((res) => {
      if (this._redisDb) {
        redisInsert(this._redisDb, this._collectionName, res.ops[0]._id);
      }
      return res;
    });
  }
}
