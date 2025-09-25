import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';

addRxPlugin(RxDBQueryBuilderPlugin); 

// Business schema
const businessSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    updatedAt: { type: 'string', format: 'date-time' }
  },
  required: ['id', 'name', 'updatedAt']
};

// Article schema
const articleSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    qty: { type: 'number' },
    selling_price: { type: 'number' },
    business_id: { type: 'string' },
    updatedAt: { type: 'string', format: 'date-time' }
  },
  required: ['id', 'name', 'qty', 'selling_price', 'business_id', 'updatedAt']
};

let dbPromise = null;

export async function getDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = createDatabase();
  return dbPromise;
}

async function createDatabase() {
  try {

    const db = await createRxDatabase({
      name: 'businessdb',
      storage: getRxStorageDexie(),
      multiInstance: false,
      eventReduce: true,
      ignoreDuplicate: true
    });


  
    await db.addCollections({
      businesses: { schema: businessSchema },
      articles: { schema: articleSchema }
    });


    if (!db.collections.businesses || !db.collections.articles) {
      throw new Error('Collections not properly initialized');
    }
    return db;

  } catch (error) {
    dbPromise = null;
    throw error;
  }
}