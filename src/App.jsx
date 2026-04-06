import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, Building, Calendar, ClipboardList, Wallet, 
  Plus, FileSpreadsheet, Receipt, Trash2, Download, 
  Cloud, Settings, Lock, Eye, LogOut, Wrench, AlertTriangle, 
  RotateCcw, Edit2, X, Database, Save
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
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
// FIREBASE CONFIGURATION (Fill in the blanks when ready)
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
  
  // UI States
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7)); 
  const [reportSite, setReportSite] = useState('');
  const [reportPeriodType, setReportPeriodType] = useState('monthly'); 
  const [reportWeekDate, setReportWeekDate] = useState(new Date().toISOString().split('T')[0]);
  const [isEditingSettlement, setIsEditingSettlement] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [exportYear, setExportYear] = useState('All');
  
  // Expense Editing State
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [editExpenseData, setEditExpenseData] = useState({ site: '', desc: '', amount: '' });

  // Calendar State
  const [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().slice(0, 7));
  const [calendarSite, setCalendarSite] = useState('');

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
          console.error("Auth check error:", e);
          setRole('viewer');
        }
      }
    });
    return () => unsubscribe();
  }, []);

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
      setLoginError('Incorrect credentials or account not found.');
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
      const workerData = dayData[workerId] || { present: false, site: '', advance: 0, advanceMethod: 'Cash' };
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
    if (site && !sites.includes(site)) {
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

  const handleDeleteExpense = (id) => {
    if (role === 'admin') setSiteExpenses(siteExpenses.filter((e) => e.id !== id));
  };

  const startEditingExpense = (expense) => {
    setEditingExpenseId(expense.id);
    setEditExpenseData({ site: expense.site, desc: expense.description, amount: expense.amount });
  };

  const saveEditedExpense = () => {
    if (!editExpenseData.site || !editExpenseData.desc || isNaN(editExpenseData.amount)) return;
    setSiteExpenses(siteExpenses.map(exp => 
      exp.id === editingExpenseId 
      ? { ...exp, site: editExpenseData.site, description: editExpenseData.desc, amount: parseInt(editExpenseData.amount, 10) }
      : exp
    ));
    setEditingExpenseId(null);
  };

  const cancelEditingExpense = () => {
    setEditingExpenseId(null);
  };

  const handleDeleteWorker = (id) => { if (role === 'admin') setWorkers(workers.filter((w) => w.id !== id)); };
  const handleDeleteSite = (site) => { if (role === 'admin') setSites(sites.filter((s) => s !== site)); };

  const handleAddTool = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const name = formData.get('name');
    if (name) {
      setInventory([...inventory, { id: Date.now(), name, status: 'Available', assignedWorker: '', assignedSite: '', checkoutDate: '' }]);
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
      setInventory(inventory.map((tool) => 
        tool.id === toolId 
        ? { ...tool, status: 'Assigned', assignedWorker: worker?.name || 'Unknown', assignedSite: site, checkoutDate: currentDate } 
        : tool
      ));
      e.target.reset();
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

  const handleDeleteTool = (toolId) => {
    if (role !== 'admin') return;
    setInventory(inventory.filter((t) => t.id !== toolId));
  };

  const handleClearData = () => {
    setAttendance({});
    setSiteExpenses([]);
    setWeeklyOverrides({});
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

  // --- Calculations ---
  const weeklyData = useMemo(() => {
    const weekDates = getDatesOfWeek(currentWeekStart);
    const weekOverrides = weeklyOverrides[currentWeekStart] || {};
    
    return workers.map((worker) => {
      let daysWorked = 0;
      let totalAdvancesThisWeek = 0;
      let gpayAdvances = 0;
      let cashAdvances = 0;
      
      weekDates.forEach(date => {
        const dayRecord = attendance[date]?.[worker.id];
        if (dayRecord?.present) daysWorked += 1;
        if (dayRecord?.advance) {
          const advAmt = parseInt(dayRecord.advance || 0, 10);
          totalAdvancesThisWeek += advAmt;
          
          if (dayRecord.advanceMethod === 'GPay') {
            gpayAdvances += advAmt;
          } else {
            cashAdvances += advAmt;
          }
        }
      });
      
      const totalEarned = daysWorked * worker.dailyWage;
      const totalAdvances = totalAdvancesThisWeek + (worker.loanBalance || 0);
      
      // Calculate normal payout (not less than zero)
      const calcFinalPayout = Math.max(0, totalEarned - totalAdvances);
      
      // Calculate excess debt if advances are greater than earnings
      const calcCarryOver = Math.max(0, totalAdvances - totalEarned);
      
      const override = weekOverrides[worker.id];
      return {
        ...worker,
        daysWorked,
        totalEarned,
        totalAdvances,
        gpayAdvances,
        cashAdvances,
        carryOver: calcCarryOver,
        finalPayout: override && override.finalPayout !== undefined ? override.finalPayout : calcFinalPayout,
        isOverridden: !!override
      };
    });
  }, [workers, attendance, currentWeekStart, weeklyOverrides]);

  // Calculate totals for the entire week across all workers
  const weeklyTotals = useMemo(() => {
    return weeklyData.reduce((acc, curr) => ({
      earned: acc.earned + curr.totalEarned,
      advances: acc.advances + curr.totalAdvances,
      payout: acc.payout + curr.finalPayout,
      carryOver: acc.carryOver + curr.carryOver
    }), { earned: 0, advances: 0, payout: 0, carryOver: 0 });
  }, [weeklyData]);

  const handleOverrideChange = (workerId, field, value) => {
    setWeeklyOverrides((prev) => {
      const weekData = prev[currentWeekStart] || {};
      const workerOverride = weekData[workerId] || {
        finalPayout: weeklyData.find((w) => w.id === workerId)?.calcFinalPayout || 0
      };
      return {
        ...prev,
        [currentWeekStart]: { ...weekData, [workerId]: { ...workerOverride, [field]: value === '' ? '' : parseInt(value, 10) || 0 } }
      };
    });
  };

  const handleClearOverride = (workerId) => {
    setWeeklyOverrides((prev) => {
      if (!prev[currentWeekStart]) return prev;
      const weekData = { ...prev[currentWeekStart] };
      delete weekData[workerId];
      return { ...prev, [currentWeekStart]: weekData };
    });
  };

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
    reportData.sort((a, b) => a.date.localeCompare(b.date));
    return { data: reportData, totalLabor, totalMaterials };
  }, [attendance, siteExpenses, reportSite, reportMonth, reportPeriodType, reportWeekDates, workers]);

  const availableYears = useMemo(() => {
    const years = new Set();
    Object.keys(attendance).forEach(date => date && years.add(date.substring(0, 4)));
    siteExpenses.forEach((exp) => exp.date && years.add(exp.date.substring(0, 4)));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [attendance, siteExpenses]);

  const todaysExpenses = useMemo(() => {
    return siteExpenses.filter((exp) => exp.date === currentDate);
  }, [siteExpenses, currentDate]);

  const calendarData = useMemo(() => {
    if (!calendarSite) return { days: [], blankStartDays: 0 };
    const [year, month] = calendarMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayOfMonth = new Date(year, month - 1, 1).getDay(); // 0 (Sun) to 6 (Sat)

    const days = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      
      let workerCount = 0;
      if (attendance[dateStr]) {
        Object.entries(attendance[dateStr]).forEach(([workerId, record]) => {
          // Double-check that the worker hasn't been deleted
          const workerExists = workers.some(w => w.id.toString() === workerId.toString());
          if (workerExists && record.present && record.site === calendarSite) {
            workerCount++;
          }
        });
      }

      let expenseTotal = 0;
      siteExpenses.forEach(exp => {
        if (exp.date === dateStr && exp.site === calendarSite) {
          expenseTotal += exp.amount;
        }
      });

      days.push({
        dayNum: i,
        dateStr,
        workerCount,
        expenseTotal,
        isActive: workerCount > 0 || expenseTotal > 0
      });
    }
    return { days, blankStartDays: firstDayOfMonth };
  }, [calendarMonth, calendarSite, attendance, siteExpenses, workers]);

  // --- Exports ---
  const utf8BOM = "\uFEFF"; 
  
  const escapeCSV = (str) => {
    if (str == null) return '';
    const stringValue = String(str);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const exportWeeklyCSV = () => {
    const headers = ['Worker', 'Days Worked', 'Total Earned', 'Total Advances Taken', 'Final Cash to Pay', 'Excess Debt (Carry Over)'];
    const rows = weeklyData.map(d => [escapeCSV(d.name), d.daysWorked, d.totalEarned, d.totalAdvances, d.finalPayout, d.carryOver]);
    
    // Add Totals Row to Export
    rows.push(['GRAND TOTALS', '', weeklyTotals.earned, weeklyTotals.advances, weeklyTotals.payout, weeklyTotals.carryOver]);

    const csvContent = "data:text/csv;charset=utf-8," + utf8BOM + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Weekly_Settlement_${currentWeekStart}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportSiteReportCSV = () => {
    const headers = ['Date', 'Type', 'Description', 'Amount (₹)'];
    const rows = reportInfo.data.map(d => [d.date, escapeCSV(d.type), escapeCSV(d.desc), d.amount]);
    rows.push(['', '', 'Total Labor:', reportInfo.totalLabor]);
    rows.push(['', '', 'Total Materials:', reportInfo.totalMaterials]);
    rows.push(['', '', 'Grand Total:', reportInfo.totalLabor + reportInfo.totalMaterials]);
    const csvContent = "data:text/csv;charset=utf-8," + utf8BOM + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const periodStr = reportPeriodType === 'monthly' ? reportMonth : `Week_${reportWeekStart}`;
    link.setAttribute("download", `Site_Report_${reportSite}_${periodStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportInventoryCSV = () => {
    const headers = ['Tool Name', 'Status', 'Assigned Worker', 'Assigned Site', 'Checkout Date'];
    const rows = inventory.map((t) => [escapeCSV(t.name), escapeCSV(t.status), escapeCSV(t.assignedWorker || 'None'), escapeCSV(t.assignedSite || 'None'), t.checkoutDate || 'N/A']);
    const csvContent = "data:text/csv;charset=utf-8," + utf8BOM + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Inventory_Status.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportMasterAttendanceCSV = () => {
    const headers = ['Date', 'Worker Name', 'Assigned Site', 'Present', 'Advance Given (₹)', 'Advance Method'];
    const rows = [];
    Object.entries(attendance).forEach(([dateStr, dayData]) => {
      if (exportYear !== 'All' && !dateStr.startsWith(exportYear)) return;
      Object.entries(dayData).forEach(([workerId, record]) => {
        const worker = workers.find((w) => w.id.toString() === workerId);
        if (worker) rows.push([dateStr, escapeCSV(worker.name), escapeCSV(record.site || 'None'), record.present ? 'Yes' : 'No', record.advance || 0, escapeCSV(record.advanceMethod || 'Cash')]);
      });
    });
    rows.sort((a, b) => b[0].localeCompare(a[0]));
    const csvContent = "data:text/csv;charset=utf-8," + utf8BOM + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Attendance_Backup_${exportYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportMasterExpensesCSV = () => {
    const headers = ['Date', 'Site', 'Description', 'Amount (₹)'];
    const filteredExpenses = exportYear === 'All' ? siteExpenses : siteExpenses.filter((exp) => exp.date.startsWith(exportYear));
    const rows = filteredExpenses.map((exp) => [exp.date, escapeCSV(exp.site), escapeCSV(exp.description), exp.amount]);
    rows.sort((a, b) => b[0].localeCompare(a[0]));
    const csvContent = "data:text/csv;charset=utf-8," + utf8BOM + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Expense_Backup_${exportYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Component Renders ---
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
                <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2"><Lock size={16} /> Login</button>
                <button type="button" onClick={() => setShowAdminSetup(true)} className="w-full text-blue-600 text-sm mt-2">Create Admin</button>
              </form>
              <div className="border-t pt-4">
                <button onClick={handleViewerLogin} className="w-full bg-slate-50 border py-3 rounded-lg font-bold text-slate-600 flex items-center justify-center gap-2"><Eye size={16} /> View Data (No Password)</button>
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
            <span className="bg-blue-600 px-2 py-0.5 rounded text-[10px] uppercase font-bold">{role}</span>
            <span className="text-[10px] text-slate-400 ml-2 uppercase font-bold tracking-wider flex items-center gap-1"><Cloud size={10} /> {syncStatus}</span>
          </div>
          <nav className="flex bg-slate-800 rounded-lg p-1 overflow-x-auto w-full md:w-auto">
            <button onClick={() => setActiveTab('daily')} className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 ${activeTab === 'daily' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}><ClipboardList size={14}/> Daily Log</button>
            <button onClick={() => setActiveTab('calendar')} className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 ${activeTab === 'calendar' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}><Calendar size={14}/> Site Calendar</button>
            <button onClick={() => setActiveTab('weekly')} className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 ${activeTab === 'weekly' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}><Wallet size={14}/> Settlement</button>
            {role === 'admin' && (
              <>
                <button onClick={() => setActiveTab('reports')} className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 ${activeTab === 'reports' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}><FileSpreadsheet size={14}/> Reports</button>
                <button onClick={() => setActiveTab('tools')} className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 ${activeTab === 'tools' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}><Wrench size={14}/> Tools</button>
                <button onClick={() => setActiveTab('manage')} className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 ${activeTab === 'manage' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}><Users size={14}/> Manage</button>
                <button onClick={() => setActiveTab('settings')} className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 ${activeTab === 'settings' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}><Settings size={14}/> Settings</button>
              </>
            )}
            <button onClick={() => setRole(null)} className="p-1.5 text-slate-500 hover:text-red-400 ml-2"><LogOut size={18} /></button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        
        {/* DAILY TAB */}
        {activeTab === 'daily' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold flex items-center gap-2"><ClipboardList className="text-blue-600" /> Attendance Log</h2>
              <input type="date" value={currentDate} onChange={(e) => setCurrentDate(e.target.value)} className="p-2 border rounded-lg text-sm bg-white" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-100 font-bold text-xs uppercase tracking-wider text-slate-500">
                  <tr><th className="p-4">Worker</th><th className="p-4 text-center">Present</th><th className="p-4">Site</th><th className="p-4">Advance & Method</th></tr>
                </thead>
                <tbody>
                  {workers.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-400">Add workers in the Manage tab to begin.</td></tr>
                  ) : workers.map((worker) => {
                    const data = attendance[currentDate]?.[worker.id] || { present: false, site: '', advance: '', advanceMethod: 'Cash' };
                    return (
                      <tr key={worker.id} className="border-b hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-medium">{worker.name} {role === 'admin' && <span className="text-[10px] text-slate-400 block font-bold">₹{worker.dailyWage}/DAY</span>}</td>
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
                          <div className="flex items-center gap-1">
                            <div className="relative flex-1">
                              <span className="absolute left-2 top-2 text-slate-400 text-sm">₹</span>
                              <input type="number" value={data.advance || ''} onChange={(e) => handleAttendanceChange(worker.id, 'advance', e.target.value)} disabled={role !== 'admin'} className="w-full p-2 pl-6 border rounded text-sm bg-white" placeholder="0" />
                            </div>
                            <select value={data.advanceMethod || 'Cash'} onChange={(e) => handleAttendanceChange(worker.id, 'advanceMethod', e.target.value)} disabled={role !== 'admin' || !data.advance} className="p-2 border rounded text-sm bg-white">
                              <option value="Cash">Cash</option>
                              <option value="GPay">GPay</option>
                            </select>
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
                  <select required name="site" className="flex-1 min-w-[150px] p-2 border border-slate-300 rounded text-sm bg-white">
                    <option value="">Select Site...</option>
                    {sites.map((s, i) => <option key={i} value={s}>{s}</option>)}
                  </select>
                  <input required name="desc" placeholder="Expense description..." className="flex-[2] min-w-[200px] p-2 border border-slate-300 rounded text-sm" />
                  <input required name="amount" type="number" placeholder="Amount" className="flex-1 min-w-[100px] p-2 border border-slate-300 rounded text-sm" />
                  <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white p-2 rounded transition-colors font-bold shadow-sm">Add</button>
                </form>

                {todaysExpenses.length > 0 && (
                  <div className="mt-6 overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead className="bg-slate-200 text-slate-600 text-[10px] uppercase tracking-wider">
                        <tr><th className="p-3 border-b">Site</th><th className="p-3 border-b">Description</th><th className="p-3 border-b text-right">Amount</th><th className="p-3 border-b text-center">Action</th></tr>
                      </thead>
                      <tbody>
                        {todaysExpenses.map(exp => (
                          <tr key={exp.id} className="border-b hover:bg-slate-100 bg-white">
                            {editingExpenseId === exp.id ? (
                              <>
                                <td className="p-2">
                                  <select value={editExpenseData.site} onChange={(e) => setEditExpenseData({...editExpenseData, site: e.target.value})} className="w-full p-1 border rounded text-sm bg-white">
                                    <option value="">Select...</option>
                                    {sites.map((s,i)=><option key={i} value={s}>{s}</option>)}
                                  </select>
                                </td>
                                <td className="p-2">
                                  <input value={editExpenseData.desc} onChange={(e) => setEditExpenseData({...editExpenseData, desc: e.target.value})} className="w-full p-1 border rounded text-sm"/>
                                </td>
                                <td className="p-2">
                                  <input type="number" value={editExpenseData.amount} onChange={(e) => setEditExpenseData({...editExpenseData, amount: e.target.value})} className="w-full p-1 border rounded text-sm text-right"/>
                                </td>
                                <td className="p-2 text-center flex justify-center gap-2">
                                  <button onClick={saveEditedExpense} className="text-green-600 hover:text-green-800"><Save size={16}/></button>
                                  <button onClick={cancelEditingExpense} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="p-3 font-medium">{exp.site}</td>
                                <td className="p-3">{exp.description}</td>
                                <td className="p-3 text-right font-bold">₹{exp.amount}</td>
                                <td className="p-3 text-center flex justify-center gap-3">
                                  <button onClick={() => startEditingExpense(exp)} className="text-blue-500 hover:text-blue-700"><Edit2 size={16}/></button>
                                  <button onClick={() => handleDeleteExpense(exp.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SITE CALENDAR TAB */}
        {activeTab === 'calendar' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
             <div className="p-6 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-lg font-bold flex items-center gap-2"><Calendar className="text-blue-600" /> Site Calendar</h2>
              <div className="flex gap-2 w-full sm:w-auto">
                <input type="month" value={calendarMonth} onChange={(e) => setCalendarMonth(e.target.value)} className="p-2 border rounded-lg text-sm bg-white" />
                <select value={calendarSite} onChange={(e) => setCalendarSite(e.target.value)} className="p-2 border rounded-lg text-sm bg-white flex-grow">
                  <option value="">Select Site...</option>
                  {sites.map((s, i) => <option key={i} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            
            {!calendarSite ? (
               <div className="p-16 text-center text-slate-400"><Calendar size={48} className="mx-auto mb-4 opacity-20" /><p className="font-bold">Select a site to view its calendar</p></div>
            ) : (
               <div className="p-6">
                 {/* Days of week header */}
                 <div className="grid grid-cols-7 gap-2 mb-2 text-center font-bold text-xs uppercase tracking-wider text-slate-500">
                    <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                 </div>
                 {/* Calendar Grid */}
                 <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: calendarData.blankStartDays }).map((_, i) => (
                      <div key={`blank-${i}`} className="p-2 bg-slate-50 rounded-lg opacity-50 border border-transparent min-h-[70px] sm:min-h-[90px]"></div>
                    ))}
                    {calendarData.days.map(day => (
                      <div key={day.dateStr} className={`p-1.5 sm:p-2 rounded-lg border min-h-[70px] sm:min-h-[90px] flex flex-col ${day.isActive ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100'}`}>
                         <span className={`text-xs font-bold ${day.isActive ? 'text-blue-800' : 'text-slate-400'}`}>{day.dayNum}</span>
                         {day.isActive ? (
                           <div className="mt-auto space-y-1">
                             {day.workerCount > 0 && <span className="block text-[9px] sm:text-[10px] bg-blue-600 text-white px-1 py-0.5 rounded truncate">{day.workerCount} Workers</span>}
                             {day.expenseTotal > 0 && <span className="block text-[9px] sm:text-[10px] bg-orange-500 text-white px-1 py-0.5 rounded truncate">₹{day.expenseTotal} Mat.</span>}
                           </div>
                         ) : (
                           <span className="mt-auto text-[10px] text-slate-300 hidden sm:block">No Activity</span>
                         )}
                      </div>
                    ))}
                 </div>
               </div>
            )}
          </div>
        )}

        {/* WEEKLY SETTLEMENT TAB */}
        {activeTab === 'weekly' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-center flex-wrap gap-4">
              <h2 className="text-lg font-bold flex items-center gap-2"><Wallet className="text-green-600" /> Settlement for {currentWeekStart}</h2>
              {role === 'admin' && (
                <div className="flex gap-2">
                  <button onClick={() => setIsEditingSettlement(!isEditingSettlement)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-colors">
                    {isEditingSettlement ? <><X size={14}/> Finish Editing</> : <><Edit2 size={14}/> Manual Edit</>}
                  </button>
                  <button onClick={exportWeeklyCSV} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 shadow-sm transition-colors"><Download size={14} /> Export CSV</button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 font-bold text-xs uppercase text-slate-500">
                  <tr><th className="p-4 border-b">Worker</th><th className="p-4 text-center border-b">Days</th><th className="p-4 text-right border-b">Earned</th><th className="p-4 text-right border-b">Advance</th><th className="p-4 text-right border-b font-bold text-slate-800 bg-slate-200">Final Payout</th><th className="p-4 text-right border-b font-bold text-red-600 bg-red-50">Excess (Carry Over)</th></tr>
                </thead>
                <tbody className="text-sm">
                  {weeklyData.map((w) => (
                    <tr key={w.id} className="border-b hover:bg-slate-50">
                      <td className="p-4 font-bold">{w.name}</td>
                      <td className="p-4 text-center font-bold text-blue-600">{w.daysWorked}</td>
                      <td className="p-4 text-right">₹{w.totalEarned}</td>
                      <td className="p-4 text-right text-red-600">
                        ₹{w.totalAdvances}
                        {(w.gpayAdvances > 0 || w.cashAdvances > 0) && (
                          <div className="text-[10px] text-slate-400 font-normal leading-tight mt-1">
                            {w.cashAdvances > 0 && <span>Cash: ₹{w.cashAdvances}<br/></span>}
                            {w.gpayAdvances > 0 && <span>GPay: ₹{w.gpayAdvances}</span>}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right font-bold text-lg bg-slate-50 text-green-800">
                        {isEditingSettlement && role === 'admin' ? (
                          <div className="flex items-center justify-end gap-2">
                            <input type="number" value={w.finalPayout} onChange={(e) => handleOverrideChange(w.id, 'finalPayout', e.target.value)} className="w-20 p-1 border border-indigo-400 rounded text-right text-sm bg-white" /> 
                            {w.isOverridden && <button onClick={() => handleClearOverride(w.id)} className="text-slate-400 hover:text-red-500 transition-colors"><RotateCcw size={16} /></button>}
                          </div>
                        ) : (
                           <span className={w.isOverridden ? "text-indigo-600 underline decoration-dotted" : ""}>₹{w.finalPayout}</span>
                        )}
                      </td>
                      <td className="p-4 text-right font-bold text-lg bg-red-50 text-red-800">
                        {w.carryOver > 0 ? `₹${w.carryOver}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-200 font-bold text-slate-800">
                  <tr>
                    <td colSpan="2" className="p-4 text-right">GRAND TOTALS:</td>
                    <td className="p-4 text-right text-green-700">₹{weeklyTotals.earned}</td>
                    <td className="p-4 text-right text-red-600">₹{weeklyTotals.advances}</td>
                    <td className="p-4 text-right text-green-800 text-lg">₹{weeklyTotals.payout}</td>
                    <td className="p-4 text-right text-red-800 text-lg">₹{weeklyTotals.carryOver}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* REPORTS TAB */}
        {activeTab === 'reports' && role === 'admin' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-slate-50 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><FileSpreadsheet className="text-indigo-600" /> Site Ledger</h2>
              </div>
              <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                <select value={reportPeriodType} onChange={(e) => setReportPeriodType(e.target.value)} className="p-2 border border-slate-300 rounded-lg text-sm bg-white font-bold"><option value="monthly">Monthly</option><option value="weekly">Weekly</option></select>
                {reportPeriodType === 'monthly' ? <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="p-2 border border-slate-300 rounded-lg text-sm bg-white" /> : <input type="date" value={reportWeekDate} onChange={(e) => setReportWeekDate(e.target.value)} className="p-2 border border-slate-300 rounded-lg text-sm bg-white" />}
                <select value={reportSite} onChange={(e) => setReportSite(e.target.value)} className="flex-grow p-2 border border-slate-300 rounded-lg text-sm bg-white"><option value="">Choose Site...</option>{sites.map((s, i) => <option key={i} value={s}>{s}</option>)}</select>
              </div>
            </div>
            {reportSite ? (
              <div className="p-6">
                <div className="flex justify-end mb-4"><button onClick={exportSiteReportCSV} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-xs font-bold flex items-center gap-2 transition-colors"><Download size={14} /> Download Excel</button></div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead><tr className="bg-indigo-50 text-indigo-900 text-[10px] uppercase tracking-widest"><th className="p-3 border-b">Date</th><th className="p-3 border-b">Type</th><th className="p-3 border-b">Description</th><th className="p-3 border-b text-right">Amount</th></tr></thead>
                    <tbody>
                      {reportInfo.data.length > 0 ? reportInfo.data.map((r, i) => (
                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors"><td className="p-3 text-slate-500 text-sm">{r.date}</td><td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.type === 'Labor' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{r.type.toUpperCase()}</span></td><td className="p-3 font-medium text-sm">{r.desc}</td><td className="p-3 text-right font-bold text-sm">₹{r.amount}</td></tr>
                      )) : <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest opacity-50">No records found</td></tr>}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-200"><tr className="text-lg"><td colSpan={3} className="p-4 text-right text-slate-800">Total:</td><td className="p-4 text-right text-indigo-700">₹{reportInfo.totalLabor + reportInfo.totalMaterials}</td></tr></tfoot>
                  </table>
                </div>
              </div>
            ) : <div className="p-16 text-center text-slate-400"><FileSpreadsheet size={48} className="mx-auto mb-4 opacity-20" /><p className="font-bold">Select a site to view records</p></div>}
          </div>
        )}

        {/* TOOLS TAB */}
        {activeTab === 'tools' && role === 'admin' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-4">
                <h2 className="text-sm font-black flex items-center gap-2 text-slate-800"><Wrench size={16} /> CHECKOUT TOOL</h2>
                <form onSubmit={handleAssignTool} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select required name="toolId" className="p-2 border border-slate-300 rounded text-sm bg-white"><option value="">Select Tool...</option>{inventory.filter((t) => t.status === 'Available').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                  <select required name="workerId" className="p-2 border border-slate-300 rounded text-sm bg-white"><option value="">Worker...</option>{workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
                  <select required name="site" className="p-2 border border-slate-300 rounded text-sm bg-white"><option value="">Site...</option>{sites.map((s, i) => <option key={i} value={s}>{s}</option>)}</select>
                  <button type="submit" className="sm:col-span-3 bg-slate-800 text-white font-bold py-2 rounded text-sm hover:bg-slate-900 transition-colors">Assign to Site</button>
                </form>
              </div>
              <div className="md:w-px md:bg-slate-200"></div>
              <div className="flex-1 space-y-4">
                <h2 className="text-sm font-black flex items-center gap-2 text-slate-800"><Plus size={16} /> NEW MACHINE</h2>
                <form onSubmit={handleAddTool} className="flex gap-2"><input required name="name" type="text" className="flex-grow p-2 border border-slate-300 rounded text-sm" placeholder="Mixer, Drills..." /><button type="submit" className="bg-slate-200 text-slate-800 font-black py-2 px-4 rounded text-sm hover:bg-slate-300 transition-colors">Add</button></form>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center"><h2 className="text-xs font-black uppercase tracking-widest text-slate-600">Inventory Status</h2><button onClick={exportInventoryCSV} className="text-blue-600 hover:text-blue-800 transition-colors text-xs font-bold flex items-center gap-1"><Download size={12}/> Audit List</button></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead><tr className="bg-slate-100 text-slate-600 text-[10px] uppercase tracking-widest"><th className="p-4 border-b">Tool</th><th className="p-4 border-b text-center">Status</th><th className="p-4 border-b">Assigned To</th><th className="p-4 border-b">Site</th><th className="p-4 border-b text-center">Action</th></tr></thead>
                  <tbody className="text-sm">
                    {inventory.map((t) => (
                      <tr key={t.id} className="border-b hover:bg-slate-50 transition-colors"><td className="p-4 font-bold">{t.name}</td><td className="p-4 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-black ${t.status === 'Available' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{t.status.toUpperCase()}</span></td><td className="p-4 font-medium text-slate-600">{t.assignedWorker || '-'}</td><td className="p-4 font-medium text-slate-600">{t.assignedSite || '-'}</td><td className="p-4 text-center">
                        {t.status === 'Assigned' ? <button onClick={() => handleReturnTool(t.id)} className="bg-indigo-600 text-white px-3 py-1 rounded text-[10px] font-bold hover:bg-indigo-700 shadow-sm transition-colors">RETURN</button> : <button onClick={() => handleDeleteTool(t.id)} className="text-red-300 hover:text-red-500 p-1 transition-colors"><Trash2 size={16} /></button>}
                      </td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MANAGE TAB */}
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

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && role === 'admin' && (
          <div className="bg-white p-6 rounded-xl border shadow-sm max-w-md mx-auto">
            <h2 className="font-bold mb-6 flex items-center gap-2"><Settings size={20} className="text-blue-600" /> App Settings</h2>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-xs text-blue-800 font-bold uppercase tracking-wider mb-1">Sync Info</p>
                <p className="text-sm text-blue-700 flex items-center gap-2 font-bold"><Database size={14} /> Connection: {syncStatus}</p>
              </div>
              
              <div className="border-t border-b py-4 space-y-3">
                 <div className="flex items-center justify-between mb-2">
                   <span className="text-sm font-bold text-slate-700">Backup Data</span>
                   <select value={exportYear} onChange={(e) => setExportYear(e.target.value)} className="p-1 border rounded text-xs bg-slate-50">
                     <option value="All">All Time</option>
                     {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                   </select>
                 </div>
                 <button onClick={exportMasterAttendanceCSV} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 p-2 rounded font-bold transition-colors flex items-center justify-center gap-2 border text-sm"><Download size={14} /> Attendance History</button>
                 <button onClick={exportMasterExpensesCSV} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 p-2 rounded font-bold transition-colors flex items-center justify-center gap-2 border text-sm"><Download size={14} /> Material Expenses</button>
              </div>

              <button onClick={() => setConfirmClear(true)} className="w-full bg-red-600 hover:bg-red-700 text-white p-3 rounded font-bold transition-colors shadow-sm">Clear Data</button>
              
              {confirmClear && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded animate-pulse">
                  <p className="text-red-700 font-bold mb-2 text-sm">CRITICAL: This will permanently delete all worker logs. Continue?</p>
                  <div className="flex gap-2">
                    <button onClick={handleClearData} className="flex-1 bg-red-600 hover:bg-red-700 text-white p-2 rounded font-bold text-xs uppercase transition-colors">Yes, Delete</button>
                    <button onClick={() => setConfirmClear(false)} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 p-2 rounded font-bold text-xs uppercase transition-colors">Cancel</button>
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
