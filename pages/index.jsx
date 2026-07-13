import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();

    // Default credentials
    if (username === 'admin' && password === 'admin') {
      localStorage.setItem('textraUser', username);
      router.push('/dashboards');
    } else {
      setError('Invalid username or password. Default: admin / admin');
      setPassword('');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-logo">
          <Image
            src="/logos/textra-video-logo.png"
            alt="Textra Video"
            width={220}
            height={31}
            priority
          />
        </div>
        <p style={{ textAlign: 'center', marginBottom: '30px', color: '#666' }}>
          Operational Dashboards
        </p>

        {error && (
          <div className="error" style={{ marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <input
            type="text"
            className="login-input"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            className="login-input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="login-button">
            Login
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: '#999' }}>
          Demo Credentials: admin / admin
        </p>
      </div>
    </div>
  );
}
