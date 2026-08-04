import React from 'react';
import { LogIn, Shield, X, CheckCircle2 } from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, user }) => {
  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    try {
      const credential = await signInWithPopup(auth, googleAuthProvider);
      const token = await credential.user.getIdToken();
      // Sync user with backend Cloud SQL database
      await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      onClose();
    } catch (error: any) {
      console.error('Sign-in error:', error);
      alert('Sign-In failed: ' + error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-6 max-w-sm w-full relative shadow-2xl space-y-4">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded hover:bg-[#1C2128] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center space-y-2">
          <div className="p-3 bg-blue-600/10 text-blue-400 rounded-lg w-fit mx-auto border border-blue-500/20">
            <Shield className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-gray-100">Firebase Authentication</h3>
          <p className="text-xs text-gray-400">
            Sign in with your Google Account to synchronize user accounts with PostgreSQL.
          </p>
        </div>

        {user ? (
          <div className="bg-[#0D1117] p-4 rounded border border-[#30363D] space-y-2 text-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
            <p className="text-xs font-semibold text-gray-200">Currently Signed In</p>
            <p className="text-xs text-gray-400">{user.email}</p>
          </div>
        ) : (
          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center space-x-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold text-sm transition-all shadow-lg"
          >
            <LogIn className="w-4 h-4" />
            <span>Continue with Google</span>
          </button>
        )}

      </div>
    </div>
  );
};
