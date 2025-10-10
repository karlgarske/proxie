import { Firestore, FieldValue } from '@google-cloud/firestore';
import { OpenAIEmbeddings } from '@langchain/openai';
import fs from 'fs';

const data = fs.readFileSync('./data/model.json', 'utf-8');
const content = JSON.parse(data);

const embeddings = new OpenAIEmbeddings({ model: 'text-embedding-3-small', dimensions: 1536 });
const db = new Firestore({ projectId: 'vibes-471901' });
const coll = db.collection('resources');

for (const resource in content) {
  console.log(`Loading resource ${resource}`);
  const properties = content[resource];
  const vector = await embeddings.embedQuery(properties.description);

  await coll.doc(resource).set(
    {
      description: properties.description,
      embedding: FieldValue.vector(vector),
      backdrops: properties.backdrops ?? [],
      suggestions: properties.suggestions ?? [],
    },
    { merge: true }
  );
}
