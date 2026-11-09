import React, { useState } from 'react';
import { Mail, CheckCircle2, AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';
import { sendEmailVerification, auth } from '../../firebase';

export interface EmailVerificationGateProps {
  email: string;
  isVerified: boolean;
  onVerificationSuccess?: () => void;
  inlineBannerOnly?: boolean;
}

export const EmailVerificationGate: React.FC<EmailVerificationGateProps> = ({
  email,
  isVerified,
  onVerificationSuccess,
  inlineBannerOnly = false,
}) => {
  const [sending, setSending] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isVerified) {
    return null;
  }

  const handleSendVerification = async () => {
    setSending(true);
    setError(null);
    setSentSuccess(false);
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        setSentSuccess(true);
      } else {
        throw new Error('No active user session to send verification email.');
      }
    } catch (err: any) {
      setError(err.message || 'Error sending verification email');
    } finally {
      setSending(false);
    }
  };

  const handleCheckStatus = async () => {
    setReloading(true);
    setError(null);
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          if (onVerificationSuccess) onVerificationSuccess();
        } else {
          setError('Email is still unverified. Please check your inbox and click the verification link.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error checking verification status');
    } finally {
      setReloading(false);
    }
  };

  if (inlineBannerOnly) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between space-x-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-amber-900">Email Verification Required</h4>
            <p className="text-xs text-amber-800">
              Please verify <span className="font-medium">{email}</span> to access sensitive family functions.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleSendVerification}
            disabled={sending}
            className="px-3 py-1.5 bg-amber-800 text-white hover:bg-amber-900 rounded-lg text-xs font-medium transition-colors"
          >
            {sending ? 'Sending...' : 'Resend Email'}
          </button>
          <button
            onClick={handleCheckStatus}
            disabled={reloading}
            className="p-1.5 bg-white text-amber-800 border border-amber-300 hover:bg-amber-100 rounded-lg text-xs font-medium transition-colors"
            title="Check verification status"
          >
            <RefreshCw className={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F4EC] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6 text-center">
        <div className="w-16 h-16 bg-amber-100 text-amber-800 rounded-2xl mx-auto flex items-center justify-center">
          <Mail className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-[#173D35]">Verify Your Email Address</h2>
          <p className="text-sm text-slate-600 mt-2">
            An email verification link was sent to <span className="font-semibold text-slate-900">{email}</span>.
            Please verify your email to continue.
          </p>
        </div>

        {sentSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>Verification email sent successfully!</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-center space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3 pt-2">
          <button
            onClick={handleCheckStatus}
            disabled={reloading}
            className="w-full py-3 bg-[#173D35] text-white rounded-xl text-sm font-semibold hover:bg-[#12312a] transition-colors flex items-center justify-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} />
            <span>I've Verified My Email</span>
          </button>

          <button
            onClick={handleSendVerification}
            disabled={sending}
            className="w-full py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-sm font-medium transition-colors"
          >
            {sending ? 'Sending Link...' : 'Resend Verification Email'}
          </button>
        </div>
      </div>
    </div>
  );
};
