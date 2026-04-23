import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db, auth, OperationType, handleFirestoreError } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Tag, ChevronRight, Clock, AlertCircle } from 'lucide-react';

interface Scan {
  id: string;
  uid: string;
  crop: string;
  disease: string;
  confidence: number;
  imageUrl: string;
  timestamp: string;
}

export default function ScanHistory() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const scansPath = 'scans';
    const q = query(
      collection(db, scansPath),
      where('uid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const scanList: Scan[] = [];
      snapshot.forEach((doc) => {
        scanList.push({ id: doc.id, ...doc.data() } as Scan);
      });
      // Sort client-side to avoid composite index requirement
      scanList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setScans(scanList);
      setLoading(false);
    }, (err) => {
      console.error("Scan history error:", err);
      setError("Failed to load scan history");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-4 border-forest/20 border-t-forest rounded-full animate-spin" />
      </div>
    );
  }

  if (scans.length === 0) {
    return (
      <div className="neu-card p-12 text-center space-y-4">
        <div className="neu-icon w-16 h-16 mx-auto bg-slate-50 text-slate-400">
          <Clock size={32} />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-800">No scans yet</h3>
          <p className="text-sm text-slate-500">Your crop analysis history will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800 px-2">Your Scan History</h2>
      <div className="grid gap-4">
        {scans.map((scan) => (
          <motion.div 
            key={scan.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="neu-card overflow-hidden flex"
          >
            <div className="w-24 h-24 shrink-0">
              <img 
                src={scan.imageUrl} 
                alt={scan.crop} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="p-4 flex-1 flex justify-between items-center">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{scan.crop}</span>
                  <span className="text-[10px] font-bold text-forest bg-forest/30 px-2 py-0.5 rounded-full">
                    {scan.confidence}%
                  </span>
                </div>
                <h3 className="font-bold text-slate-800 leading-tight">{scan.disease}</h3>
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Calendar size={10} />
                  <span>{new Date(scan.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
              <ChevronRight className="text-slate-300" size={20} />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
