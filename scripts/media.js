import { Firestore, FieldValue } from '@google-cloud/firestore';
import { OpenAIEmbeddings } from '@langchain/openai';
import fs from 'fs';

const data = fs.readFileSync('./data/media.json', 'utf-8');
const media = JSON.parse(data);

const embeddings = new OpenAIEmbeddings({ model: 'text-embedding-3-small', dimensions: 1536 });
const db = new Firestore({ projectId: 'vibes-471901' });
const coll = db.collection('resources');

for (const resource of media.resources) {
  console.log(resource.description);
  const res = await embeddings.embedQuery(resource.description);

  await coll.doc(resource.id).set(
    {
      description: resource.description,
      embedding: FieldValue.vector(res),
      backdrops: resource.backdrops ?? [],
      pivots: resource.pivots ?? [],
    },
    { merge: true }
  );
}
