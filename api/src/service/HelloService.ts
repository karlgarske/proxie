export type ServiceSettings = {
  greeting: string;
};

export class HelloService {
  constructor(private settings: ServiceSettings) {}

  hello(name?: string) {
    const who = name?.trim() || 'World';
    return { message: `${this.settings.greeting}, ${who}!` };
  }
}

export function createHelloServiceFromEnv(): HelloService {
  const greeting = process.env.GREETING || 'Hello';
  return new HelloService({ greeting });
}

