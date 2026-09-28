import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './app/AuthProvider';
import { AppearanceProvider } from './appearance/AppearanceProvider';
import { App } from './app/App';
import './styles/global.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: (count, error) => count < 2 && !(error instanceof Error && 'status' in error && Number(error.status) < 500), staleTime: 10_000 } } });
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><BrowserRouter><QueryClientProvider client={queryClient}><AuthProvider><AppearanceProvider><App /></AppearanceProvider></AuthProvider></QueryClientProvider></BrowserRouter></React.StrictMode>,
);
