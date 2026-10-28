'use client';

import { Suspense } from 'react';

import { HomeSpinner, HomeView } from './HomeView';

export default function Home() {
  // The tag filter lives in the query string, which needs a Suspense boundary.
  return (
    <Suspense fallback={<HomeSpinner />}>
      <HomeView />
    </Suspense>
  );
}
