"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export type ElectionPeriod = 'actual' | 'generales' | 'internas';

export interface ElectionPeriodContextType {
  period: ElectionPeriod;
  setPeriod: (period: ElectionPeriod) => void;
  getCollectionName: (baseCollection: string, customPeriod?: ElectionPeriod) => string;
  getDocName: (baseDoc: string, customPeriod?: ElectionPeriod) => string;
  getPeriodSuffix: (customPeriod?: ElectionPeriod) => string;
  isHistorical: boolean;
  periodLabel: string;
  shortLabel: string;
}

export const ELECTION_PERIOD_LABELS: Record<ElectionPeriod, { title: string; short: string; badge: string; suffix: string }> = {
  actual: {
    title: "Elecciones del Consejo de la Magistratura",
    short: "Consejo Magistratura",
    badge: "ACTUAL",
    suffix: ""
  },
  generales: {
    title: "Elecciones Generales 2026",
    short: "Generales 2026",
    badge: "GENERALES",
    suffix: "_generales_2026"
  },
  internas: {
    title: "Elecciones Internas 2026",
    short: "Internas 2026",
    badge: "INTERNAS",
    suffix: "_internas_2026"
  }
};

const ElectionPeriodContext = createContext<ElectionPeriodContextType | null>(null);

const STORAGE_KEY = 'dgre_election_period';

export function ElectionPeriodProvider({ children }: { children: React.ReactNode }) {
  const [period, setPeriodState] = useState<ElectionPeriod>('actual');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ElectionPeriod;
      if (saved && (saved === 'actual' || saved === 'generales' || saved === 'internas')) {
        setPeriodState(saved);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const setPeriod = useCallback((newPeriod: ElectionPeriod) => {
    setPeriodState(newPeriod);
    try {
      localStorage.setItem(STORAGE_KEY, newPeriod);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const getPeriodSuffix = useCallback((customPeriod?: ElectionPeriod) => {
    const target = customPeriod || period;
    return ELECTION_PERIOD_LABELS[target]?.suffix || "";
  }, [period]);

  const getCollectionName = useCallback((baseCollection: string, customPeriod?: ElectionPeriod) => {
    const target = customPeriod || period;
    if (target === 'generales') return `${baseCollection}_generales_2026`;
    if (target === 'internas') return `${baseCollection}_internas_2026`;
    return baseCollection;
  }, [period]);

  const getDocName = useCallback((baseDoc: string, customPeriod?: ElectionPeriod) => {
    const target = customPeriod || period;
    if (target === 'generales') return `${baseDoc}_generales_2026`;
    if (target === 'internas') return `${baseDoc}_internas_2026`;
    return baseDoc;
  }, [period]);

  const isHistorical = period !== 'actual';
  const periodLabel = ELECTION_PERIOD_LABELS[period]?.title || "Consejo de la Magistratura";
  const shortLabel = ELECTION_PERIOD_LABELS[period]?.short || "Consejo Magistratura";

  const value = useMemo(() => ({
    period,
    setPeriod,
    getCollectionName,
    getDocName,
    getPeriodSuffix,
    isHistorical,
    periodLabel,
    shortLabel
  }), [period, setPeriod, getCollectionName, getDocName, getPeriodSuffix, isHistorical, periodLabel, shortLabel]);

  return (
    <ElectionPeriodContext.Provider value={value}>
      {children}
    </ElectionPeriodContext.Provider>
  );
}

export function useElectionPeriod(): ElectionPeriodContextType {
  const context = useContext(ElectionPeriodContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      period: 'actual',
      setPeriod: () => {},
      getCollectionName: (base: string, p?: ElectionPeriod) => {
        if (p === 'generales') return `${base}_generales_2026`;
        if (p === 'internas') return `${base}_internas_2026`;
        return base;
      },
      getDocName: (base: string, p?: ElectionPeriod) => {
        if (p === 'generales') return `${base}_generales_2026`;
        if (p === 'internas') return `${base}_internas_2026`;
        return base;
      },
      getPeriodSuffix: (p?: ElectionPeriod) => (p === 'generales' ? '_generales_2026' : p === 'internas' ? '_internas_2026' : ''),
      isHistorical: false,
      periodLabel: "Elecciones del Consejo de la Magistratura",
      shortLabel: "Consejo Magistratura"
    };
  }
  return context;
}
