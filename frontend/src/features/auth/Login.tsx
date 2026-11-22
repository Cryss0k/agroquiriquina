import { useState, type FormEvent } from 'react';
import type { Token, User } from '../../types';
import { api, configureApi, isNetworkError } from '../../services/api';
import { remove } from '../../services/storage';

export function Login({ onLogin }: { onLogin: (token: Token, user: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true); setMessage('');
    try {
      const response = await fetch('/api/v1/auth/token/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username.trim(), password }) });
      if (!response.ok) throw new Error(response.status === 423 ? 'Cuenta bloqueada. Contacta a un administrador para desbloquearla.' : response.status === 401 ? 'Usuario o clave incorrectos' : `Error ${response.status}`);
      const token = await response.json() as Token;
      configureApi(token);
      const user = await api<User>('/me/');
      onLogin(token, user);
      if (localStorage.getItem('aq_catTime')) remove('catTime');
      location.hash = '#/inicio';
    } catch (error) {
      setMessage(isNetworkError(error) ? 'Necesitas conexión para entrar la primera vez' : error instanceof Error ? error.message : 'No fue posible ingresar');
    } finally { setLoading(false); }
  };
  return <main className="lg"><form className="card" onSubmit={submit}>
    <img className="login-logo" src="/static/icons/logo.png" alt="AgroQuiriquina" />
    <h2 style={{ textAlign: 'center' }}>Ingresar a mi Cuenta</h2>
    <label htmlFor="username">Usuario</label><input id="username" value={username} onChange={e => setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" required />
    <label htmlFor="password">Contraseña</label><input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
    <button className="btn" disabled={loading}>{loading ? 'Ingresando…' : 'Iniciar Sesión'}</button>
    {message && <p className="error-text" role="alert">{message}</p>}
  </form></main>;
}
