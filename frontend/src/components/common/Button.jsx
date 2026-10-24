import { Link } from 'react-router-dom';
import './Controls.css';

export default function Button({ to, variant = 'outline', className = '', children, ...props }) {
  const classes = `button button--${variant} ${className}`;
  return to ? <Link className={classes} to={to} {...props}>{children}</Link>
    : <button type="button" className={classes} {...props}>{children}</button>;
}
