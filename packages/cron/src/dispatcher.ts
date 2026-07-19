export interface CronJobConfig {
  name: string;
  path: string;
  schedule: string;
}

interface DispatchCronJobInput {
  baseUrl: string;
  fetchRequest?: typeof fetch;
  job: CronJobConfig;
  secret: string;
  sleep?: (delayMs: number) => Promise<void>;
  timeoutMs?: number;
}

const maxAttempts = 3;
const retryDelayMs = 1_000;
const wait = (delayMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, delayMs));

export const dispatchCronJob = async ({
  baseUrl,
  fetchRequest = fetch,
  job,
  secret,
  sleep = wait,
  timeoutMs = 30_000,
}: DispatchCronJobInput) => {
  const url = new URL(job.path, baseUrl).toString();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: Response;

    try {
      response = await fetchRequest(url, {
        headers: { authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await sleep(retryDelayMs);
      continue;
    }

    const body: unknown = await response.json().catch(() => null);
    if (response.ok) {
      return {
        body,
        status: response.status,
      };
    }

    const error = new Error(`${job.name} returned HTTP ${response.status}`);
    if (response.status < 500 || attempt === maxAttempts) throw error;
    await sleep(retryDelayMs);
  }

  throw new Error(`${job.name} exhausted request attempts`);
};
