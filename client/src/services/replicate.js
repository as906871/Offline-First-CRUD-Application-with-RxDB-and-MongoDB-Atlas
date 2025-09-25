import { replicateRxCollection } from 'rxdb/plugins/replication';
import { Subject } from 'rxjs';

/**
 * Start RxDB replication for a given collection to a server.
 * @param {RxDatabase} db - RxDB database instance
 * @param {string} collectionName - Name of the collection ('businesses' or 'articles')
 * @param {string} serverBaseUrl - Server URL, e.g., 'http://localhost:3001'
 */
export async function startReplication(db, collectionName, serverBaseUrl) {
  try {

    const collection = db[collectionName];
    if (!collection) throw new Error(`Collection ${collectionName} not found`);

    const stream$ = new Subject();

    let es;
    try {
      es = new EventSource(`${serverBaseUrl}/${collectionName}/pullStream`);
      es.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'change') stream$.next('RESYNC');
      };
      es.onerror = (err) => console.error(`SSE error for ${collectionName}:`, err);
      es.onopen = () => console.log(`SSE connected for ${collectionName}`);
    } catch (err) {
      console.warn(`SSE not available for ${collectionName}:`, err);
    }

    const replicationState = replicateRxCollection({
      collection,
      replicationIdentifier: `${collectionName}-http-replication`,
      live: true,
      retryTime: 5000,
      autoStart: true,
      waitForLeadership: false,

      pull: {
        async handler(checkpoint, batchSize = 50) {
          const updatedAt = checkpoint?.updatedAt || '';
          const id = checkpoint?.id || '';
          const url = `${serverBaseUrl}/${collectionName}/pull?updatedAt=${encodeURIComponent(updatedAt)}&id=${encodeURIComponent(id)}&batchSize=${batchSize}`;
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Pull failed: ${response.statusText}`);
          const json = await response.json();
          return { documents: json.documents || [], checkpoint: json.checkpoint || checkpoint };
        },
        stream$: stream$.asObservable(),
      },

      push: {
        async handler(rows) {
          if (!rows || rows.length === 0) return [];
          const response = await fetch(`${serverBaseUrl}/${collectionName}/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rows),
          });
          if (!response.ok) throw new Error(`Push failed: ${response.statusText}`);
          return await response.json();
        },
      },
    });

    replicationState.error$?.subscribe(err => console.error(`Replication error for ${collectionName}:`, err));
    replicationState.active$?.subscribe(active => console.log(`Replication ${active ? 'active' : 'inactive'} for ${collectionName}`));
    replicationState.received$?.subscribe(docs => docs.length > 0 && console.log(`📥 Received ${docs.length} documents for ${collectionName}`));
    replicationState.send$?.subscribe(docs => docs.length > 0 && console.log(`📤 Sent ${docs.length} documents for ${collectionName}`));

    return {
      replicationState,
      cleanup: () => {
        es?.close();
        stream$.complete();
      },
    };
  } catch (error) {
    console.error(`❌ Failed to start replication for ${collectionName}:`, error);
    throw error;
  }
}