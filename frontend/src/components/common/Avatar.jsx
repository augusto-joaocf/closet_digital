import { useEffect, useState } from 'react';

export default function Avatar({ user }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [user.avatar]);
  return <div className="avatar">{user.avatar && !failed
    ? <img src={user.avatar} alt={`Avatar de ${user.name}`} onError={() => setFailed(true)} />
    : <span aria-label={`Inicial de ${user.name}`}>{user.name.trim().charAt(0).toLocaleUpperCase('pt-BR') || 'P'}</span>}</div>;
}
