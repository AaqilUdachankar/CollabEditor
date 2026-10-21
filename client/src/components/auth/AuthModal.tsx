import React, { useState } from 'react';
import { X, Code2, Lock, Mail, User, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';

export const AuthModal: React.FC = () => {
  const { authModalOpen, setAuthModalOpen } = useSettingsStore();
  const { login, signup, loginAsGuest, isLoading, error } = useAuthStore();

  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  if (!authModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    try {
      if (isSignup) {
        if (!username.trim()) {
          setLocalError('Username is required');
          return;
        }
        await signup(email.trim(), username.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      setAuthModalOpen(false);
    } catch (err: any) {
      setLocalError(err.message);
    }
  };

  return (
    <div className="palette-overlay" onClick={() => setAuthModalOpen(false)}>
      <div
        className="palette-box"
        style={{ width: '420px', padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            backgroundColor: '#252526',
            borderBottom: '1px solid #3c3c3c',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: '#38bdf8' }}>
            <Code2 size={20} />
            <span>{isSignup ? 'Create Nexus Account' : 'Sign in to Nexus Studio'}</span>
          </div>
          <button
            onClick={() => setAuthModalOpen(false)}
            style={{ background: 'transparent', border: 'none', color: '#858585', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
          {(localError || error) && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#f87171',
                padding: '8px 12px',
                borderRadius: 4,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 14,
              }}
            >
              <AlertCircle size={15} />
              <span>{localError || error}</span>
            </div>
          )}

          {isSignup && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#cccccc', marginBottom: 4 }}>
                Username
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#2a2a2a',
                  border: '1px solid #3c3c3c',
                  borderRadius: 4,
                  padding: '6px 10px',
                  gap: 8,
                }}
              >
                <User size={15} color="#858585" />
                <input
                  type="text"
                  required
                  placeholder="developer_name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'white',
                    fontSize: 13,
                  }}
                />
              </div>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#cccccc', marginBottom: 4 }}>
              Email Address
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#2a2a2a',
                border: '1px solid #3c3c3c',
                borderRadius: 4,
                padding: '6px 10px',
                gap: 8,
              }}
            >
              <Mail size={15} color="#858585" />
              <input
                type="email"
                required
                placeholder="dev@nexus-ide.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'white',
                  fontSize: 13,
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#cccccc', marginBottom: 4 }}>
              Password
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#2a2a2a',
                border: '1px solid #3c3c3c',
                borderRadius: 4,
                padding: '6px 10px',
                gap: 8,
              }}
            >
              <Lock size={15} color="#858585" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'white',
                  fontSize: 13,
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              background: '#007acc',
              color: 'white',
              border: 'none',
              padding: '8px 0',
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 500,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              marginBottom: 12,
            }}
          >
            {isLoading ? 'Processing...' : isSignup ? 'Sign Up' : 'Sign In'}
          </button>

          <div style={{ margin: '12px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 1, backgroundColor: '#3c3c3c' }} />
            <span style={{ fontSize: 11, color: '#858585' }}>OR</span>
            <div style={{ flex: 1, height: 1, backgroundColor: '#3c3c3c' }} />
          </div>

          <button
            type="button"
            onClick={async () => {
              try {
                await loginAsGuest();
                setAuthModalOpen(false);
              } catch (err: any) {
                setLocalError(err.message);
              }
            }}
            disabled={isLoading}
            style={{
              width: '100%',
              background: '#2d2d2d',
              color: '#cccccc',
              border: '1px solid #3c3c3c',
              padding: '7px 0',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 500,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              marginBottom: 14,
            }}
          >
            ⚡ Quick Start as Guest Developer
          </button>

          <div style={{ textAlign: 'center', fontSize: 12, color: '#858585' }}>
            {isSignup ? (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignup(false);
                    setLocalError(null);
                  }}
                  style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer' }}
                >
                  Sign In
                </button>
              </span>
            ) : (
              <span>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignup(true);
                    setLocalError(null);
                  }}
                  style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer' }}
                >
                  Create one
                </button>
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
