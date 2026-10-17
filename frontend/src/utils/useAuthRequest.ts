import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../services/api';

// Prevent duplicate submits and stale navigation after leaving a screen.
export function useAuthRequest() {
  const active = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => () => active.current?.abort(), []);

  async function run<T>(
    action: (signal: AbortSignal) => Promise<T>,
    accepted: (result: T) => void,
  ) {
    if (active.current) {
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setError('');
    try {
      const result = await action(controller.signal);
      if (!controller.signal.aborted) {
        accepted(result);
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(
          failure instanceof ApiError
            ? failure.message
            : 'Something went wrong. Please try again.',
        );
      }
    } finally {
      active.current = null;
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }
  return { loading, error, run, clearError: () => setError('') };
}
