import React from 'react';
import { createRoot } from 'react-dom/client';
import { DocumentEditor } from './ui/components/DocumentEditor';
import type { Slide } from './parsers/DocumentTypes';

const slides: Slide[] = [
  { slideNumber: 1, title: 'Intro to Graphs', content: ['Definitions', 'Examples'], images: [] },
  { slideNumber: 2, title: 'Traversal', content: ['BFS', 'DFS'], images: [] },
];

const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || '/api';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DocumentEditor
      slides={slides}
      initialGoal="Understand graphs"
      initialCheckpoints={[1]}
      documentId="doc-123"
      apiBaseUrl={apiBaseUrl}
      suggestApiUrl={`${apiBaseUrl}/goals/suggest`}
    />
  </React.StrictMode>
);
