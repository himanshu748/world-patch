import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import './styles.css';
import './motion.css';
import './refinement.css';
import './product.css';

const Landing = lazy(() => import('./Landing.js'));
// Existing OAuth callbacks still enter the controller, which clears the query
// and normalizes the URL to /play after displaying its result.
const landing = location.pathname === '/' && !new URLSearchParams(location.search).has('oauth');
createRoot(document.getElementById('root')!).render(<React.StrictMode>{landing ? <Suspense fallback={<div className="loading-room"><p>Opening WORLD//PATCH…</p><a href="/play">Enter the chamber →</a></div>}><Landing /></Suspense> : <App />}</React.StrictMode>);
