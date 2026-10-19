import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type FetcherResult = { data: any | null; error: { message: string } | null };
type Fetcher = () => PromiseLike<FetcherResult> | Promise<FetcherResult>;

export function useQuery<T = any>(fetcher: Fetcher, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const run = useCallback(() => {
    let active = true;
    setLoading(true);
    Promise.resolve(fetcher())
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setError(error.message);
        else setError(null);
        setData(data);
      })
      .catch((e) => { if (active) setError(e?.message || 'Request failed'); })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { data, error, loading, refetch: run };
}

// Subscribe to realtime changes on a table and refetch.
export function useRealtimeTable(table: string, refetch: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel(`realtime-${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [table, refetch]);
}
