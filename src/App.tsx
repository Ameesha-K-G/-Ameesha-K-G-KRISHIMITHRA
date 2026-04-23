/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Camera, 
  RefreshCw, 
  Droplets, 
  FlaskConical, 
  Scissors, 
  Languages, 
  History, 
  Info,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  X,
  Upload,
  LogOut,
  Users,
  Home,
  LayoutDashboard,
  Wifi,
  WifiOff,
  Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeCropDisease, DetectionResult } from './services/geminiService';
import { detectOffline, loadModel } from './services/tfliteService';
import { auth } from './firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { collection, addDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from './firebase';
import Auth from './components/Auth';
import AdminDashboard from './components/AdminDashboard';
import ScanHistory from './components/ScanHistory';

type Language = 'en' | 'ml';

const translations = {
  en: {
    title: 'Krishi-Mitra',
    subtitle: 'Kerala Crop Disease Guard',
    scanNow: 'Scan Crop',
    history: 'History',
    language: 'മലയാളം',
    detecting: 'Analyzing Leaf...',
    detectingOffline: 'Local Inference...',
    result: 'Detection Result',
    confidence: 'Confidence',
    treatment: 'Treatment Protocol',
    irrigation: 'Irrigation',
    pesticide: 'Pesticide',
    pruning: 'Pruning',
    retake: 'Scan Again',
    upload: 'Upload Image',
    noDisease: 'No disease detected. Your crop looks healthy!',
    error: 'Analysis failed. Please try again.',
    cameraAccess: 'Please allow camera access to scan crops.',
    keralaContext: 'Optimized for Coconut, Rubber, Banana, Paddy & Pepper',
    offlineMode: 'Offline Mode',
    onlineMode: 'Cloud Mode'
  },
  ml: {
    title: 'കൃഷി-മിത്ര',
    subtitle: 'കേരളത്തിലെ വിളരോഗ പ്രതിരോധം',
    scanNow: 'പരിശോധിക്കുക',
    history: 'ചരിത്രം',
    language: 'English',
    detecting: 'പരിശോധിക്കുന്നു...',
    detectingOffline: 'ലോക്കൽ പരിശോധന...',
    result: 'പരിശോധനാ ഫലം',
    confidence: 'ഉറപ്പ്',
    treatment: 'ചികിത്സാ രീതികൾ',
    irrigation: 'ജലസേചനം',
    pesticide: 'കീടനാശിനി',
    pruning: 'കത്തിക്കൽ/മാറ്റൽ',
    retake: 'വീണ്ടും നോക്കുക',
    upload: 'ചിത്രം അപ്‌ലോഡ് ചെയ്യുക',
    noDisease: 'രോഗങ്ങൾ ഒന്നും കണ്ടെത്തിയില്ല. വിള ആരോഗ്യകരമാണ്!',
    error: 'പരിശോധന പരാജയപ്പെട്ടു. ദയവായി വീണ്ടും ശ്രമിക്കുക.',
    cameraAccess: 'ക്യാമറ ഉപയോഗിക്കാൻ അനുവാദം നൽകുക.',
    keralaContext: 'തെങ്ങ്, റബ്ബർ, വാഴ, നെല്ല്, കുരുമുളക് എന്നിവയ്ക്കായി സജ്ജീകരിച്ചത്',
    offlineMode: 'ഓഫ്‌ലൈൻ മോഡ്',
    onlineMode: 'ക്ലൗഡ് മോഡ്'
  }
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showUserList, setShowUserList] = useState(false);
  const [showScanHistory, setShowScanHistory] = useState(false);
  const [lang, setLang] = useState<Language>('en');
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = translations[lang];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch user role
        try {
          const { doc, getDoc } = await import('firebase/firestore');
          console.log("Fetching role for UID:", currentUser.uid);
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            console.log("User doc found, role:", userDoc.data().role);
            setUserRole(userDoc.data().role);
          } else {
            console.log("User doc not found");
            if (currentUser.email === "ameeshakg@gmail.com") {
              console.log("User is hardcoded admin");
              setUserRole('admin');
            }
          }
        } catch (err) {
          console.error("Error fetching role:", err);
        }
      } else {
        setUserRole(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isOfflineMode) {
      loadModel().catch(err => console.error("Error pre-loading TFLite model:", err));
    }
  }, [isOfflineMode]);

  const isAdmin = userRole === 'admin' || user?.email === "ameeshakg@gmail.com";

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setResult(null);
      setCapturedImage(null);
      setShowUserList(false);
      setShowScanHistory(false);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const startCamera = async () => {
    setIsScanning(true);
    setResult(null);
    setError(null);
    setCapturedImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error("Camera error details:", err);
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission') || err.message?.includes('dismissed')) {
        setError("Camera access was denied or dismissed. Please reset permissions in your browser settings and try again.");
      } else {
        setError(t.cameraAccess);
      }
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsScanning(false);
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL('image/jpeg');
    setCapturedImage(base64Image);
    stopCamera();

    setIsAnalyzing(true);
    try {
      let data: DetectionResult;
      
      if (isOfflineMode) {
        console.log("Running offline inference...");
        const offlineResult = await detectOffline(base64Image);
        data = {
          ...offlineResult,
          localName: offlineResult.disease, // Placeholder
          description: `Offline diagnosis detecting ${offlineResult.disease}. For detailed AI insights, switch to Cloud Mode.`,
          treatment: {
            irrigation: offlineResult.recommendations[0],
            pesticide: offlineResult.recommendations[1],
            pruning: offlineResult.recommendations[2]
          }
        };
      } else {
        data = await analyzeCropDisease(base64Image, lang);
      }
      
      setResult(data);

      // Save scan to Firestore if user is logged in
      if (user) {
        const scanData = {
          uid: user.uid,
          crop: data.crop,
          disease: data.disease,
          confidence: data.confidence,
          imageUrl: base64Image,
          timestamp: new Date().toISOString()
        };
        const scanPath = 'scans';
        try {
          await addDoc(collection(db, scanPath), scanData);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, scanPath);
        }
      }
    } catch (err) {
      console.error("Analysis error:", err);
      setError(t.error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleLanguage = () => {
    setLang(prev => prev === 'en' ? 'ml' : 'en');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Image = reader.result as string;
      setCapturedImage(base64Image);
      setIsAnalyzing(true);
      setResult(null);
      setError(null);
      try {
        let data: DetectionResult;
        
        if (isOfflineMode) {
          const offlineResult = await detectOffline(base64Image);
          data = {
            ...offlineResult,
            localName: offlineResult.disease,
            description: `Offline diagnosis detecting ${offlineResult.disease}. For detailed AI insights, switch to Cloud Mode.`,
            treatment: {
              irrigation: offlineResult.recommendations[0],
              pesticide: offlineResult.recommendations[1],
              pruning: offlineResult.recommendations[2]
            }
          };
        } else {
          data = await analyzeCropDisease(base64Image, lang);
        }
        
        setResult(data);

        // Save scan to Firestore if user is logged in
        if (user) {
          const scanData = {
            uid: user.uid,
            crop: data.crop,
            disease: data.disease,
            confidence: data.confidence,
            imageUrl: base64Image,
            timestamp: new Date().toISOString()
          };
          const scanPath = 'scans';
          try {
            await addDoc(collection(db, scanPath), scanData);
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, scanPath);
          }
        }
      } catch (err) {
        console.error("Analysis error:", err);
        setError(t.error);
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-earth">
        <div className="w-12 h-12 border-4 border-forest/20 border-t-forest rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-earth py-12">
        <Auth onAuthSuccess={() => {}} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-2xl mx-auto">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-forest tracking-tight">{t.title}</h1>
            <p className="text-sm text-slate-500 font-medium">{t.subtitle}</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsOfflineMode(prev => !prev)}
              className={`neu-button p-3 flex items-center gap-2 font-bold ${isOfflineMode ? 'text-orange-600' : 'text-blue-600'}`}
              title={isOfflineMode ? t.offlineMode : t.onlineMode}
            >
              {isOfflineMode ? <WifiOff size={20} /> : <Wifi size={20} />}
              <span className="hidden sm:inline">{isOfflineMode ? t.offlineMode : t.onlineMode}</span>
            </button>
            <button 
              onClick={toggleLanguage}
              className="neu-button p-3 flex items-center gap-2 text-forest font-bold"
            >
              <Languages size={20} />
              <span className="hidden sm:inline">{t.language}</span>
            </button>
            <button 
              onClick={handleLogout}
              className="neu-button p-3 text-red-500"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <main className="space-y-8">
          {showUserList ? (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <AdminDashboard onBack={() => setShowUserList(false)} />
            </motion.div>
          ) : showScanHistory ? (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <button 
                onClick={() => setShowScanHistory(false)}
                className="neu-button mb-6 px-4 py-2 flex items-center gap-2 text-slate-600 font-bold"
              >
                <Home size={18} />
                Back to Scanner
              </button>
              <ScanHistory />
            </motion.div>
          ) : (
            <>
              {/* Main Action Area */}
              {!isScanning && !capturedImage && !result && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="neu-card p-8 text-center space-y-6"
                >
                  <div className="w-24 h-24 bg-leaf/10 rounded-full flex items-center justify-center mx-auto">
                    <Camera size={48} className="text-forest" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-slate-800">{t.scanNow}</h2>
                    <p className="text-sm text-slate-500 px-4">{t.keralaContext}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <button 
                      onClick={startCamera}
                      className="neu-button w-full py-5 text-xl font-bold text-forest flex items-center justify-center gap-3"
                    >
                      <Camera size={24} />
                      {t.scanNow}
                    </button>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="neu-button w-full py-5 text-xl font-bold text-slate-600 flex items-center justify-center gap-3"
                    >
                      <Upload size={24} />
                      {t.upload}
                    </button>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </motion.div>
              )}

              {/* Camera Preview */}
              {isScanning && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative neu-card overflow-hidden aspect-[3/4] bg-black"
                >
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Scanning Overlay */}
                  <div className="absolute inset-0 border-2 border-leaf/80 m-8 rounded-2xl pointer-events-none">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-leaf rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-leaf rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-leaf rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-leaf rounded-br-lg" />
                  </div>

                  <div className="absolute bottom-8 inset-x-0 flex justify-center gap-4 px-8">
                    <button 
                      onClick={stopCamera}
                      className="neu-button p-4 text-red-500 bg-white"
                    >
                      <X size={24} />
                    </button>
                    <button 
                      onClick={captureAndAnalyze}
                      className="neu-button flex-1 py-4 bg-forest text-white font-bold text-lg flex items-center justify-center gap-2"
                    >
                      <Camera size={24} />
                      {t.scanNow}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Hidden Canvas for capture */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Analysis Loading */}
              {isAnalyzing && (
                isOfflineMode ? (
                  <div className="neu-card p-12 text-center space-y-6">
                    <div className="relative w-20 h-20 mx-auto">
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 border-4 border-leaf/40 border-t-forest rounded-full"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Cpu size={24} className="text-forest animate-pulse" />
                      </div>
                    </div>
                    <p className="text-xl font-bold text-forest">{t.detectingOffline}</p>
                  </div>
                ) : (
                  <div className="neu-card p-12 text-center space-y-6">
                    <div className="relative w-20 h-20 mx-auto">
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 border-4 border-leaf/40 border-t-forest rounded-full"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <RefreshCw size={24} className="text-forest animate-pulse" />
                      </div>
                    </div>
                    <p className="text-xl font-bold text-forest">{t.detecting}</p>
                  </div>
                )
              )}

              {/* Results Dashboard */}
              {result && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6 pb-12"
                >
                  {/* Image Preview & Confidence */}
                  <div className="neu-card overflow-hidden">
                    {capturedImage && (
                      <img 
                        src={capturedImage} 
                        alt="Captured" 
                        className="w-full h-48 object-cover opacity-100"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="p-6 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{result.crop}</span>
                          <h2 className="text-2xl font-bold text-slate-800">{result.disease}</h2>
                          <p className="text-forest font-bold text-lg">{result.localName}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-black text-forest">{result.confidence}%</div>
                          <div className="text-xs font-bold text-slate-500 uppercase">{t.confidence}</div>
                        </div>
                      </div>
                      
                      {/* Confidence Bar */}
                      <div className="h-4 rounded-full overflow-hidden neu-inset p-1">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${result.confidence}%` }}
                          className={`h-full rounded-full ${result.confidence > 80 ? 'bg-forest' : 'bg-warning'} shadow-sm`}
                        />
                      </div>

                      <p className="text-slate-600 text-sm leading-relaxed">
                        {result.description}
                      </p>
                    </div>
                  </div>

                  {/* Treatment Protocol */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <CheckCircle2 className="text-forest" size={20} />
                      {t.treatment}
                    </h3>
                    
                    <div className="grid gap-4">
                      <TreatmentCard 
                        icon={<Droplets className="text-blue-500" />}
                        title={t.irrigation}
                        content={result.treatment.irrigation}
                      />
                      <TreatmentCard 
                        icon={<FlaskConical className="text-purple-500" />}
                        title={t.pesticide}
                        content={result.treatment.pesticide}
                      />
                      <TreatmentCard 
                        icon={<Scissors className="text-orange-500" />}
                        title={t.pruning}
                        content={result.treatment.pruning}
                      />
                    </div>
                  </div>

                  <button 
                    onClick={startCamera}
                    className="neu-button w-full py-5 text-xl font-bold text-forest flex items-center justify-center gap-3 mt-8"
                  >
                    <RefreshCw size={24} />
                    {t.retake}
                  </button>
                </motion.div>
              )}

              {/* Error State */}
              {error && (
                <div className="neu-card p-8 border-2 border-red-100 bg-red-50/30 text-center space-y-4">
                  <AlertTriangle className="mx-auto text-red-500" size={48} />
                  <p className="text-red-800 font-bold">{error}</p>
                  <button 
                    onClick={() => { setError(null); startCamera(); }}
                    className="neu-button px-6 py-3 text-forest font-bold"
                  >
                    {t.retake}
                  </button>
                </div>
              )}
            </>
          )}
        </main>

        {/* Footer Info */}
        {!isScanning && !isAnalyzing && !result && !showUserList && !showScanHistory && (
          <footer className="mt-12 text-center space-y-4">
            <div className="flex justify-center gap-6">
              {isAdmin && (
                <button 
                  onClick={() => { setShowUserList(true); setShowScanHistory(false); }}
                  className="neu-icon w-14 h-14 text-forest"
                  title="Admin Dashboard"
                >
                  <LayoutDashboard size={24} />
                </button>
              )}
              <button 
                onClick={() => { setShowScanHistory(true); setShowUserList(false); }}
                className="neu-icon w-14 h-14 text-forest"
                title="Scan History"
              >
                <History size={24} />
              </button>
              <div className="neu-icon w-14 h-14 text-forest">
                <Info size={24} />
              </div>
            </div>
            <p className="text-xs text-slate-600 font-medium">
              &copy; 2026 Krishi-Mitra • Team InnoveX • Offline Inference Enabled
            </p>
          </footer>
        )}
      </div>
    );
  }

function TreatmentCard({ icon, title, content }: { icon: React.ReactNode, title: string, content: string }) {
  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className="neu-card p-5 flex gap-4 items-start"
    >
      <div className="neu-button p-3 shrink-0">
        {icon}
      </div>
      <div className="space-y-1">
        <h4 className="font-bold text-slate-800">{title}</h4>
        <p className="text-sm text-slate-600 leading-snug">{content}</p>
      </div>
    </motion.div>
  );
}
