import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import './Feedback.css';

const FeedbackContext = createContext(null);
export function FeedbackProvider({ children }) {
  const [message, setMessage] = useState('');
  const timer = useRef();
  const notify = useCallback((text) => {
    clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(''), 5000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return <FeedbackContext.Provider value={notify}>
    {children}
    <div className="feedback" role="status" aria-live="polite" aria-atomic="true">{message && <span>{message}</span>}</div>
  </FeedbackContext.Provider>;
}
export const useFeedback = () => useContext(FeedbackContext);
