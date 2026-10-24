import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/playwrite-us-modern';
import App from './App.jsx';
import { ClosetProvider } from './context/ClosetContext.jsx';
import { FeedbackProvider } from './context/FeedbackContext.jsx';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ClosetProvider><FeedbackProvider><App /></FeedbackProvider></ClosetProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
