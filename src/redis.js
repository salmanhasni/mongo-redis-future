export const RedisPipe = {
  EVENT: 'e',
  DOC: 'd',
  FIELDS: 'f',
  MODIFIER: 'm',
  DOCUMENT_ID: 'id',
  SYNTHETIC: 's',
  UID: 'u', // this is the unique identity of a change request
  MODIFIED_TOP_LEVEL_FIELDS: 'mt'
};

export const Events = {
  INSERT: 'i',
  UPDATE: 'u',
  REMOVE: 'r'
};


export function redisInsert(redis, collection, docId) {
  redis.publish(collection, JSON.stringify({
    [RedisPipe.EVENT]: Events.INSERT,
    [RedisPipe.DOC]: { _id: docId }
  }));
}

export function redisRemove(redis, collection, docId) {
  redis.publish(collection, JSON.stringify({
    [RedisPipe.EVENT]: Events.REMOVE,
    [RedisPipe.DOC]: { _id: docId }
  }));
  redis.publish(`${collection}::${docId}`, JSON.stringify({
    [RedisPipe.EVENT]: Events.REMOVE,
    [RedisPipe.DOC]: { _id: docId }
  }));
}

export function redisUpdate(redis, collection, docId, fields) {
  redis.publish(collection, JSON.stringify({
    [RedisPipe.EVENT]: Events.UPDATE,
    [RedisPipe.DOC]: { _id: docId },
    [RedisPipe.FIELDS]: fields
  }));
  redis.publish(`${collection}::${docId}`, JSON.stringify({
    [RedisPipe.EVENT]: Events.UPDATE,
    [RedisPipe.DOC]: { _id: docId },
    [RedisPipe.FIELDS]: fields
  }));
}
