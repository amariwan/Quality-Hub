'use client';

import React from 'react';
import { SWRConfig, type SWRConfiguration } from 'swr';
import { ActiveThemeProvider } from '../themes/active-theme';

const swrConfig: SWRConfiguration = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  shouldRetryOnError: false,
  keepPreviousData: true
};

export default function Providers({
  activeThemeValue,
  children
}: {
  activeThemeValue: string;
  children: React.ReactNode;
}) {
  return (
    <SWRConfig value={swrConfig}>
      <ActiveThemeProvider initialTheme={activeThemeValue}>
        {children}
      </ActiveThemeProvider>
    </SWRConfig>
  );
}
