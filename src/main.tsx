import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './app/AuthProvider';
import { AppearanceProvider } from './appearance/AppearanceProvider';
import { App } from './app/App';
import { WorkspaceEntryTransitionProvider } from './app/WorkspaceEntryTransition';
import './styles/global.css';
import './styles/workspace.css';
import './styles/motion.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: (count, error) => count < 2 && !(error instanceof Error && 'status' in error && Number(error.status) < 500), staleTime: 10_000 } } });
ReactDOM.createRoot(document.getElementById('root')!).render(
  // Commit routes synchronously so content fades start on the updated DOM.
  <React.StrictMode><BrowserRouter useTransitions={false}><QueryClientProvider client={queryClient}><AppearanceProvider><WorkspaceEntryTransitionProvider><AuthProvider><App /></AuthProvider></WorkspaceEntryTransitionProvider></AppearanceProvider></QueryClientProvider></BrowserRouter></React.StrictMode>,
);
