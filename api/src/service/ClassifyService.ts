import { Firestore, FieldValue, VectorQuery, VectorQuerySnapshot } from '@google-cloud/firestore';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { OpenAIEmbeddings } from '@langchain/openai';

const classificationSchema = z.object({
  keyword: z
    .enum(['school', 'degree', 'hobbies', 'experience', 'projects', 'home', 'none'])
    .describe('A single keyword representing the category of the user prompt'),
});

export type ClassifyServiceConfig = {
  firestore: Firestore;
  env: string;
  systemMessage: SystemMessage;
  model: ChatOpenAI;
};

export type Classification = {
  description: string | null;
  score: number;
  backdrops: any[];
  figures: any[];
};

export class ClassifyService {
  private readonly visualsCollection = this.config.firestore.collection('classes');
  constructor(private readonly config: ClassifyServiceConfig) {
    this.config.firestore.collection('visuals');
  }

  async getClassificationByVector(prompt: string): Promise<Classification | null> {
    const embeddings = new OpenAIEmbeddings({ model: 'text-embedding-3-small', dimensions: 1536 });
    const res = await embeddings.embedQuery(prompt);

    // Requires a single-field vector index
    const resourcesCollection = this.config.firestore.collection('resources');
    const query: VectorQuery = resourcesCollection.findNearest({
      vectorField: 'embedding',
      queryVector: res,
      limit: 1,
      distanceMeasure: 'DOT_PRODUCT',
      distanceResultField: 'vector_distance',
    });

    const snapshot: VectorQuerySnapshot = await query.get();

    if (snapshot.empty) {
      //console.debug('no vector search results');
      return null;
    } else {
      const data = snapshot.docs[0].data(); //top match
      //console.debug('vector search top result:', data);
      return {
        description: data.description ?? null,
        score: data.vector_distance,
        backdrops: data.backdrops ?? [],
        figures: data.figures ?? [],
      };
    }
  }
}
