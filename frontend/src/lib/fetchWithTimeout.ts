/**
 * Utility wrapper for fetch calls with timeout protection and abort controller support.
 * Prevents hanging requests and provides cancellation support.
 */

export async function fetchWithTimeout<T>(
  fetchFn: (signal?: AbortSignal) => Promise<T>,
  timeoutMs: number,
  abortController?: AbortController
): Promise<T> {
  const controller = abortController || new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const result = await fetchFn(controller.signal);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Create a timeout-protected version of any async function.
 */
export function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}
