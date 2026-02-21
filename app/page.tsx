"use client";
import React, { useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  onSnapshot, 
  updateDoc, 
  addDoc 
} from 'firebase/firestore';
import { 
  Youtube, Wallet, LayoutDashboard, PlusCircle, ShieldCheck, 
  CheckCircle2, AlertCircle, Send, Loader2, Menu, X, LogOut, ChevronRight 
} from 'lucide-react';

// --- CONFIG VE INIT ---
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// SSR uyumluluğu için app kontrolü
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "shorts-v1";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  // Auth Takibi
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setLoading(false);
        setUserData(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Veri Senkronizasyonu
  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid);
    const unsubUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserData(docSnap.data());
      } else {
        const initial = { 
          uid: user.uid, 
          credits: 1, 
          role: 'user', 
          isAuthorized: false, 
          name: user.displayName || 'Kullanıcı',
          email: user.email 
        };
        setDoc(userDocRef, initial);
        setUserData(initial);
      }
      setLoading(false);
    });

    const unsubPayments = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'payments'), (snap) => {
      const p = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPendingPayments(p.sort((a: any, b: any) => b.timestamp - a.timestamp));
    });

    return () => { unsubUser(); unsubPayments(); };
  }, [user]);

  const showFeedback = (text: string, type: 'success' | 'error') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/youtube.upload');
    try {
      await signInWithPopup(auth, provider);
      showFeedback("Giriş Başarılı!", "success");
    } catch (e) { 
      showFeedback("Giriş yapılamadı", "error"); 
    }
  };

  const handleLogout = () => signOut(auth);

  const submitPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsProcessing(true);
    const formData = new FormData(e.currentTarget);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'payments'), {
        userId: user.uid, 
        userName: userData.name, 
        orderNo: formData.get('orderNo'),
        amount: formData.get('amount'), 
        status: 'pending', 
        timestamp: Date.now()
      });
      showFeedback("Bildirim gönderildi. Onay bekliyor.", "success");
      (e.target as HTMLFormElement).reset();
    } catch (e) { 
      showFeedback("Bildirim gönderilemedi", "error"); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  const approvePayment = async (payment: any) => {
    try {
      const userRef = doc(db, 'artifacts', appId, 'users', payment.userId);
      const userSnap = await getDoc(userRef);
      const current = userSnap.data()?.credits || 0;
      
      const creditsToAdd = payment.amount === '50' ? 5 : 12;
      
      await updateDoc(userRef, { credits: current + creditsToAdd });
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'payments', payment.id), { status: 'approved' });
      
      showFeedback("Ödeme onaylandı ve kredi tanımlandı!", "success");
    } catch (e) { 
      showFeedback("Onaylama sırasında hata oluştu", "error"); 
    }
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-950 text-indigo-500">
      <Loader2 className="animate-spin" size={48} />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col md:flex-row">
      {/* Toast Bildirimleri */}
      {feedback && (
        <div className={`fixed top-4 right-4 z-[100] p-4 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce ${feedback.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'} text-white`}>
          {feedback.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold">{feedback.text}</span>
        </div>
      )}

      {user ? (
        <>
          {/* Masaüstü Sidebar */}
          <aside className="hidden md:flex w-64 bg-slate-900 border-r border-white/5 flex-col p-6 space-y-8">
            <div className="flex items-center gap-2 text-white font-black text-xl tracking-tighter uppercase italic">
              <Youtube className="text-red-600" /> Shorty.AI
            </div>
            
            <nav className="flex-1 space-y-2">
              <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 p-3 rounded-lg transition ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'hover:bg-white/5 text-slate-400'}`}>
                <LayoutDashboard size={20} /> Panel
              </button>
              <button onClick={() => setActiveTab('billing')} className={`w-full flex items-center gap-3 p-3 rounded-lg transition ${activeTab === 'billing' ? 'bg-indigo-600 text-white' : 'hover:bg-white/5 text-slate-400'}`}>
                <Wallet size={20} /> Kredi Yükle
              </button>
              {userData?.role === 'admin' && (
                <button onClick={() => setActiveTab('admin')} className={`w-full flex items-center gap-3 p-3 rounded-lg transition ${activeTab === 'admin' ? 'bg-indigo-600 text-white' : 'hover:bg-white/5 text-indigo-400 font-bold'}`}>
                  <ShieldCheck size={20} /> Yönetici
                </button>
              )}
            </nav>

            <button onClick={handleLogout} className="flex items-center gap-2 text-slate-500 hover:text-rose-500 transition p-2 font-bold text-sm uppercase italic">
              <LogOut size={18} /> Çıkış
            </button>
          </aside>

          {/* Ana İçerik */}
          <main className="flex-1 p-6 md:p-12 overflow-y-auto">
            {activeTab === 'dashboard' && (
              <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <header>
                  <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-2">Hoş Geldin, {userData?.name}</h1>
                  <p className="text-slate-400">YouTube kanalını büyütmek için tüm araçlar burada.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 rounded-3xl shadow-xl shadow-indigo-900/20 relative overflow-hidden group">
                    <div className="relative z-10 space-y-4">
                      <h3 className="text-xl font-bold text-white uppercase italic tracking-wider">Mevcut Bakiyeniz</h3>
                      <p className="text-5xl font-black text-white">{userData?.credits} <span className="text-lg font-normal opacity-70">Video Kredisi</span></p>
                      <button onClick={() => setActiveTab('billing')} className="bg-white text-indigo-700 px-6 py-2 rounded-full font-bold text-sm shadow-lg hover:scale-105 transition uppercase tracking-tighter italic">Kredi Satın Al</button>
                    </div>
                    <Wallet className="absolute -right-8 -bottom-8 w-48 h-48 text-white/10 rotate-12 group-hover:rotate-6 transition-transform duration-700" />
                  </div>

                  <div className="bg-slate-900 border border-white/5 p-8 rounded-3xl flex flex-col justify-between hover:border-indigo-500/30 transition group shadow-2xl">
                    <div className="space-y-4">
                      <div className="bg-indigo-500/10 w-fit p-3 rounded-2xl text-indigo-500"><PlusCircle size={32} /></div>
                      <h3 className="text-xl font-bold text-white uppercase italic tracking-wider">Otomatik Shorts Üret</h3>
                      <p className="text-slate-400 text-sm">Trendleri analiz et, videoyu üret ve doğrudan kanalına yükle.</p>
                    </div>
                    <button disabled={userData?.credits < 1} className="mt-8 bg-slate-800 hover:bg-indigo-600 text-white py-4 rounded-xl font-black italic tracking-widest uppercase text-sm disabled:opacity-30 transition transform active:scale-95 shadow-xl">
                      Video Üret (1 Kredi)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="max-w-xl mx-auto space-y-8 animate-in slide-in-from-bottom-10">
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Kredi Yükle</h2>
                  <p className="text-slate-400">Shopier ödemenizi yaptıktan sonra bildirim formunu doldurun.</p>
                </div>

                <form onSubmit={submitPayment} className="bg-slate-900 border border-white/5 p-8 rounded-3xl space-y-6 shadow-2xl">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1 italic">Shopier Sipariş No</label>
                      <input name="orderNo" required className="w-full bg-slate-950 border border-white/5 rounded-xl p-4 focus:ring-2 focus:ring-indigo-600 outline-none text-white font-mono placeholder:opacity-30" placeholder="Örn: 551023..." />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1 italic">Paket Seçimi</label>
                      <select name="amount" className="w-full bg-slate-950 border border-white/5 rounded-xl p-4 focus:ring-2 focus:ring-indigo-600 outline-none text-white appearance-none font-bold uppercase italic tracking-tighter">
                        <option value="50">Başlangıç (5 Video) - 50 TL</option>
                        <option value="100">Profesyonel (12 Video) - 100 TL</option>
                        <option value="200">Elite (30 Video) - 200 TL</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" disabled={isProcessing} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-5 rounded-xl font-black text-lg transition shadow-xl shadow-indigo-900/30 disabled:opacity-50 flex items-center justify-center gap-3 italic uppercase tracking-widest">
                    {isProcessing ? <Loader2 className="animate-spin" /> : <><Send size={20} /> Bildirimi Gönder</>}
                  </button>
                </form>

                <div className="bg-indigo-600/5 border border-indigo-500/10 p-6 rounded-2xl flex items-start gap-4">
                  <AlertCircle className="text-indigo-400 flex-shrink-0 mt-1" size={24} />
                  <p className="text-xs text-indigo-300 leading-relaxed font-medium">
                    Ödemeniz onaylandığında krediniz hesabınıza otomatik olarak eklenecektir. Ortalama onay süresi 15 dakikadır.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'admin' && userData?.role === 'admin' && (
              <div className="space-y-8 animate-in fade-in">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter flex items-center gap-4">
                    <ShieldCheck size={36} className="text-indigo-500" /> Ödeme Onayları
                  </h2>
                  <div className="bg-indigo-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase italic">
                    {pendingPayments.filter(p => p.status === 'pending').length} Bekleyen
                  </div>
                </div>
                
                <div className="bg-slate-900 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                  <table className="w-full text-left">
                    <thead className="bg-white/5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">
                      <tr>
                        <th className="p-6 italic">Kullanıcı</th>
                        <th className="p-6 italic">Sipariş / Tutar</th>
                        <th className="p-6 italic">Durum</th>
                        <th className="p-6 text-right italic">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm">
                      {pendingPayments.map((p: any) => (
                        <tr key={p.id} className="hover:bg-white/[0.02] transition">
                          <td className="p-6 font-bold text-white">{p.userName}</td>
                          <td className="p-6">
                            <p className="font-mono text-indigo-400 font-bold tracking-tighter uppercase italic">#{p.orderNo}</p>
                            <p className="text-xs opacity-50">{p.amount} TL</p>
                          </td>
                          <td className="p-6">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${p.status === 'pending' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                              {p.status === 'pending' ? 'Bekliyor' : 'Onaylandı'}
                            </span>
                          </td>
                          <td className="p-6 text-right">
                            {p.status === 'pending' && (
                              <button onClick={() => approvePayment(p)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-900/20 italic uppercase tracking-widest">
                                Onayla
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {pendingPayments.length === 0 && (
                    <div className="p-20 text-center opacity-30 italic text-sm">Bildirim bulunmuyor.</div>
                  )}
                </div>
              </div>
            )}
          </main>
        </>
      ) : (
        /* Giriş Ekranı */
        <div className="h-screen w-full flex items-center justify-center p-6 relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
          <div className="max-w-md w-full bg-slate-900/50 backdrop-blur-xl border border-white/5 p-12 rounded-[3rem] shadow-2xl relative z-10 text-center space-y-8 animate-in zoom-in-95 duration-700">
            <div className="flex justify-center mb-4">
              <div className="bg-red-600 p-4 rounded-3xl text-white shadow-2xl shadow-red-900/40 rotate-12 hover:rotate-0 transition-transform duration-500 cursor-default">
                <Youtube size={48} />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase">Shorty.AI</h1>
              <p className="text-slate-400 font-medium">YouTube otomasyonunun geleceğine hoş geldiniz. Başlamak için giriş yapın.</p>
            </div>
            <button onClick={handleLogin} className="w-full bg-white text-slate-950 p-5 rounded-2xl font-black text-lg transition shadow-xl hover:shadow-white/10 hover:-translate-y-1 flex items-center justify-center gap-4 group italic uppercase tracking-widest">
              <div className="bg-red-500 rounded-full p-1 text-white group-hover:scale-110 transition"><Youtube size={20} /></div>
              Google ile Giriş Yap
            </button>
            <div className="pt-4 flex items-center gap-4 justify-center opacity-30 grayscale pointer-events-none">
              <ShieldCheck size={16} /> <span className="text-[10px] font-black uppercase tracking-[0.2em] italic">Secure Access & YouTube API V3</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}