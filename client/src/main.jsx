import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { BrandingProvider } from './lib/BrandingContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <BrandingProvider>
        <App />
      </BrandingProvider>
    </BrowserRouter>
  </React.StrictMode>
);
