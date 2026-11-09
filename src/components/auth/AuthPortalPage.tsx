import React, { useState } from 'react';
import { Shield, Mail, Lock, LogIn, UserPlus, KeyRound, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import {
  signInWithEmail,
  registerWithEmail,
  signInWithGooglePopup,
  sendPasswordReset,
} from '../../firebase';

export interface AuthPortalPageProps {
  onAuthSuccess: (sessionData: {
    token: string;
    user: { id: string; email: string; displayName?: string; emailVerified: boolean };
    membership?: any;
  }) => void;
  onContinueOffline?: () => void;
}

export const AuthPortalPage: React.FC<AuthPortalPageProps> = ({
  onAuthSuccess,
  onContinueOffline,
}) => {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSending, setResetSending] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const syncBackendSession = async (firebaseIdToken: string) => {
    const res = await fetch('/api/v1/auth/session/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firebaseIdToken,
        deviceName: 'Web Browser',
        platform: 'Web',
        userAgent: navigator.userAgent,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Session sync failed (HTTP ${res.status})`);
    }

    const sessionData = await res.json();
    return sessionData;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please fill in both email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    setStatusMessage(null);

    try {
      if (mode === 'register') {
        const userCredential = await registerWithEmail(email.trim(), password);
        const idToken = await userCredential.user.getIdToken();
        const sessionData = await syncBackendSession(idToken);
        onAuthSuccess(sessionData);
      } else {
        const userCredential = await signInWithEmail(email.trim(), password);
        const idToken = await userCredential.user.getIdToken();
        const sessionData = await syncBackendSession(idToken);
        onAuthSuccess(sessionData);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const { idToken } = await signInWithGooglePopup();
      const sessionData = await syncBackendSession(idToken);
      onAuthSuccess(sessionData);
    } catch (err: any) {
      setError(err.message || 'Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetSending(true);
    setError(null);
    try {
      await sendPasswordReset(resetEmail.trim());
      setResetSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email.');
    } finally {
      setResetSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F4EC] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto h-16 w-16 bg-[#173D35] rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-sm">
          F
        </div>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#173D35]">FamilyOS</h2>
        <p className="mt-1 text-sm text-slate-600">Private Family Operations & Financial Governance</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          <div className="flex border-b border-slate-100 mb-6">
            <button
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`flex-1 pb-3 text-sm font-semibold text-center border-b-2 transition-colors ${
                mode === 'signin'
                  ? 'border-[#173D35] text-[#173D35]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 pb-3 text-sm font-semibold text-center border-b-2 transition-colors ${
                mode === 'register'
                  ? 'border-[#173D35] text-[#173D35]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              New Registration
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {statusMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sarah@family.org"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#173D35] focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setResetSuccess(false);
                      setShowForgotModal(true);
                    }}
                    className="text-xs text-[#173D35] hover:underline font-medium"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#173D35] focus:bg-white transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#173D35] text-white font-semibold rounded-xl text-sm hover:bg-[#12312a] transition-colors flex items-center justify-center space-x-2"
            >
              {loading ? (
                <span>Processing...</span>
              ) : mode === 'signin' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400 font-medium">Or continue with</span>
            </div>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium rounded-xl text-sm transition-colors flex items-center justify-center space-x-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Google Workspace</span>
          </button>

          {onContinueOffline && (
            <div className="mt-6 text-center pt-4 border-t border-slate-100">
              <button
                onClick={onContinueOffline}
                className="text-xs text-slate-500 hover:text-[#173D35] font-medium flex items-center justify-center space-x-1 mx-auto"
              >
                <span>Continue with Offline Local Workspace</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {showForgotModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center space-x-3 text-[#173D35]">
              <KeyRound className="w-6 h-6" />
              <h3 className="text-lg font-bold">Reset Password</h3>
            </div>
            <p className="text-xs text-slate-600">
              Enter your email address and we will send you a password reset link.
            </p>

            {resetSuccess ? (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Password reset email sent! Check your inbox.</span>
              </div>
            ) : (
              <form onSubmit={handleSendResetPassword} className="space-y-3">
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="sarah@family.org"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                />
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetSending}
                    className="px-3 py-1.5 bg-[#173D35] text-white rounded-lg text-xs font-semibold hover:bg-[#12312a]"
                  >
                    {resetSending ? 'Sending...' : 'Send Link'}
                  </button>
                </div>
              </form>
            )}

            {resetSuccess && (
              <button
                onClick={() => setShowForgotModal(false)}
                className="w-full py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-medium"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
