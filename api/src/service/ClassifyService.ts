import { Firestore, VectorQuery, VectorQuerySnapshot } from '@google-cloud/firestore';
import { OpenAIEmbeddings } from '@langchain/openai';

export type ClassifyServiceConfig = {
  firestore: Firestore;
  env: string;
  embeddings: OpenAIEmbeddings;
};

export type Classification = {
  description: string | null;
  score: number;
  backdrops: any[];
  pivots: string[];
};

export interface IClassifyService {
  getClassificationByVector(prompt: string): Promise<Classification | null>;
}

// Creates IClassifyService based on environment
export function classifyFactory(config: ClassifyServiceConfig): IClassifyService {
  if (config.env === 'test') {
    console.warn('Using MockClassifyService in test environment');
    return new MockClassifyService();
  }
  return new ClassifyService(config);
}

// Mock service for development and testing
export class MockClassifyService implements IClassifyService {
  async getClassificationByVector(prompt: string): Promise<Classification | null> {
    return {
      description: 'Some colorful, dreamy, surreal visuals',
      score: 0.9,
      backdrops: [
        {
          url: 'https://plus.unsplash.com/premium_vector-1741385696417-85b9645bbc09?q=80&w=1718&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
          description:
            'I dont recall dreaming in color, and yet here we are. What if those who do are simply in a dream of their own?',
          attribution: 'Photo by Alex Knight on Unsplash',
        },
        {
          url: '/assets/media/refraction.gif',
          description:
            "I've used my math/cs background to explore the art of sound. In this example, I map audio frequencies to size and motion using a Fourier Transform. It blends 3D geometries in real time using a Marching Cubes algorithm, and applies light refraction using a GLSL shader.",
          attribution: 'Animation by karl on Ama',
        },
      ],
      pivots: [
        'What tools are you using for prototyping?',
        'What is your approach to user research?',
      ],
    };
  }
}

// Production service
export class ClassifyService implements IClassifyService {
  private readonly visualsCollection = this.config.firestore.collection('classes');
  constructor(private readonly config: ClassifyServiceConfig) {
    this.config.firestore.collection('visuals');
  }

  async getClassificationByVector(prompt: string): Promise<Classification | null> {
    const res = await this.config.embeddings.embedQuery(prompt);

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
      return null;
    } else {
      const data = snapshot.docs[0].data(); //top match
      return {
        description: data.description ?? null,
        score: data.vector_distance,
        backdrops: data.backdrops ?? [],
        pivots: data.pivots ?? [],
      };
    }
  }
}
