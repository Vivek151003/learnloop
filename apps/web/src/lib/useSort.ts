import { useState } from 'react';
import type { SortDir } from '../components/ui';

/** Sort state for a table: clicking the active column flips direction. */
export function useSort<K extends string>(initialKey: K, initialDir: SortDir = 'asc') {
  const [key, setKey] = useState<K>(initialKey);
  const [dir, setDir] = useState<SortDir>(initialDir);
  const toggle = (k: K) => {
    if (k === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setKey(k);
      setDir('asc');
    }
  };
  return { key, dir, toggle };
}
