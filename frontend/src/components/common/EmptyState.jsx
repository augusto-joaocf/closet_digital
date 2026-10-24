import Button from './Button.jsx';

export default function EmptyState({ title, description, to, action = '+ Adicionar', onAction }) {
  return <div className="empty-state">
    <h2>{title}</h2>
    {description && <p>{description}</p>}
    {(to || onAction) && <Button to={to} onClick={onAction}>{action}</Button>}
  </div>;
}
