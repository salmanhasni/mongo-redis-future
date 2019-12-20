/* global describe it before after */
const { MongoClient } = require('mongodb');
const Fiber = require('fibers');
const assert = require('assert');
const { MongoCollection } = require('./lib/index.js');

let db;

let connection;

describe('MongoCollection', () => {
  before((done) => {
    MongoClient.connect('mongodb://localhost:27017/mongo-redis-future')
    .then((con) => {
      connection = con;
      db = con.db('mongo-redis-future');
      done();
    })
    .catch(err => done(err));
  });
  describe('#find', () => {
    it('toArraySync should return an array', (done) => {
      function test() {
        const collection = new MongoCollection('users', db);
        const arr = collection.find({}).toArraySync();
        assert.ok(arr instanceof Array);
        done();
      }
      Fiber(test).run();
    });
    it('countSync should return a number', (done) => {
      function test() {
        const collection = new MongoCollection('users', db);
        const arr = collection.find({}).countSync();
        assert.ok(typeof arr === 'number');
        done();
      }
      Fiber(test).run();
    });
    it('forEach should hit the method once per doc', (done) => {
      function test() {
        const collection = new MongoCollection('users', db);
        collection.removeSync({});
        collection.insertSync({ _id: 'test' });
        let count = 0;
        collection.find({}).forEachSync(() => count++);
        assert.equal(count, 1);
        done();
      }
      Fiber(test).run();
    });
    it('map should hit the method once per doc', (done) => {
      function test() {
        const collection = new MongoCollection('users', db);
        collection.removeSync({});
        collection.insertSync({ _id: 'test' });
        const ret = collection.find({}).mapSync(doc => doc);
        assert.equal(ret.length, 1);
        done();
      }
      Fiber(test).run();
    });
  });
  describe('#insert', () => {
    it('should return the result', (done) => {
      function test() {
        const collection = new MongoCollection('users', db);
        collection.removeSync({});
        const res = collection.insertSync({ _id: 'test' });
        assert.ok(!(res instanceof Promise));
        done();
      }
      Fiber(test).run();
    });
  });
  describe('#update', () => {
    it('should return the result', (done) => {
      function test() {
        const collection = new MongoCollection('users', db);
        collection.removeSync({});
        collection.insertSync({ _id: 'test' });
        collection.updateSync({ _id: 'test' }, { $set: { test: 'test' } });
        assert.equal(collection.findOneSync({ _id: 'test' }).test, 'test');
        done();
      }
      Fiber(test).run();
    });
    it('should publish to redis', (done) => {
      function test() {
        let called = false;
        function publishFn(collection, msg) {
          console.log(collection, msg);
          if (!called) {
            called = true;
            assert.equal(collection, 'users');
            assert.ok(msg.includes('test'));
          }
        }
        const collection = new MongoCollection('users', db, { publish: publishFn });
        collection.removeSync({});
        collection.insertSync({ _id: 'test' });
        collection.updateSync({ _id: 'test' }, { $set: { test: 'test' } });
        assert.equal(collection.findOneSync({ _id: 'test' }).test, 'test');
        assert.ok(called);
        done();
      }
      Fiber(test).run();
    });
  });
  it('aggregate should return an array', (done) => {
    function test() {
      const collection = new MongoCollection('users', db);
      collection.removeSync({});
      collection.insertSync({ _id: 'test' });
      assert.equal(collection.aggregateSync([{ $match: { _id: 'test' } }]).length, 1);
      done();
    }
    Fiber(test).run();
  });

  after(() => {
    connection.close();
  });
});
