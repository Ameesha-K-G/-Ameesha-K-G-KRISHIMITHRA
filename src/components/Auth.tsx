import React, { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, OperationType, handleFirestoreError } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, UserPlus, MapPin, Mail, Lock, User, LogOut, AlertCircle, Leaf, Sprout, CheckCircle2 } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: () => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const getErrorMessage = (err: any, method: string) => {
    if (err.code === 'auth/operation-not-allowed') {
      return (
        <span>
          The "{method}" sign-in method is disabled. 
          <br /><br />
          <strong>Action Required:</strong>
          <br />
          1. Go to your <a href="https://console.firebase.google.com/project/project-bb0eab64-7dfc-4762-a71/authentication/providers" target="_blank" rel="noopener noreferrer" className="underline font-bold">Firebase Console</a>.
          <br />
          2. Click <strong>"Enable"</strong> for the <strong>"{method === 'Email/Password' ? 'Email/Password' : method}"</strong> provider.
        </span>
      );
    }
    if (err.code === 'auth/invalid-credential') {
      return (
        <span>
          Invalid credentials. Please check your email and password. 
          {isLogin && <><br /><br />New here? <button type="button" onClick={() => setIsLogin(false)} className="underline font-bold">Create an account</button> instead.</>}
        </span>
      );
    }
    if (err.code === 'auth/popup-closed-by-user') {
      return "Sign-in popup was closed before completion. Please try again.";
    }
    if (err.code === 'auth/user-not-found') {
      return "No account found with this email. Please sign up first.";
    }
    if (err.code === 'auth/wrong-password') {
      return "Incorrect password. Please try again.";
    }
    if (err.code === 'auth/network-request-failed') {
      return "Network error. Please check your internet connection.";
    }
    return err.message || "Authentication failed";
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }
    setResetLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage("Password reset email sent! Please check your inbox.");
    } catch (err: any) {
      console.error("Reset error:", err);
      setError(getErrorMessage(err, "Reset"));
    } finally {
      setResetLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanEmail = email.trim();
    const cleanUsername = username.trim();

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const user = userCredential.user;

        await updateProfile(user, { displayName: cleanUsername });

        const userData = {
          uid: user.uid,
          username: cleanUsername,
          email: cleanEmail,
          location,
          role: 'user',
          createdAt: new Date().toISOString()
        };

        const userDocPath = `users/${user.uid}`;
        try {
          await setDoc(doc(db, userDocPath), userData);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, userDocPath);
        }
      }
      onAuthSuccess();
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(getErrorMessage(err, "Email/Password"));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user document exists, if not create it
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        const userData = {
          uid: user.uid,
          username: user.displayName || 'Farmer',
          email: user.email,
          location: 'Not specified',
          role: 'user',
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, userData);
      }
      
      onAuthSuccess();
    } catch (err: any) {
      console.error("Google Auth error:", err);
      setError(getErrorMessage(err, "Google"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute -top-20 -left-20 w-64 h-64 bg-forest/5 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-leaf/5 rounded-full blur-3xl" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="neu-card w-full max-w-md overflow-hidden"
      >
        {/* Header Graphic */}
        <div className="h-32 bg-forest/20 relative flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 opacity-70">
            <img 
              src="https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&q=80&w=800" 
              alt="Leaves" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="neu-icon w-16 h-16 bg-white backdrop-blur-md text-forest border border-white/80">
              <Leaf size={32} />
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold text-forest">
              {isLogin ? 'Welcome Back' : 'Join Krishi-Mitra'}
            </h2>
            <p className="text-slate-500 text-sm">
              {isLogin ? 'Secure access to Kerala Crop Guard' : 'Start protecting your crops today'}
            </p>
          </div>

          {successMessage && (
            <div className="flex items-start gap-2 p-3 bg-green-50 text-green-600 rounded-xl text-sm border border-green-100">
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Success</p>
                <p className="text-xs">{successMessage}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Authentication Error</p>
                <p className="text-xs">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-2 tracking-wider">Username</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      required 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="neu-inset w-full pl-12 pr-4 py-3 bg-earth rounded-2xl focus:outline-none focus:ring-2 focus:ring-forest/20 text-slate-700"
                      placeholder="Enter your name"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-2 tracking-wider">Location (Kerala)</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      required 
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="neu-inset w-full pl-12 pr-4 py-3 bg-earth rounded-2xl focus:outline-none focus:ring-2 focus:ring-forest/20 text-slate-700"
                      placeholder="e.g. Palakkad, Wayanad"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-2 tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="email" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="neu-inset w-full pl-12 pr-4 py-3 bg-earth rounded-2xl focus:outline-none focus:ring-2 focus:ring-forest/20 text-slate-700"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 tracking-wider">Password</label>
                {isLogin && (
                  <button 
                    type="button"
                    onClick={handleResetPassword}
                    disabled={resetLoading}
                    className="text-[10px] font-bold text-forest hover:underline disabled:opacity-50"
                  >
                    {resetLoading ? 'Sending...' : 'Forgot Password?'}
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="neu-inset w-full pl-12 pr-4 py-3 bg-earth rounded-2xl focus:outline-none focus:ring-2 focus:ring-forest/20 text-slate-700"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-red-600 text-white font-bold text-lg flex items-center justify-center gap-2 mt-4 rounded-2xl shadow-lg hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                isLogin ? <LogIn size={20} /> : <UserPlus size={20} />
              )}
              <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
            </button>
          </form>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-earth px-2 text-slate-400 font-bold tracking-widest">Or continue with</span>
            </div>
          </div>

          <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="neu-button w-full py-3 bg-white text-slate-700 font-bold flex items-center justify-center gap-3 border border-slate-100 disabled:opacity-50"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            <span>Google Account</span>
          </button>

          <div className="text-center pt-2">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm font-bold text-forest hover:text-leaf transition-colors"
            >
              {isLogin ? (
                <span className="flex items-center justify-center gap-2">
                  New farmer? <span className="underline">Register here</span>
                  <Sprout size={16} />
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Already registered? <span className="underline">Sign in</span>
                </span>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
