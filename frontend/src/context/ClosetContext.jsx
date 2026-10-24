import { createContext, useContext, useState, useSyncExternalStore } from 'react';
import { demoStore } from '../services/demoStore.js';
import { emptyFilters } from '../data/options.js';

const ClosetContext = createContext(null);
export function ClosetProvider({ children }) {
  const state = useSyncExternalStore(demoStore.subscribe, demoStore.getSnapshot);
  const [filters, setFilters] = useState(emptyFilters);
  const [search, setSearch] = useState('');
  return <ClosetContext.Provider value={{ ...state, filters, setFilters, search, setSearch }}>{children}</ClosetContext.Provider>;
}
export const useCloset = () => useContext(ClosetContext);
