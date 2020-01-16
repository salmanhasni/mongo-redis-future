# Mongo Redis/Future

Designed to allow redis push hooks (for use with Meteor's redis:oplog package) and/or synchronous DB operations. 

## Usage

```js

import { MongoCollection } from "mongo-redis-future";

const collection = new MongoCollection("collectionName", mongoDb, redisClient);

collection.[find,insert,update,remove,findSync,insertSync,updateSync,removeSync]
```

