import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, Building, Calendar, ClipboardList, Wallet, 
  Plus, FileSpreadsheet, Receipt, Trash2, Download, 
  Cloud, RotateCcw, Settings, AlertTriangle, Lock, Eye, LogOut, Wrench 
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// =========================================================
// FIREBASE CONFIGURATION (Fill in when ready)
// =========================================================
const firebaseConfig = {
  apiKey: "PASTE_API_KEY_HERE",
  authDomain: "PASTE_AUTH_DOMAIN_HERE",
  projectId: "PASTE_PROJECT_ID_HERE",
  storageBucket: "PASTE_STORAGE_BUCKET_HERE",
  messagingSenderId: "PASTE_MESSAGING_SENDER_ID_HERE",
  appId: "PASTE_APP_ID_HERE",
  measurementId: "PASTE_MEASUREMENT_ID_HERE"
};
// =========================================================

let auth, db;
const isConfigValid = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("PASTE_");

if (isConfigValid) {
  try {
    initializeApp(firebaseConfig); // app instance not needed separately
    auth = getAuth();
    db = getFirestore();
  } catch (e) {
    console.error("Firebase Initialization Error:", e);
  }
}

const appId = "contractor_tracker_v1";

export default function App() {
  const [role, setRole] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const ADMIN_PIN = 'Suresh@12057283';

  const [activeTab, setActiveTab] = useState('daily');
  const [workers, setWorkers] = useState([]);
  const [sites, setSites] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [siteExpenses, setSiteExpenses] = useState([]);
  const [weeklyOverrides, setWeeklyOverrides] = useState({});
  const [inventory, setInventory] = useState([]);
  
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [reportSite, setReportSite] = useState('');
  const [reportPeriodType, setReportPeriodType] = useState('monthly');
  const [reportWeekDate, setReportWeekDate] = useState(new Date().toISOString().split('T')[0]);
  const [confirmClear, setConfirmClear] = useState(false);
  
  const [user, setUser] = useState(null);
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [syncStatus, setSyncStatus] = useState(isConfigValid ? 'Connecting...' : 'Offline Mode');

  // --- Firebase Auth (anonymous) ---
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth error", err);
        setSyncStatus('Auth Error');
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- Data Fetching from Firestore ---
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

  // --- Auto-Save to Firestore ---
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

  // --- Helper functions ---
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

  const escapeCSV = (str) => {
    if (str == null) return '';
    const stringValue = String(str);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const generateCSV = (data, filename) => {
    const csv = data.map(row => 
      Object.values(row).map(val => escapeCSV(val)).join(',')
    ).join('\n');
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Event handlers ---
  const handleLogin = (e, selectedRole) => {
    if (e) e.preventDefault();
    if (selectedRole === 'viewer') {
      setRole('viewer');
    } else if (selectedRole === 'admin') {
      if (pinInput === ADMIN_PIN) {
        setRole('admin');
        setPinInput('');
        setPinError('');
      } else {
        setPinError('Incorrect password');
        setPinInput('');
      }
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
    if (name && !isNaN(wage) && wage > 0) {
      setWorkers([...workers, { id: Date.now(), name, dailyWage: wage, loanBalance: 0 }]);
      e.target.reset();
    }
  };

  const handleAddSite = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const site = formData.get('site');
    if (site && site.trim()) {
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
    if (site && desc && !isNaN(amount) && amount > 0) {
      setSiteExpenses([...siteExpenses, { id: Date.now(), date: currentDate, site, description: desc, amount }]);
      e.target.reset();
    }
  };

  const handleDeleteWorker = (id) => {
    if (role !== 'admin') return;
    setWorkers(workers.filter((w) => w.id !== id));
  };

  const handleDeleteSite = (siteToDelete) => {
    if (role !== 'admin') return;
    setSites(sites.filter((s) => s !== siteToDelete));
  };

  const handleDeleteExpense = (id) => {
    if (role !== 'admin') return;
    setSiteExpenses(siteExpenses.filter((e) => e.id !== id));
  };

  const handleAddTool = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const toolName = formData.get('toolName');
    if (toolName && toolName.trim()) {
      setInventory([...inventory, { id: Date.now(), name: toolName, status: 'Available', assignedWorker: '', assignedSite: '', checkoutDate: '' }]);
      e.target.reset();
    }
  };

  const handleAssignTool = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const toolId = parseInt(formData.get('toolId'), 10);
    const workerId = formData.get('workerId');
    const site = formData.get('site');
    if (toolId && workerId && site) {
      const worker = workers.find((w) => w.id.toString() === workerId);
      if (worker) {
        setInventory(inventory.map((tool) => 
          tool.id === toolId 
          ? { ...tool, status: 'Assigned', assignedWorker: worker.name, assignedSite: site, checkoutDate: currentDate } 
          : tool
        ));
        e.target.reset();
      }
    }
  };

  const handleReturnTool = (toolId) => {
    if (role !== 'admin') return;
    setInventory(inventory.map((tool) => 
      tool.id === toolId 
      ? { ...tool, status: 'Available', assignedWorker: '', assignedSite: '', checkoutDate: '' } 
      : tool
    ));
  };

  const handleClearData = () => {
    setAttendance({});
    setSiteExpenses([]);
    setWeeklyOverrides({});
    setConfirmClear(false);
  };

  // --- Computed data for weekly settlement ---
  const currentWeekStart = getStartOfWeek(currentDate);
  const reportWeekStart = getStartOfWeek(reportWeekDate);
  const reportWeekDates = useMemo(() => getDatesOfWeek(reportWeekStart), [reportWeekStart]);

  const weeklyData = useMemo(() => {
    const weekDates = getDatesOfWeek(currentWeekStart);
    const weekOverrides = weeklyOverrides[currentWeekStart] || {};
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
      const calcFinalPayout = Math.max(0, totalEarned - totalAdvances);
      const override = weekOverrides[worker.id];
      return {
        ...worker,
        daysWorked,
        totalEarned,
        totalAdvances,
        finalPayout: override && override.finalPayout !== undefined ? override.finalPayout : calcFinalPayout
      };
    });
  }, [workers, attendance, currentWeekStart, weeklyOverrides]);

  const reportInfo = useMemo(() => {
    if (!reportSite) return { data: [], totalLabor: 0, totalMaterials: 0 };
    let reportData = [];
    let totalLabor = 0;
    let totalMaterials = 0;
    Object.entries(attendance).forEach(([dateStr, dayData]) => {
      const isDateInRange = reportPeriodType === 'monthly' ? dateStr.startsWith(reportMonth) : reportWeekDates.includes(dateStr);
      if (isDateInRange) {
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
      const isDateInRange = reportPeriodType === 'monthly' ? exp.date.startsWith(reportMonth) : reportWeekDates.includes(exp.date);
      if (isDateInRange && exp.site === reportSite) {
        reportData.push({ date: exp.date, type: 'Material', desc: exp.description, amount: exp.amount });
        totalMaterials += exp.amount;
      }
    });
    return { data: reportData, totalLabor, totalMaterials };
  }, [attendance, siteExpenses, reportSite, reportMonth, reportPeriodType, reportWeekDates, workers]);

  const totalExpensesThisMonth = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return siteExpenses.filter(exp => exp.date.startsWith(currentMonth)).reduce((sum, exp) => sum + exp.amount, 0);
  }, [siteExpenses]);

  // --- Export functions ---
  const exportWeeklyCSV = () => {
    const headers = ['Worker', 'Days Worked', 'Total Earned', 'Total Advances Taken', 'Final Cash to Pay'];
    const rows = weeklyData.map(d => [d.name, d.daysWorked, d.totalEarned, d.totalAdvances, d.finalPayout]);
    const csvContent = [headers, ...rows].map(row => row.map(cell => escapeCSV(cell)).join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Weekly_Settlement_${currentWeekStart}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportMasterAttendanceCSV = () => {
    const headers = ['Date', 'Worker Name', 'Assigned Site', 'Present', 'Advance Given (₹)'];
    const rows = [];
    Object.entries(attendance).forEach(([dateStr, dayData]) => {
      Object.entries(dayData).forEach(([workerId, record]) => {
        const worker = workers.find((w) => w.id.toString() === workerId);
        if (worker) rows.push([dateStr, worker.name, record.site || 'None', record.present ? 'Yes' : 'No', record.advance || 0]);
      });
    });
    const csvContent = [headers, ...rows].map(row => row.map(cell => escapeCSV(cell)).join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_Backup.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportMasterExpensesCSV = () => {
    const headers = ['Date', 'Site', 'Description', 'Amount (₹)'];
    const rows = siteExpenses.map((exp) => [exp.date, exp.site, exp.description, exp.amount]);
    const csvContent = [headers, ...rows].map(row => row.map(cell => escapeCSV(cell)).join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Expense_Backup.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Login screen ---
  if (!role) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-900">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
          <div className="bg-slate-900 p-8 text-center text-white">
            <Building className="text-yellow-400 mx-auto mb-3" size={48} />
            <h1 className="text-2xl font-bold">Contractor Pro</h1>
            <p className="text-slate-400 text-sm">Offline Template Mode</p>
          </div>
          <div className="p-8 space-y-8">
            <div className="space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2"><Lock className="text-blue-600" size={20} /> Admin Access</h2>
              <form onSubmit={(e) => handleLogin(e, 'admin')} className="space-y-3">
                <input type="password" placeholder="Enter Password" value={pinInput} onChange={(e) => setPinInput(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-center tracking-wider text-xl font-medium" />
                {pinError && <p className="text-red-500 text-sm text-center font-medium">{pinError}</p>}
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors shadow-sm">Login</button>
              </form>
            </div>
            <div className="relative flex items-center"><div className="flex-grow border-t border-slate-200"></div><span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-bold uppercase tracking-widest">OR</span><div className="flex-grow border-t border-slate-200"></div></div>
            <div className="space-y-4 text-center">
               <h2 className="text-lg font-bold flex items-center justify-center gap-2"><Eye className="text-indigo-600" size={20} /> Worker Access</h2>
               <button onClick={() => handleLogin(null, 'viewer')} className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 font-bold py-3 rounded-lg transition-colors">View Mode</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Main app UI ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-2">
              <Building className="text-yellow-400" />
              <h1 className="text-xl font-bold">Contractor Pro</h1>
              <span className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${role === 'admin' ? 'bg-blue-600' : 'bg-slate-700'}`}>
                {role === 'admin' ? 'ADMIN' : 'VIEWER'}
              </span>
            </div>
            <div className="text-[10px] font-bold flex items-center gap-1 bg-slate-800 px-2 py-1 rounded text-slate-400 uppercase">
               {syncStatus}
            </div>
          </div>
          <div className="flex bg-slate-800 rounded-lg p-1 overflow-x-auto w-full md:w-auto">
            <button onClick={() => setActiveTab('daily')} className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'daily' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}><Calendar size={16} /> Daily Log</button>
            <button onClick={() => setActiveTab('weekly')} className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'weekly' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}><Wallet size={16} /> Settlement</button>
            {role === 'admin' && (
              <>
                <button onClick={() => setActiveTab('reports')} className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'reports' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}><FileSpreadsheet size={16} /> Reports</button>
                <button onClick={() => setActiveTab('tools')} className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'tools' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}><Wrench size={16} /> Tools</button>
                <button onClick={() => setActiveTab('manage')} className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'manage' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}><Users size={16} /> Manage</button>
                <button onClick={() => setActiveTab('settings')} className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}><Settings size={16} /> Settings</button>
              </>
            )}
            <button onClick={() => setRole(null)} className="ml-2 text-slate-500 hover:text-red-400 p-1.5"><LogOut size={18} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {activeTab === 'daily' && (
          <div className="space-y-6">
            {/* Wallet & Calendar widget */}
            <div className="bg-white rounded-xl shadow-sm border p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Wallet className="text-green-600" size={24} />
                <div>
                  <p className="text-xs text-slate-500">Total Expenses This Month</p>
                  <p className="text-2xl font-bold text-green-600">₹{totalExpensesThisMonth}</p>
                </div>
              </div>
              <Calendar className="text-slate-400" size={20} />
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><ClipboardList className="text-blue-600" /> Attendance Log</h2>
                <input type="date" value={currentDate} onChange={(e) => setCurrentDate(e.target.value)} className="p-2 border border-slate-300 rounded-lg text-sm font-medium bg-white" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead><tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider font-bold"><th className="p-4 border-b">Worker</th><th className="p-4 border-b text-center">Present?</th><th className="p-4 border-b">Site</th><th className="p-4 border-b">Advance Given</th></tr></thead>
                  <tbody>
                    {workers.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-slate-400">Add workers in Manage tab.</td></tr> : workers.map((worker) => {
                      const todayData = attendance[currentDate]?.[worker.id] || { present: false, site: '', advance: '' };
                      return (
                        <tr key={worker.id} className="border-b hover:bg-slate-50 transition-colors">
                          <td className="p-4 font-medium">{worker.name} {role === 'admin' && <span className="text-[10px] text-slate-400 block font-bold uppercase">₹{worker.dailyWage} / day</span>}</td>
                          <td className="p-4 text-center"><input type="checkbox" checked={todayData.present} onChange={(e) => handleAttendanceChange(worker.id, 'present', e.target.checked)} disabled={role !== 'admin'} className="w-5 h-5 text-blue-600 rounded" /></td>
                          <td className="p-4">
                            <select value={todayData.site} onChange={(e) => handleAttendanceChange(worker.id, 'site', e.target.value)} disabled={role !== 'admin' || !todayData.present} className="w-full p-2 border border-slate-300 rounded bg-white text-sm">
                              <option value="">Select Site...</option>
                              {sites.map((s, i) => <option key={i} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="p-4">
                            <div className="relative"><span className="absolute left-2 top-2 text-slate-400 text-sm">₹</span>
                              <input type="number" value={todayData.advance || ''} onChange={(e) => handleAttendanceChange(worker.id, 'advance', e.target.value)} disabled={role !== 'admin'} className="w-full p-2 pl-6 border border-slate-300 rounded text-sm" placeholder="0" />
                            </div>
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
                    <select required name="site" className="flex-1 min-w-[150px] p-2 border border-slate-300 rounded text-sm bg-white"><option value="">Select Site...</option>{sites.map((s, i) => <option key={i} value={s}>{s}</option>)}</select>
                    <input required name="desc" type="text" className="flex-[2] min-w-[200px] p-2 border border-slate-300 rounded text-sm" placeholder="Expense description..." />
                    <input required name="amount" type="number" className="flex-1 min-w-[100px] p-2 border border-slate-300 rounded text-sm" placeholder="Amount" />
                    <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded text-sm transition-colors shadow-sm">Add</button>
                  </form>
                  {siteExpenses.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-200">
                      <h4 className="text-sm font-bold mb-3">Recent Expenses</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {siteExpenses.slice(-10).reverse().map((exp) => (
                          <div key={exp.id} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded text-sm group">
                            <span>{exp.date} - {exp.site}: {exp.description} - ₹{exp.amount}</span>
                            <button onClick={() => handleDeleteExpense(exp.id)} className="text-red-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'weekly' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Wallet className="text-green-500" /> Weekly Settlement</h2>
                <p className="text-slate-500 text-sm mt-1">Week of {currentWeekStart}</p>
              </div>
              {role === 'admin' && (
                <button onClick={exportWeeklyCSV} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 shadow-sm">
                  <Download size={14} /> Export CSV
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead><tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider font-bold"><th className="p-4 border-b">Worker</th><th className="p-4 border-b text-center">Days</th><th className="p-4 border-b text-right">Earned</th><th className="p-4 border-b text-right">Advances</th><th className="p-4 border-b text-right">Payout</th></tr></thead>
                <tbody>
                  {weeklyData.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-400">No workers available</td></tr> : weeklyData.map((worker) => (
                    <tr key={worker.id} className="border-b hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium">{worker.name}</td>
                      <td className="p-4 text-center font-bold">{worker.daysWorked}</td>
                      <td className="p-4 text-right">₹{worker.totalEarned}</td>
                      <td className="p-4 text-right">₹{worker.totalAdvances}</td>
                      <td className="p-4 text-right font-bold text-green-600">₹{worker.finalPayout}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reports' && role === 'admin' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
            <h2 className="text-lg font-bold flex items-center gap-2"><FileSpreadsheet className="text-blue-600" /> Site Reports</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select value={reportSite} onChange={(e) => setReportSite(e.target.value)} className="p-2 border border-slate-300 rounded text-sm bg-white">
                <option value="">Select Site...</option>
                {sites.map((s, i) => <option key={i} value={s}>{s}</option>)}
              </select>
              <select value={reportPeriodType} onChange={(e) => setReportPeriodType(e.target.value)} className="p-2 border border-slate-300 rounded text-sm bg-white">
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
              </select>
              {reportPeriodType === 'monthly' && <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="p-2 border border-slate-300 rounded text-sm bg-white" />}
              {reportPeriodType === 'weekly' && <input type="date" value={reportWeekDate} onChange={(e) => setReportWeekDate(e.target.value)} className="p-2 border border-slate-300 rounded text-sm bg-white" />}
            </div>
            {reportSite && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead><tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider font-bold"><th className="p-4 border-b">Date</th><th className="p-4 border-b">Type</th><th className="p-4 border-b">Description</th><th className="p-4 border-b text-right">Amount</th></tr></thead>
                    <tbody>
                      {reportInfo.data.map((item, i) => (
                        <tr key={i} className="border-b hover:bg-slate-50">
                          <td className="p-4 text-sm">{item.date}</td>
                          <td className="p-4 text-sm"><span className={`px-2 py-1 rounded text-xs font-bold ${item.type === 'Labor' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{item.type}</span></td>
                          <td className="p-4 text-sm">{item.desc}</td>
                          <td className="p-4 text-sm text-right font-bold">₹{item.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 bg-slate-100 rounded-lg grid grid-cols-3 gap-4 text-sm font-bold">
                  <div>Labor: ₹{reportInfo.totalLabor}</div>
                  <div>Materials: ₹{reportInfo.totalMaterials}</div>
                  <div className="text-right">Total: ₹{reportInfo.totalLabor + reportInfo.totalMaterials}</div>
                </div>
                <button onClick={() => generateCSV(reportInfo.data, `report-${reportSite}-${new Date().toISOString().split('T')[0]}.csv`)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-sm flex items-center gap-2">
                  <Download size={16} /> Export CSV
                </button>
              </>
            )}
          </div>
        )}

        {activeTab === 'tools' && role === 'admin' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
            <h2 className="text-lg font-bold flex items-center gap-2"><Wrench className="text-blue-600" /> Tool Inventory</h2>
            <form onSubmit={handleAddTool} className="flex gap-2">
              <input required name="toolName" type="text" className="flex-grow p-2 border border-slate-300 rounded text-sm" placeholder="Tool name..." />
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-sm transition-colors">Add Tool</button>
            </form>
            <div className="space-y-4">
              {inventory.length === 0 ? (
                <p className="text-center text-slate-400 py-8">No tools added yet</p>
              ) : (
                inventory.map((tool) => (
                  <div key={tool.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-slate-800">{tool.name}</p>
                        <p className={`text-xs font-bold uppercase ${tool.status === 'Available' ? 'text-green-600' : 'text-orange-600'}`}>{tool.status}</p>
                      </div>
                      {tool.status === 'Assigned' && <button onClick={() => handleReturnTool(tool.id)} className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-1 px-3 rounded text-xs">Return</button>}
                    </div>
                    {tool.status === 'Assigned' && (
                      <p className="text-sm text-slate-600">Assigned to {tool.assignedWorker} at {tool.assignedSite}</p>
                    )}
                    {tool.status === 'Available' && (
                      <form onSubmit={handleAssignTool} className="flex gap-2 flex-wrap">
                        <select required name="workerId" className="flex-1 min-w-[150px] p-2 border border-slate-300 rounded text-sm bg-white">
                          <option value="">Select Worker...</option>
                          {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                        <select required name="site" className="flex-1 min-w-[150px] p-2 border border-slate-300 rounded text-sm bg-white">
                          <option value="">Select Site...</option>
                          {sites.map((s, i) => <option key={i} value={s}>{s}</option>)}
                        </select>
                        <input type="hidden" name="toolId" value={tool.id} />
                        <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded text-sm">Assign</button>
                      </form>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'manage' && role === 'admin' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
              <h2 className="text-lg font-bold flex items-center gap-2"><Users className="text-blue-600" /> Manage Workers</h2>
              <form onSubmit={handleAddWorker} className="space-y-4">
                <input required name="name" type="text" className="w-full p-2 border border-slate-300 rounded text-sm" placeholder="Full Name" />
                <input required name="wage" type="number" className="w-full p-2 border border-slate-300 rounded text-sm" placeholder="Daily Wage (₹)" />
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"><Plus size={16} /> Add Worker</button>
              </form>
              <div className="space-y-2 pt-4 border-t">
                {workers.map((w) => (
                  <div key={w.id} className="p-2 bg-slate-50 border border-slate-200 rounded flex justify-between items-center group">
                    <span className="text-sm font-bold">{w.name} (₹{w.dailyWage})</span>
                    <button onClick={() => handleDeleteWorker(w.id)} className="text-red-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Building className="text-blue-600" /> Manage Sites</h2>
              <form onSubmit={handleAddSite} className="flex gap-2"><input required name="site" type="text" className="flex-grow p-2 border border-slate-300 rounded text-sm" placeholder="Site Name" /><button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded text-sm transition-colors shadow-sm">Add</button></form>
              <div className="space-y-2 pt-4 border-t">
                {sites.map((s, i) => (
                  <div key={i} className="p-2 bg-slate-50 border border-slate-200 rounded flex justify-between items-center group">
                    <span className="text-sm font-bold">{s}</span>
                    <button onClick={() => handleDeleteSite(s)} className="text-red-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && role === 'admin' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
            <h2 className="text-lg font-bold flex items-center gap-2"><Settings className="text-blue-600" /> Settings</h2>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-slate-700"><strong>Cloud Status:</strong> {syncStatus}</p>
                <p className="text-xs text-slate-600 mt-2">Data is automatically saved to Firebase when connected. Configure your Firebase credentials in the code to enable cloud sync.</p>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={exportMasterAttendanceCSV} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 p-3 rounded font-bold transition-colors flex items-center justify-center gap-2 border">
                  <Download size={16} /> Backup Attendance
                </button>
                <button onClick={exportMasterExpensesCSV} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 p-3 rounded font-bold transition-colors flex items-center justify-center gap-2 border">
                  <Download size={16} /> Backup Expenses
                </button>
              </div>
              <button onClick={() => setConfirmClear(true)} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded text-sm transition-colors flex items-center justify-center gap-2">
                <RotateCcw size={16} /> Clear All Data
              </button>
              {confirmClear && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-bold text-red-700 mb-3">This will permanently delete all attendance and expense data. Are you sure?</p>
                  <div className="flex gap-2">
                    <button onClick={handleClearData} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded text-sm">Yes, Clear All</button>
                    <button onClick={() => setConfirmClear(false)} className="flex-1 bg-slate-300 hover:bg-slate-400 text-slate-800 font-bold py-2 rounded text-sm">Cancel</button>
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
