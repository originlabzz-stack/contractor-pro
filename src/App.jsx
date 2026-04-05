import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, Building, Calendar, ClipboardList, Wallet, 
  Plus, FileSpreadsheet, Receipt, Trash2, Download, 
  Cloud, Settings, Lock, Eye, LogOut, Wrench, AlertTriangle 
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot, 
  collection, 
  getDocs, 
  query, 
  where 
} from 'firebase/firestore';

// =========================================================
// FIREBASE CONFIGURATION
// =========================================================
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_APP_ID,
  measurementId: process.env.REACT_APP_MEASUREMENT_ID
};

// =========================================================
// FIREBASE INITIALIZATION
// =========================================================
let auth, db;
const isConfigValid = firebaseConfig.apiKey && firebaseConfig.apiKey.length > 0;

if (isConfigValid) {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase Initialization Error:", e);
  }
}

const appId = "contractor_tracker_v1";

export default function App() {
  const [role, setRole] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [showAdminSetup, setShowAdminSetup] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [setupError, setSetupError] = useState('');

  const [activeTab, setActiveTab] = useState('daily');
  const [workers, setWorkers] = useState([]);
  const [sites, setSites] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [siteExpenses, setSiteExpenses] = useState([]);
  const [weeklyOverrides, setWeeklyOverrides] = useState({});
  const [inventory, setInventory] = useState([]);
  
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [reportSite, setReportSite] = useState('');
  const [reportPeriodType, setReportPeriodType] = useState('monthly');
  const [reportWeekDate, setReportWeekDate] = useState(new Date().toISOString().split('T')[0]);
  const [confirmClear, setConfirmClear] = useState(false);
  
  const [user, setUser] = useState(null);
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [syncStatus, setSyncStatus] = useState(isConfigValid ? 'Connecting...' : 'Offline Mode');

  // --- Auth logic ---
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      if (authUser) {
        try {
          const adminRef = collection(db, 'admins');
          const adminQuery = query(adminRef, where('uid', '==', authUser.uid));
          const adminSnap = await getDocs(adminQuery);
          if (adminSnap.size > 0) {
            setRole('admin');
          } else {
            setRole('viewer');
          }
        } catch (e) {
          console.error("Auth role check error:", e);
          setRole('viewer');
        }
      }
    });
    return () => unsubscribe();
  }, [auth]); // added auth dependency

  // --- Data Fetching ---
  useEffect(() => {
    if (!user || !db) return;
    const docRef = doc(db, 'dashboard_data', appId);
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.workers) setWorkers(data.workers);
        if (data.sites) setSites(data.sites);
        if (data.attendance) setAttendance(data.attendance);
        if (data.siteExpenses) setSiteExpenses(data.siteExpenses);
        if (data.weeklyOverrides) setWeeklyOverrides(data.weeklyOverrides);
        if (data.inventory) setInventory(data.inventory);
      }
      setIsCloudSynced(true);
      setSyncStatus('Synced');
    }, (err) => {
      console.error("Firestore error", err);
      setSyncStatus('Cloud Locked');
    });
    return () => unsub();
  }, [user]);

  // --- Auto-Save logic ---
  useEffect(() => {
    if (!user || !db || !isCloudSynced || role !== 'admin') return;
    setSyncStatus('Saving...');
    const saveData = async () => {
      try {
        const docRef = doc(db, 'dashboard_data', appId);
        await setDoc(docRef, {
          workers, sites, attendance, siteExpenses, weeklyOverrides, inventory,
          lastUpdated: new Date().toISOString()
        });
        setSyncStatus('Synced');
      } catch (error) {
        console.error("Save error", error);
        setSyncStatus('Error');
      }
    };
    const timeoutId = setTimeout(saveData, 1500);
    return () => clearTimeout(timeoutId);
  }, [workers, sites, attendance, siteExpenses, weeklyOverrides, inventory, isCloudSynced, user, role]);

  const handleSecureLogin = async (e) => {
    e.preventDefault();
    if (!auth) return;
    setLoginError('');

    try {
      if (!loginEmail.trim() || !loginPassword) {
        setLoginError('Please enter both email and password');
        return;
      }

      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      
      const adminRef = collection(db, 'admins');
      const adminQuery = query(adminRef, where('uid', '==', userCredential.user.uid));
      const adminSnap = await getDocs(adminQuery);
      
      if (adminSnap.size > 0) {
        setRole('admin');
      } else {
        setRole('viewer');
      }
      
      setLoginEmail('');
      setLoginPassword('');
    } catch (error) {
      console.error("Login error:", error);
      if (error.code === 'auth/user-not-found') {
        setLoginError('Email not found.');
      } else if (error.code === 'auth/wrong-password') {
        setLoginError('Incorrect password.');
      } else {
        setLoginError('Login failed.');
      }
    }
  };

  const handleViewerLogin = () => {
    setRole('viewer');
    setLoginEmail('');
    setLoginPassword('');
  };

  const handleAdminSetup = async (e) => {
    e.preventDefault();
    if (!auth) return;
    setSetupError('');

    try {
      if (!adminEmail.trim() || !adminPassword || !adminPasswordConfirm) {
        setSetupError('Please fill in all fields');
        return;
      }
      if (adminPassword !== adminPasswordConfirm) {
        setSetupError('Passwords do not match');
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
      const adminDocRef = doc(collection(db, 'admins'), userCredential.user.uid);
      await setDoc(adminDocRef, {
        uid: userCredential.user.uid,
        email: adminEmail,
        createdAt: new Date().toISOString(),
        isAdmin: true
      });

      setTimeout(() => setShowAdminSetup(false), 2000);
    } catch (error) {
      setSetupError(error.message);
    }
  };

  const handleAttendanceChange = (workerId, field, value) => {
    if (role !== 'admin') return;
    setAttendance((prev) => {
      const dayData = prev[currentDate] || {};
      const workerData = dayData[workerId] || { present: false, site: '', advance: 0 };
      return {
        ...prev,
        [currentDate]: { ...dayData, [workerId]: { ...workerData, [field]: value } }
      };
    });
  };

  const handleAddWorker = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const name = formData.get('name');
    const wage = parseInt(formData.get('wage'), 10);
    if (name && !isNaN(wage)) {
      setWorkers([...workers, { id: Date.now(), name, dailyWage: wage, loanBalance: 0 }]);
      e.target.reset();
    }
  };

  const handleAddSite = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const site = formData.get('site');
    if (site) {
      setSites([...sites, site]);
      e.target.reset();
    }
  };

  const handleAddExpense = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const site = formData.get('site');
    const desc = formData.get('desc');
    const amount = parseInt(formData.get('amount'), 10);
    if (site && desc && !isNaN(amount)) {
      setSiteExpenses([...siteExpenses, { id: Date.now(), date: currentDate, site, description: desc, amount }]);
      e.target.reset();
    }
  };

  const handleDeleteWorker = (id) => {
    if (role === 'admin') setWorkers(workers.filter((w) => w.id !== id));
  };

  const handleDeleteSite = (site) => {
    if (role === 'admin') setSites(sites.filter((s) => s !== site));
  };

  const handleClearData = () => {
    setAttendance({});
    setSiteExpenses([]);
    setConfirmClear(false);
  };

  const getStartOfWeek = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff)).toISOString().split('T')[0];
  };

  const getDatesOfWeek = (startDate) => {
    const dates = [];
    let start = new Date(startDate);
    for (let i = 0; i < 7; i++) {
      dates.push(new Date(start).toISOString().split('T')[0]);
      start.setDate(start.getDate() + 1);
    }
    return dates;
  };

  const currentWeekStart = getStartOfWeek(currentDate);
  const reportWeekStart = getStartOfWeek(reportWeekDate);
  const reportWeekDates = useMemo(() => getDatesOfWeek(reportWeekStart), [reportWeekStart]);

  const weeklyData = useMemo(() => {
    const weekDates = getDatesOfWeek(currentWeekStart);
    return workers.map((worker) => {
      let daysWorked = 0;
      let totalAdvancesThisWeek = 0;
      weekDates.forEach(date => {
        const dayRecord = attendance[date]?.[worker.id];
        if (dayRecord?.present) daysWorked += 1;
        if (dayRecord?.advance) totalAdvancesThisWeek += parseInt(dayRecord.advance || 0, 10);
      });
      const totalEarned = daysWorked * worker.dailyWage;
      const totalAdvances = totalAdvancesThisWeek + (worker.loanBalance || 0);
      return {
        ...worker,
        daysWorked,
        totalEarned,
        totalAdvances,
        finalPayout: Math.max(0, totalEarned - totalAdvances)
      };
    });
  }, [workers, attendance, currentWeekStart]);

  const reportInfo = useMemo(() => {
    if (!reportSite) return { data: [], totalLabor: 0, totalMaterials: 0 };
    let reportData = [];
    let totalLabor = 0;
    let totalMaterials = 0;
    Object.entries(attendance).forEach(([dateStr, dayData]) => {
      const isInRange = reportPeriodType === 'monthly' ? dateStr.startsWith(reportMonth) : reportWeekDates.includes(dateStr);
      if (isInRange) {
        Object.entries(dayData || {}).forEach(([workerId, record]) => {
          if (record?.present && record?.site === reportSite) {
            const worker = workers.find((w) => w.id.toString() === workerId);
            if (worker) {
              reportData.push({ date: dateStr, type: 'Labor', desc: `Wage: ${worker.name}`, amount: worker.dailyWage });
              totalLabor += worker.dailyWage;
            }
          }
        });
      }
    });
    siteExpenses.forEach((exp) => {
      const isInRange = reportPeriodType === 'monthly' ? exp.date.startsWith(reportMonth) : reportWeekDates.includes(exp.date);
      if (isInRange && exp.site === reportSite) {
        reportData.push({ date: exp.date, type: 'Material', desc: exp.description, amount: exp.amount });
        totalMaterials += exp.amount;
      }
    });
    return { data: reportData, totalLabor, totalMaterials };
  }, [attendance, siteExpenses, reportSite, reportMonth, reportPeriodType, reportWeekDates, workers]);

  const exportWeeklyCSV = () => {
    const utf8BOM = "\uFEFF";
    const headers = ['Worker', 'Days Worked', 'Total Earned', 'Total Advances Taken', 'Final Cash to Pay'];
    const rows = weeklyData.map(d => [d.name, d.daysWorked, d.totalEarned, d.totalAdvances, d.finalPayout]);
    const csvContent = "data:text/csv;charset=utf-8," + utf8BOM + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Weekly_Settlement_${currentWeekStart}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportMasterAttendanceCSV = () => {
    const utf8BOM = "\uFEFF";
    const headers = ['Date', 'Worker Name', 'Assigned Site', 'Present', 'Advance Given (₹)'];
    const rows = [];
    Object.entries(attendance).forEach(([dateStr, dayData]) => {
      Object.entries(dayData).forEach(([workerId, record]) => {
        const worker = workers.find((w) => w.id.toString() === workerId);
        if (worker) rows.push([dateStr, worker.name, record.site || 'None', record.present ? 'Yes' : 'No', record.advance || 0]);
      });
    });
    const csvContent = "data:text/csv;charset=utf-8," + utf8BOM + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Attendance_Backup.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportMasterExpensesCSV = () => {
    const utf8BOM = "\uFEFF";
    const headers = ['Date', 'Site', 'Description', 'Amount (₹)'];
    const rows = siteExpenses.map((exp) => [exp.date, exp.site, exp.description, exp.amount]);
    const csvContent = "data:text/csv;charset=utf-8," + utf8BOM + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Expense_Backup.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isConfigValid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-100">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-red-200 text-center max-w-md text-slate-800">
          <AlertTriangle className="text-red-500 mx-auto mb-4" size={48} />
          <h2 className="text-xl font-bold mb-2">Configuration Required</h2>
          <p className="text-slate-600 mb-6">Please provide valid Firebase credentials in the <code className="bg-slate-100 px-1 rounded">firebaseConfig</code> object to enable cloud syncing.</p>
          <button onClick={handleViewerLogin} className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold">Try Offline Viewer Mode</button>
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 text-slate-800">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
          <div className="bg-slate-900 p-8 text-center text-white">
            <Building className="text-yellow-400 mx-auto mb-3" size={48} />
            <h1 className="text-2xl font-bold">Contractor Pro</h1>
          </div>
          {showAdminSetup ? (
            <div className="p-8 space-y-6">
              <button onClick={() => setShowAdminSetup(false)} className="text-slate-500 mb-4">← Back</button>
              <form onSubmit={handleAdminSetup} className="space-y-3">
                <input type="email" placeholder="Admin Email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className="w-full p-3 border rounded-lg" />
                <input type="password" placeholder="Password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full p-3 border rounded-lg" />
                <input type="password" placeholder="Confirm" value={adminPasswordConfirm} onChange={(e) => setAdminPasswordConfirm(e.target.value)} className="w-full p-3 border rounded-lg" />
                {setupError && <p className="text-red-500 text-sm">{setupError}</p>}
                <button type="submit" className="w-full bg-green-600 text-white py-3 rounded-lg font-bold">Create Account</button>
              </form>
            </div>
          ) : (
            <div className="p-8 space-y-8">
              <form onSubmit={handleSecureLogin} className="space-y-3">
                <input type="email" placeholder="Email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full p-3 border rounded-lg" />
                <input type="password" placeholder="Password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full p-3 border rounded-lg" />
                {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
                <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">Login</button>
                <button type="button" onClick={() => setShowAdminSetup(true)} className="w-full text-blue-600 text-sm">Create Admin</button>
              </form>
              <div className="border-t pt-4">
                <button onClick={handleViewerLogin} className="w-full bg-slate-50 border py-3 rounded-lg font-bold text-slate-600">View Data (No Password)</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-slate-900 text-white p-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Building className="text-yellow-400" />
            <h1 className="text-xl font-bold">Contractor Pro</h1>
            <span className="bg-blue-600 px-2 py-0.5 rounded text-[10px] uppercase font-bold">{role.toUpperCase()}</span>
            <span className="text-[10px] text-slate-400 ml-2 uppercase font-bold tracking-wider">{syncStatus}</span>
          </div>
          <nav className="flex bg-slate-800 rounded-lg p-1 overflow-x-auto w-full md:w-auto">
            <button onClick={() => setActiveTab('daily')} className={`px-3 py-1.5 rounded-md text-sm transition-colors ${activeTab === 'daily' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}>Daily</button>
            <button onClick={() => setActiveTab('weekly')} className={`px-3 py-1.5 rounded-md text-sm transition-colors ${activeTab === 'weekly' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}>Weekly</button>
            {role === 'admin' && (
              <>
                <button onClick={() => setActiveTab('reports')} className={`px-3 py-1.5 rounded-md text-sm transition-colors ${activeTab === 'reports' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}>Reports</button>
                <button onClick={() => setActiveTab('tools')} className={`px-3 py-1.5 rounded-md text-sm transition-colors ${activeTab === 'tools' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}>Tools</button>
                <button onClick={() => setActiveTab('manage')} className={`px-3 py-1.5 rounded-md text-sm transition-colors ${activeTab === 'manage' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}>Manage</button>
                <button onClick={() => setActiveTab('settings')} className={`px-3 py-1.5 rounded-md text-sm transition-colors ${activeTab === 'settings' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}>Settings</button>
              </>
            )}
            <button onClick={() => setRole(null)} className="p-1.5 text-slate-500 hover:text-red-400 ml-2"><LogOut size={18} /></button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {activeTab === 'daily' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold flex items-center gap-2"><ClipboardList className="text-blue-600" /> Attendance Log</h2>
              <input type="date" value={currentDate} onChange={(e) => setCurrentDate(e.target.value)} className="p-2 border rounded-lg text-sm bg-white" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-100 font-bold text-xs uppercase tracking-wider text-slate-500">
                  <tr><th className="p-4">Worker</th><th className="p-4 text-center">Present</th><th className="p-4">Site</th><th className="p-4">Advance</th></tr>
                </thead>
                <tbody>
                  {workers.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-400">Add workers in the Manage tab to begin.</td></tr>
                  ) : workers.map((worker) => {
                    const data = attendance[currentDate]?.[worker.id] || { present: false, site: '', advance: '' };
                    return (
                      <tr key={worker.id} className="border-b hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-medium">{worker.name} <span className="text-[10px] text-slate-400 block font-bold">₹{worker.dailyWage}/DAY</span></td>
                        <td className="p-4 text-center">
                          <input type="checkbox" checked={data.present} onChange={(e) => handleAttendanceChange(worker.id, 'present', e.target.checked)} disabled={role !== 'admin'} className="w-5 h-5 cursor-pointer" />
                        </td>
                        <td className="p-4">
                          <select value={data.site} onChange={(e) => handleAttendanceChange(worker.id, 'site', e.target.value)} disabled={role !== 'admin' || !data.present} className="w-full p-2 border rounded bg-white text-sm">
                            <option value="">Select Site...</option>
                            {sites.map((s, i) => <option key={i} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="p-4">
                          <input type="number" value={data.advance || ''} onChange={(e) => handleAttendanceChange(worker.id, 'advance', e.target.value)} disabled={role !== 'admin'} className="w-full p-2 border rounded text-sm bg-white" placeholder="₹ 0" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {role === 'admin' && (
              <div className="p-6 bg-slate-50 border-t border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><Receipt className="text-orange-500" size={16} /> Site Material Expenses ({currentDate})</h3>
                <form onSubmit={handleAddExpense} className="flex flex-wrap gap-3 items-end">
                  <select required name="site" className="flex-1 min-w-[150px] p-2 border border-slate-300 rounded text-sm bg-white">
                    <option value="">Select Site...</option>
                    {sites.map((s, i) => <option key={i} value={s}>{s}</option>)}
                  </select>
                  <input required name="desc" placeholder="Expense description..." className="flex-[2] min-w-[200px] p-2 border border-slate-300 rounded text-sm" />
                  <input required name="amount" type="number" placeholder="Amount" className="flex-1 min-w-[100px] p-2 border border-slate-300 rounded text-sm" />
                  <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white p-2 rounded transition-colors font-bold shadow-sm">Add</button>
                </form>
              </div>
            )}
          </div>
        )}

        {activeTab === 'weekly' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-bold">Settlement for week of {currentWeekStart}</h2>
              {role === 'admin' && <button onClick={exportWeeklyCSV} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 shadow-sm"><Download size={14} /> Export CSV</button>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-100 font-bold text-xs uppercase text-slate-500">
                  <tr><th className="p-4">Worker</th><th className="p-4 text-center">Days</th><th className="p-4 text-right">Earned</th><th className="p-4 text-right">Advance</th><th className="p-4 text-right">Payout</th></tr>
                </thead>
                <tbody>
                  {weeklyData.map((w) => (
                    <tr key={w.id} className="border-b">
                      <td className="p-4 font-medium">{w.name}</td>
                      <td className="p-4 text-center font-bold">{w.daysWorked}</td>
                      <td className="p-4 text-right">₹{w.totalEarned}</td>
                      <td className="p-4 text-right">₹{w.totalAdvances}</td>
                      <td className="p-4 text-right font-bold text-green-600">₹{w.finalPayout}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reports' && role === 'admin' && (
           <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-slate-400">
             <FileSpreadsheet className="mx-auto mb-4 opacity-20" size={48} />
             <p className="font-bold uppercase tracking-widest text-xs">Site Reports: {reportInfo.data.length} records processed</p>
             <p className="text-sm mt-1">Total Labor: ₹{reportInfo.totalLabor} | Total Materials: ₹{reportInfo.totalMaterials}</p>
           </div>
        )}

        {activeTab === 'tools' && role === 'admin' && (
           <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-slate-400">
             <Wrench className="mx-auto mb-4 opacity-20" size={48} />
             <p className="font-bold uppercase tracking-widest text-xs">Tool Tracking System</p>
           </div>
        )}

        {activeTab === 'manage' && role === 'admin' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <h2 className="font-bold mb-4 flex items-center gap-2"><Users size={20} className="text-blue-600" /> Manage Workers</h2>
              <form onSubmit={handleAddWorker} className="space-y-2">
                <input required name="name" placeholder="Full Name" className="w-full p-2 border rounded text-sm" />
                <input required name="wage" type="number" placeholder="Daily Wage (₹)" className="w-full p-2 border rounded text-sm" />
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded transition-colors font-bold shadow-sm flex items-center justify-center gap-2"><Plus size={16} /> Add Worker</button>
              </form>
              <div className="mt-4 space-y-1">
                {workers.map((w) => (
                  <div key={w.id} className="flex justify-between items-center p-2 bg-slate-50 rounded border group">
                    <span className="text-sm font-medium">{w.name} (₹{w.dailyWage})</span>
                    <button onClick={() => handleDeleteWorker(w.id)} className="text-red-300 hover:text-red-600 transition-colors"><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <h2 className="font-bold mb-4 flex items-center gap-2"><Building size={20} className="text-blue-600" /> Manage Sites</h2>
              <form onSubmit={handleAddSite} className="flex gap-2">
                <input required name="site" placeholder="Site Name" className="flex-grow p-2 border rounded text-sm" />
                <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white px-4 rounded transition-colors font-bold shadow-sm">Add</button>
              </form>
              <div className="mt-4 space-y-1">
                {sites.map((s, i) => (
                  <div key={i} className="flex justify-between items-center p-2 bg-slate-50 rounded border group">
                    <span className="text-sm font-medium">{s}</span>
                    <button onClick={() => handleDeleteSite(s)} className="text-red-300 hover:text-red-600 transition-colors"><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && role === 'admin' && (
          <div className="bg-white p-6 rounded-xl border shadow-sm max-w-md mx-auto">
            <h2 className="font-bold mb-6 flex items-center gap-2"><Settings size={20} className="text-blue-600" /> App Settings</h2>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-xs text-blue-800 font-bold uppercase tracking-wider mb-1">Sync Info</p>
                <p className="text-sm text-blue-700 flex items-center gap-2 font-bold"><Cloud size={14} /> Database: {syncStatus}</p>
              </div>
              <div className="flex flex-col gap-2">
                 <button onClick={exportMasterAttendanceCSV} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 p-3 rounded font-bold transition-colors flex items-center justify-center gap-2 border"><Download size={16} /> Backup Attendance</button>
                 <button onClick={exportMasterExpensesCSV} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 p-3 rounded font-bold transition-colors flex items-center justify-center gap-2 border"><Download size={16} /> Backup Expenses</button>
              </div>
              <button onClick={() => setConfirmClear(true)} className="w-full bg-red-600 hover:bg-red-700 text-white p-3 rounded font-bold transition-colors">Clear Data</button>
              {confirmClear && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded animate-pulse">
                  <p className="text-red-700 font-bold mb-2 text-sm">CRITICAL: This will permanently delete all worker logs. Continue?</p>
                  <div className="flex gap-2">
                    <button onClick={handleClearData} className="flex-1 bg-red-600 text-white p-2 rounded font-bold text-xs uppercase">Yes, Delete</button>
                    <button onClick={() => setConfirmClear(false)} className="flex-1 bg-slate-200 p-2 rounded font-bold text-xs uppercase">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
