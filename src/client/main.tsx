import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import './styles.css';
import './motion.css';
import './refinement.css';
import './product.css';

const Landing = lazy(() => import('./Landing.js'));
const staticDemo = import.meta.env.VITE_STATIC_DEMO === 'true';
if (staticDemo) {
  const icon = document.createElement('link');
  icon.rel = 'icon';
  icon.href = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#090c12"/><path d="m9 25 7-18m0 18 7-18" stroke="#ffb547" stroke-width="3"/></svg>')}`;
  document.head.append(icon);
}
// Existing OAuth callbacks still enter the controller, which clears the query
// and normalizes the URL to /play after displaying its result.
const landing = staticDemo || (location.pathname === '/' && !new URLSearchParams(location.search).has('oauth'));
createRoot(document.getElementById('root')!).render(<React.StrictMode>{landing ? <Suspense fallback={<div className="loading-room"><p>Opening WORLD//PATCH…</p><a href={staticDemo ? 'https://github.com/himanshu748/world-patch/blob/main/docs/LOCAL-SETUP.md' : '/play'}>{staticDemo ? 'Host setup' : 'Enter the chamber'} →</a></div>}><Landing /></Suspense> : <App />}</React.StrictMode>);
