interface EmbeddingEnvironment {
  OPENAI_API_KEY?: string;
  OPENAI_EMBEDDING_MODEL?: string;
}

interface EmbeddingProviderOptions {
  apiKey: string;
  model: string;
}

interface EmbeddingResult {
  embedded: number;
  failed: number;
}

interface CreateNewsEmbeddingRunnerOptions<TRepository, TProvider> {
  createProvider: (options: EmbeddingProviderOptions) => TProvider;
  embed: (input: {
    limit: number;
    provider: TProvider;
    repository: TRepository;
  }) => Promise<EmbeddingResult>;
  environment: EmbeddingEnvironment;
  repository: TRepository;
}

export const createNewsEmbeddingRunner = <TRepository, TProvider>(
  options: CreateNewsEmbeddingRunnerOptions<TRepository, TProvider>,
) => {
  return (limit: number) => {
    const apiKey = options.environment.OPENAI_API_KEY;
    if (!apiKey) {
      return Promise.reject(new Error("OPENAI_API_KEY is required"));
    }

    const provider = options.createProvider({
      apiKey,
      model:
        options.environment.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    });

    return options.embed({
      limit,
      provider,
      repository: options.repository,
    });
  };
};
