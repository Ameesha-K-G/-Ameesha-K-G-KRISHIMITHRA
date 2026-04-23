import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, auth, OperationType, handleFirestoreError } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  History, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  User, 
  MapPin, 
  Mail, 
  Calendar,
  ArrowLeft,
  LayoutDashboard,
  Activity
} from 'lucide-react';

interface UserProfile {
  uid: string;
  username: string;
  email: string;
  location: string;
  role: string;
  createdAt: string;
}

interface ScanRecord {
  id: string;
  uid: string;
  userName: string;
  crop: string;
  disease: string;
  confidence: number;
  timestamp: string;
  imageUrl?: string;
}

export default function AdminDashboard({ onBack }: { onBack: () => void }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'scans'>('overview');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    
    const startListeners = async () => {
      if (!auth.currentUser) return;

      try {
        // Verify permissions first with a single fetch
        await getDocs(query(collection(db, 'users'), limit(1)));
        
        if (!isMounted) return;

        // Listen to users
        const usersUnsubscribe = onSnapshot(
          query(collection(db, 'users'), orderBy('createdAt', 'desc')),
          (snapshot) => {
            if (!isMounted) return;
            const userList: UserProfile[] = [];
            snapshot.forEach((doc) => userList.push(doc.data() as UserProfile));
            setUsers(userList);
          },
          (err) => {
            if (!isMounted) return;
            console.error("Users fetch error:", err);
            setError("Access Denied. Admin permissions required.");
          }
        );

        // Listen to all scans
        const scansUnsubscribe = onSnapshot(
          query(collection(db, 'scans'), orderBy('timestamp', 'desc')),
          (snapshot) => {
            if (!isMounted) return;
            const scanList: ScanRecord[] = [];
            snapshot.forEach((doc) => scanList.push({ id: doc.id, ...doc.data() } as ScanRecord));
            setScans(scanList);
            setLoading(false);
          },
          (err) => {
            if (!isMounted) return;
            console.error("Scans fetch error:", err);
            setLoading(false);
          }
        );

        return () => {
          usersUnsubscribe();
          scansUnsubscribe();
        };
      } catch (err) {
        if (isMounted) {
          console.error("Dashboard permission check failed:", err);
          setError("Access Denied. Admin permissions required.");
          setLoading(false);
        }
      }
    };

    const cleanupPromise = startListeners();

    return () => {
      isMounted = false;
      cleanupPromise.then(cleanup => cleanup?.());
    };
  }, []);

  const stats = {
    totalUsers: users.length,
    totalScans: scans.length,
    healthyScans: scans.filter(s => s.disease.toLowerCase().includes('healthy') || s.disease.toLowerCase().includes('no disease')).length,
    diseasedScans: scans.length - scans.filter(s => s.disease.toLowerCase().includes('healthy') || s.disease.toLowerCase().includes('no disease')).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-24">
        <div className="w-12 h-12 border-4 border-forest/20 border-t-forest rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center space-y-4">
        <div className="neu-icon w-20 h-20 bg-red-50 text-red-500 mx-auto">
          <AlertTriangle size={40} />
        </div>
        <h2 className="text-2xl font-bold text-red-600">{error}</h2>
        <button onClick={onBack} className="neu-button px-6 py-2 text-slate-600 font-bold">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="neu-button p-3 text-slate-600">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-forest">Admin Dashboard</h2>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">Krishi-Mitra Control Center</p>
          </div>
        </div>
        <div className="neu-icon w-12 h-12 bg-forest text-white">
          <LayoutDashboard size={24} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-2 bg-earth/80 rounded-2xl neu-inset">
        {(['overview', 'users', 'scans'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === tab 
                ? 'bg-forest text-white shadow-lg' 
                : 'text-slate-500 hover:text-forest'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <StatCard icon={<Users size={20} />} label="Total Farmers" value={stats.totalUsers} color="text-forest" />
              <StatCard icon={<History size={20} />} label="Total Scans" value={stats.totalScans} color="text-blue-500" />
              <StatCard icon={<CheckCircle2 size={20} />} label="Healthy Crops" value={stats.healthyScans} color="text-leaf" />
              <StatCard icon={<AlertTriangle size={20} />} label="Diseased Found" value={stats.diseasedScans} color="text-red-500" />
            </div>

            {/* Recent Activity */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Activity size={20} className="text-forest" />
                Recent Activity
              </h3>
              <div className="space-y-3">
                {scans.slice(0, 5).map((scan) => (
                  <div key={scan.id} className="neu-card p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-earth flex items-center justify-center">
                        <User size={18} className="text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{scan.userName}</p>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                          {new Date(scan.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${scan.disease.toLowerCase().includes('healthy') ? 'text-leaf' : 'text-red-500'}`}>
                        {scan.disease}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold">{Math.round(scan.confidence * 100)}% Match</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'users' && (
          <motion.div
            key="users"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 gap-4"
          >
            {users.map((user) => (
              <div key={user.uid} className="neu-card p-5 space-y-3">
                <div className="flex items-center gap-4">
                  <div className="neu-icon w-10 h-10 bg-forest/30 text-forest">
                    <User size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">{user.username}</h4>
                    <p className="text-[10px] font-bold text-forest uppercase tracking-widest">{user.role}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <Mail size={14} /> {user.email}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={14} /> {user.location}
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === 'scans' && (
          <motion.div
            key="scans"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {scans.map((scan) => (
              <div key={scan.id} className="neu-card p-4 flex gap-4">
                {scan.imageUrl && (
                  <img 
                    src={scan.imageUrl} 
                    alt="Scan" 
                    className="w-20 h-20 rounded-xl object-cover border border-slate-100"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-slate-800">{scan.disease}</h4>
                    <span className="text-[10px] font-bold text-slate-400">{new Date(scan.timestamp).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-slate-500">Farmer: {scan.userName}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-earth rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${scan.confidence > 0.8 ? 'bg-leaf' : 'bg-forest'}`}
                        style={{ width: `${scan.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-600">{Math.round(scan.confidence * 100)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: number, color: string }) {
  return (
    <div className="neu-card p-5 space-y-2">
      <div className={`neu-button p-2 w-fit ${color} bg-white`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-black text-slate-800">{value}</p>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}
