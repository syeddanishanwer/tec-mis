import React, { useState } from 'react';
import { Lock, LogIn } from 'lucide-react';

interface LoginModalProps {
  onLogin: (pin: string) => Promise<boolean>;
}

export function LoginModal({ onLogin }: LoginModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);

    const success = await onLogin(pin);
    if (!success) {
      setError(true);
      setPin('');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 text-white rounded-xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 bg-indigo-600/20 text-indigo-400 rounded-full flex items-center justify-center mb-3 border border-indigo-500/30">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold">Authorized Access Only</h2>
          <p className="text-xs text-neutral-400 mt-1">
            The Educational Centre Secondary School &bull; Management Portal
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Enter Security PIN / Password
            </label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••••••"
              autoFocus
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white text-center tracking-widest text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400 text-center font-medium">
              ⚠️ Invalid PIN. Access Denied.
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !pin}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            {loading ? 'Verifying...' : 'Unlock Portal'}
          </button>
        </form>
      </div>
    </div>
  );
}