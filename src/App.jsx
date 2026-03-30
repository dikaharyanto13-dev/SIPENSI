import React, { useState, useMemo, useEffect } from 'react';
import {
  Users, Search, Moon, Sun, LayoutDashboard, ChevronLeft,
  Menu, AlertTriangle, Clock, CheckCircle2,
  ShieldCheck, Info, ClipboardCheck, Download, LogOut, Lock
} from 'lucide-react';

// User credentials (hardcoded for demo - in production, use proper authentication)
const USERS = {
  admin: { password: 'admin123', role: 'admin', name: 'Administrator' },
  user: { password: 'user123', role: 'user', name: 'Petugas Monitoring' }
};

// CSV Parser - Loads data from external CSV file
const parseCSV = (text) => {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  return lines.slice(1).map((line, idx) => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const row = {};
    headers.forEach((h, i) => {
      let val = values[i] || '';
      // Handle NIP - strip extra quotes and handle scientific notation
      if (h === 'NIP') {
        val = val.replace(/"/g, ''); // Remove all quotes
        if (val.toLowerCase().includes('e')) {
          // Handle scientific notation properly without losing precision
          const parts = val.toLowerCase().split('e');
          const mantissa = parts[0].replace('.', '');
          const exponent = parseInt(parts[1], 10);
          
          if (exponent >= 0) {
            // Positive exponent: add zeros after mantissa
            const zerosToAdd = exponent - (mantissa.length - 1);
            val = mantissa + '0'.repeat(Math.max(0, zerosToAdd));
          } else {
            // This case shouldn't happen for NIP, but handle it anyway
            val = '0' + '0'.repeat(-exponent - 1) + mantissa;
          }
        }
      }
      // Handle TMT date format (M/D/YYYY to YYYY-MM-DD)
      if (h === 'TMT' || h === 'TMT. PENSIUN') {
        const parts = val.split('/');
        if (parts.length === 3) {
          val = `${parts[2].padStart(4, '20')}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        }
      }
      row[h] = val;
    });
    // Map CSV headers to app fields
    return {
      id: idx + 1,
      Nama: row['Nama'] || '',
      NIP: row['NIP'] || row['No'] || '',
      Pangkat: row['Pangkat'] || '',
      Jabatan: row['Jabatan Terakhir'] || row['Jabatan'] || '',
      TMT: row['TMT'] || row['TMT. PENSIUN'] || '',
      Unit: row['Unit Kerja'] || row['Unit'] || '',
      Operator: row['Operator'] || '',
      StatusPensiun: row['Status Pensiun'] || 'BUP'
    };
  });
};

const loadCSVData = async () => {
  try {
    const response = await fetch('./data_pensiun_2026.csv');
    const text = await response.text();
    return parseCSV(text);
  } catch (e) {
    console.warn('Could not load CSV, using fallback data:', e);
    return null;
  }
};

const getStatusDetail = (pns) => {
  const tmtDate = new Date(pns.TMT);
  const today = new Date();
  const diffTime = tmtDate - today;
  const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44));

  if (pns.Status === 'Done') {
    return {
      urgency: "done",
      urgencyLabel: "Selesai",
      keterangan: "BERKAS RAMPUNG: Data telah divalidasi dan diusulkan ke BKN. Silakan pantau penerbitan SK."
    };
  }

  if (diffMonths <= 0) {
    return {
      urgency: "expired",
      urgencyLabel: "Lewat TMT",
      keterangan: "PERINGATAN: TMT sudah terlewati. Segera koordinasikan dengan Bidang Pensiun untuk status SK."
    };
  }
  
  if (diffMonths <= 3) {
    return {
      urgency: "sangat-segera",
      urgencyLabel: "Sangat Segera",
      keterangan: "TINDAKAN CEPAT: Waktu < 3 Bulan. Segera kumpulkan Form DPCP dan lampiran pendukung hari ini."
    };
  }
  
  if (diffMonths <= 6) {
    return {
      urgency: "segera",
      urgencyLabel: "Segera",
      keterangan: "PERSIAPAN: Sisa 4-6 bulan. Harap cek kembali kelengkapan SK Pangkat dan data keluarga di SIASN."
    };
  }

  return {
    urgency: "menunggu",
    urgencyLabel: "Menunggu",
    keterangan: "MONITORING: Dalam periode pemantauan berkas. Pastikan data profil di aplikasi sudah mutakhir."
  };
};

const CSV_DATA = [];

const App = () => {
  const [activeTab, setActiveTab] = useState('monitoring');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [darkMode, setDarkMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [csvData, setCsvData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Authentication state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginError, setLoginError] = useState('');
  
  // Add employee form state
  const [newEmployee, setNewEmployee] = useState({
    Nama: '',
    NIP: '',
    Pangkat: '',
    Jabatan: '',
    TMT: '',
    Unit: '',
    StatusPensiun: 'MD'
  });

  // Load CSV data on mount
  useEffect(() => {
    loadCSVData().then(data => {
      setCsvData(data);
      setLoading(false);
    });
  }, []);

  const [dataPegawai, setDataPegawai] = useState(() => {
    try {
      const saved = localStorage.getItem('pegawaiStatus');
      const statusMap = saved ? JSON.parse(saved) : {};
      return CSV_DATA.map(d => ({ ...d, Status: statusMap[d.id] ?? 'Pending' }));
    } catch {
      return CSV_DATA.map(d => ({ ...d, Status: 'Pending' }));
    }
  });

  // Update data when CSV data loads
  useEffect(() => {
    if (csvData) {
      try {
        const saved = localStorage.getItem('pegawaiStatus');
        const map = saved ? JSON.parse(saved) : {};
        setDataPegawai(csvData.map(d => ({ ...d, Status: map[d.id] ?? 'Pending' })));
      } catch { setDataPegawai(csvData.map(d => ({ ...d, Status: 'Pending' }))); }
    }
  }, [csvData]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    try {
      const map = Object.fromEntries(dataPegawai.map(d => [d.id, d.Status]));
      localStorage.setItem('pegawaiStatus', JSON.stringify(map));
    } catch { /* storage unavailable */ }
  }, [dataPegawai]);

  const processedData = useMemo(() => {
    return dataPegawai.map(item => ({
      ...item,
      ...getStatusDetail(item)
    })).sort((a, b) => a.id - b.id);
  }, [dataPegawai]);

  const filteredData = useMemo(() =>
    processedData.filter(item => {
      const matchesSearch = item.Nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.NIP.includes(searchTerm);
      const matchesStatus = statusFilter === 'all' ||
        (item.StatusPensiun || 'BUP') === statusFilter;
      return matchesSearch && matchesStatus;
    }),
    [processedData, searchTerm, statusFilter]
  );

  const toggleStatus = (id) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    setDataPegawai(prev => prev.map(p =>
      p.id === id ? { ...p, Status: p.Status === 'Done' ? 'Pending' : 'Done' } : p
    ));
  };

  // Login handler
  const handleLogin = (username, password) => {
    const user = USERS[username];
    if (user && user.password === password) {
      setCurrentUser({ username, ...user });
      setIsLoggedIn(true);
      setLoginError('');
    } else {
      setLoginError('Username atau password salah');
    }
  };

  // Logout handler
  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
  };
  
  // Add new employee handler
  const handleAddEmployee = (e) => {
    e.preventDefault();
    if (!newEmployee.Nama || !newEmployee.NIP) {
      alert('Nama dan NIP harus diisi!');
      return;
    }
    
    const newId = Math.max(...dataPegawai.map(p => p.id), 0) + 1;
    const employeeToAdd = {
      id: newId,
      ...newEmployee,
      Status: 'Pending'
    };
    
    setDataPegawai(prev => [...prev, employeeToAdd]);
    setNewEmployee({
      Nama: '',
      NIP: '',
      Pangkat: '',
      Jabatan: '',
      TMT: '',
      Unit: '',
      StatusPensiun: 'MD'
    });
    alert('Pegawai berhasil ditambahkan!');
    setActiveTab('monitoring');
  };

  // Show login page if not authenticated
  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} error={loginError} darkMode={darkMode} />;
  }

  const isAdmin = currentUser?.role === 'admin';

  const exportData = () => {
    const headers = ['No', 'NIP', 'Nama', 'Pangkat', 'Jabatan', 'Unit Kerja', 'TMT', 'Status Pensiun', 'Status Monitoring', 'Urgensi'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map(p => [
        p.id,
        `"${p.NIP}"`,
        `"${p.Nama}"`,
        `"${p.Pangkat}"`,
        `"${p.Jabatan}"`,
        `"${p.Unit}"`,
        p.TMT,
        p.StatusPensiun || 'BUP',
        p.Status === 'Done' ? 'Selesai' : 'Pending',
        p.urgencyLabel
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `sipensi_monitoring_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`min-h-screen flex ${darkMode ? 'bg-[#0b1120] text-slate-100' : 'bg-[#f8fafc] text-slate-900'} transition-all`}>

      {/* SIDEBAR */}
      <aside className={`fixed top-0 left-0 h-screen z-50 transition-all border-r shadow-2xl overflow-hidden
        ${isSidebarOpen ? 'w-72' : 'w-0 -translate-x-full'}
        ${darkMode ? 'bg-[#111827] border-slate-800' : 'bg-white border-slate-200'}`}>

        <div className="p-8 border-b dark:border-slate-800 flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg">S</div>
          <div>
            <h1 className="text-xl font-black text-indigo-600 tracking-tighter italic">SIPENSI</h1>
            <p className="text-[8px] uppercase font-bold text-slate-400 tracking-widest">Sitem Informasi & Monitoring Data Pensiun</p>
          </div>
        </div>

        <nav className="p-6 space-y-3">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <LayoutDashboard size={20} /> <span className="text-sm font-black">Statistik Terkini</span>
          </button>
          <button onClick={() => setActiveTab('monitoring')} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${activeTab === 'monitoring' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <Users size={20} /> <span className="text-sm font-black">Database {processedData.length} Pegawai</span>
          </button>
          {isAdmin && (
            <button onClick={() => setActiveTab('tambah')} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${activeTab === 'tambah' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              <Users size={20} /> <span className="text-sm font-black">Tambah Pegawai</span>
            </button>
          )}
        </nav>

        <div className="px-6 py-4">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Ringkasan Status</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">BUP</span>
              <span className="text-xs font-black text-blue-600 dark:text-blue-400">{processedData.filter(d => (d.StatusPensiun || 'BUP') === 'BUP').length}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-red-50 dark:bg-red-500/10">
              <span className="text-xs font-bold text-red-600 dark:text-red-400">MD</span>
              <span className="text-xs font-black text-red-600 dark:text-red-400">{processedData.filter(d => (d.StatusPensiun || 'BUP') === 'MD').length}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">APS</span>
              <span className="text-xs font-black text-amber-600 dark:text-amber-400">{processedData.filter(d => (d.StatusPensiun || 'BUP') === 'APS').length}</span>
            </div>
          </div>
        </div>

        <div className="absolute bottom-10 left-0 w-full px-8">
          <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              {isAdmin ? <ShieldCheck size={20} /> : <Users size={20} />}
              <p className="text-[10px] font-black uppercase tracking-widest">{isAdmin ? 'Administrator' : 'Petugas Monitoring'}</p>
            </div>
            <p className="text-xs font-bold leading-relaxed opacity-80 italic">{currentUser?.name} - {processedData.length} pegawai.</p>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className={`flex-1 p-6 md:p-10 transition-all ${isSidebarOpen ? 'ml-72' : 'ml-0'}`}>

        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-12 gap-6">
          <div className="flex items-center gap-6">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-4 rounded-2xl border shadow-sm transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'bg-white border-slate-200 text-indigo-600'}`}>
              {isSidebarOpen ? <ChevronLeft size={24} /> : <Menu size={24} />}
            </button>
            <div>
              <h2 className="text-4xl font-black tracking-tight">Data Pensiun 2026</h2>
              <p className="text-slate-400 font-bold text-sm mt-1 uppercase tracking-widest">Monitoring Data 1-{processedData.length} Pegawai</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isAdmin ? 'bg-indigo-600' : 'bg-emerald-500'}`}>
                {isAdmin ? <ShieldCheck size={16} className="text-white" /> : <Users size={16} className="text-white" />}
              </div>
              <div className="text-left">
                <p className={`text-xs font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>{currentUser?.name}</p>
                <p className={`text-[10px] font-bold ${isAdmin ? 'text-indigo-400' : 'text-emerald-500'}`}>
                  {isAdmin ? 'Administrator' : 'Petugas'}
                </p>
              </div>
            </div>
            <button onClick={handleLogout} className="p-4 rounded-2xl border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:bg-red-50 dark:hover:bg-red-900/20 group">
              <LogOut size={20} className="text-slate-400 group-hover:text-red-500" />
            </button>
            <button onClick={() => setDarkMode(!darkMode)} className="p-4 rounded-2xl border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm transition-all">
              {darkMode ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-indigo-600" />}
            </button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <StatCard label="Total Database"  val={processedData.length}                                                            icon={<Users size={28} />}         color="indigo"  />
            <StatCard label="BUP (Batas Usia Pensiun)"  val={processedData.filter(d => (d.StatusPensiun || 'BUP') === 'BUP').length}                           icon={<CheckCircle2 size={28} />}   color="blue" />
            <StatCard label="MD (Meninggal Dunia)"   val={processedData.filter(d => (d.StatusPensiun || 'BUP') === 'MD').length}                           icon={<Clock size={28} />}          color="red"   />
            <StatCard label="APS (Pensiun Dini)"   val={processedData.filter(d => (d.StatusPensiun || 'BUP') === 'APS').length}                           icon={<Clock size={28} />}          color="amber"   />
            <StatCard label="Berkas Selesai"  val={processedData.filter(d => d.Status === 'Done').length}                           icon={<CheckCircle2 size={28} />}   color="emerald" />
            <StatCard label="Belum Selesai"   val={processedData.filter(d => d.Status !== 'Done').length}                           icon={<Clock size={28} />}          color="amber"   />
            <StatCard label="Urgent (<3bln)"  val={processedData.filter(d => d.urgency === 'sangat-segera' && d.Status !== 'Done').length} icon={<AlertTriangle size={28} />} color="rose" />
          </div>
        )}

        {activeTab === 'monitoring' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`p-10 rounded-[3rem] border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-2xl shadow-indigo-100/20'}`}>
              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-10 gap-8">
                <div>
                  <h3 className="text-2xl font-black">Data Lengkap 1-{processedData.length}</h3>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-tighter mt-1 italic">Seluruh data dari file CSV telah dimuat</p>
                </div>
                <div className="flex gap-3 flex-wrap xl:flex-nowrap">
                  <div className="relative w-full xl:w-[350px]">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                      type="text"
                      placeholder="Cari Nama Pegawai atau NIP..."
                      className="pl-14 pr-6 py-5 rounded-3xl border w-full bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-4 focus:ring-indigo-500/20 font-black text-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="relative w-full xl:w-[200px]">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="pl-6 pr-6 py-5 rounded-3xl border w-full bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-4 focus:ring-indigo-500/20 font-black text-sm appearance-none cursor-pointer"
                    >
                      <option value="all">Semua Jenis</option>
                      <option value="BUP">BUP (Batas Usia Pensiun)</option>
                      <option value="MD">MD (Meninggal Dunia)</option>
                      <option value="APS">APS (Pensiun Dini)</option>
                    </select>
                  </div>
                  <button
                    onClick={exportData}
                    className="flex items-center gap-2 px-6 py-5 rounded-3xl bg-emerald-600 text-white font-black text-sm hover:bg-emerald-700 transition-all shadow-lg"
                  >
                    <Download size={20} />
                    <span className="hidden sm:inline">Export</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-[2rem] border dark:border-slate-700">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-[11px] font-black uppercase text-slate-400 tracking-widest">
                    <tr>
                      <th className="py-7 px-8 text-center w-16">No</th>
                      <th className="py-7 px-6">NIP</th>
                      <th className="py-7 px-6">Nama Pegawai / Pangkat</th>
                      <th className="py-7 px-6">Status Pensiun</th>
                      <th className="py-7 px-6">Unit / TMT</th>
                      {isAdmin && (
                        <th className="py-7 px-6">Croscheck Keterangan</th>
                      )}
                      <th className="py-7 px-6 text-center">Urgensi</th>
                      {isAdmin && (
                        <th className="py-7 px-6 text-center">Aksi</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-700">
                    {filteredData.map((pns) => (
                      <tr key={pns.id} className="group hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5 transition-all">
                        <td className="py-7 px-8 text-center font-black text-slate-300 group-hover:text-indigo-600 transition-colors">
                          {pns.id}
                        </td>
                        <td className="py-7 px-4 whitespace-nowrap">
                          <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded-md" title={pns.NIP}>
                            {pns.NIP}
                          </span>
                        </td>
                        <td className="py-7 px-8">
                          <p className="font-black text-sm text-indigo-700 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">{pns.Nama}</p>
                          <p className="text-[10px] text-slate-400 font-mono font-bold mt-1 bg-slate-100 dark:bg-slate-800 inline-block px-2 py-0.5 rounded-md">{pns.Pangkat} · {pns.Jabatan}</p>
                        </td>
                        <td className="py-7 px-8 text-center">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                            pns.StatusPensiun === 'MD'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : pns.StatusPensiun === 'APS'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}>
                            {pns.StatusPensiun === 'MD' ? 'Meninggal Dunia' : pns.StatusPensiun === 'APS' ? 'Pensiun Dini' : 'Batas Usia Pensiun'}
                          </span>
                        </td>
                        <td className="py-7 px-8">
                          <p className="text-[10px] font-black uppercase text-slate-500 mb-1 leading-tight">{pns.Unit}</p>
                          <div className="flex items-center gap-2 text-indigo-500 font-bold text-[10px]">
                            <Clock size={12} /> {pns.TMT}
                          </div>
                        </td>
                        {isAdmin && (
                          <td className="py-7 px-8">
                            <div className={`p-4 rounded-2xl border flex gap-3 max-w-sm ${pns.Status === 'Done' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}>
                              <Info size={16} className={`flex-shrink-0 mt-0.5 ${pns.Status === 'Done' ? 'text-emerald-500' : 'text-indigo-500'}`} />
                              <p className={`text-[11px] font-bold leading-relaxed ${pns.Status === 'Done' ? 'text-emerald-700' : 'text-slate-500'}`}>
                                {pns.keterangan}
                              </p>
                            </div>
                          </td>
                        )}
                        <td className="py-7 px-8 text-center">
                          <StatusBadge type={pns.urgency} label={pns.urgencyLabel} />
                        </td>
                        {isAdmin && (
                          <td className="py-7 px-8 text-center">
                            <button
                              onClick={() => toggleStatus(pns.id)}
                              className={`p-4 rounded-2xl transition-all shadow-lg ${pns.Status === 'Done' ? 'bg-emerald-600 text-white hover:scale-105' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-indigo-600 hover:bg-white'}`}
                            >
                              <ClipboardCheck size={22} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tambah' && isAdmin && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`p-10 rounded-[3rem] border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-2xl shadow-indigo-100/20'}`}>
              <div className="mb-10">
                <h3 className="text-2xl font-black">Tambah Pegawai Baru</h3>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-tighter mt-1 italic">Tambahkan data pegawai MD (Meninggal Dunia) atau APS (Pensiun Dini)</p>
              </div>

              <form onSubmit={handleAddEmployee} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={`block text-xs font-black uppercase tracking-widest mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Nama Lengkap *
                    </label>
                    <input
                      type="text"
                      value={newEmployee.Nama}
                      onChange={(e) => setNewEmployee({...newEmployee, Nama: e.target.value})}
                      className={`w-full px-6 py-4 rounded-2xl border text-sm font-bold ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} focus:ring-4 focus:ring-indigo-500/20`}
                      placeholder="Masukkan nama lengkap"
                      required
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-black uppercase tracking-widest mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      NIP *
                    </label>
                    <input
                      type="text"
                      value={newEmployee.NIP}
                      onChange={(e) => setNewEmployee({...newEmployee, NIP: e.target.value})}
                      className={`w-full px-6 py-4 rounded-2xl border text-sm font-bold ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} focus:ring-4 focus:ring-indigo-500/20`}
                      placeholder="Masukkan NIP"
                      required
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-black uppercase tracking-widest mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Pangkat
                    </label>
                    <input
                      type="text"
                      value={newEmployee.Pangkat}
                      onChange={(e) => setNewEmployee({...newEmployee, Pangkat: e.target.value})}
                      className={`w-full px-6 py-4 rounded-2xl border text-sm font-bold ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} focus:ring-4 focus:ring-indigo-500/20`}
                      placeholder="Masukkan pangkat"
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-black uppercase tracking-widest mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Jabatan
                    </label>
                    <input
                      type="text"
                      value={newEmployee.Jabatan}
                      onChange={(e) => setNewEmployee({...newEmployee, Jabatan: e.target.value})}
                      className={`w-full px-6 py-4 rounded-2xl border text-sm font-bold ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} focus:ring-4 focus:ring-indigo-500/20`}
                      placeholder="Masukkan jabatan"
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-black uppercase tracking-widest mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      TMT
                    </label>
                    <input
                      type="date"
                      value={newEmployee.TMT}
                      onChange={(e) => setNewEmployee({...newEmployee, TMT: e.target.value})}
                      className={`w-full px-6 py-4 rounded-2xl border text-sm font-bold ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} focus:ring-4 focus:ring-indigo-500/20`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-black uppercase tracking-widest mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Unit Kerja
                    </label>
                    <input
                      type="text"
                      value={newEmployee.Unit}
                      onChange={(e) => setNewEmployee({...newEmployee, Unit: e.target.value})}
                      className={`w-full px-6 py-4 rounded-2xl border text-sm font-bold ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} focus:ring-4 focus:ring-indigo-500/20`}
                      placeholder="Masukkan unit kerja"
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-black uppercase tracking-widest mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Status Pensiun *
                    </label>
                    <select
                      value={newEmployee.StatusPensiun}
                      onChange={(e) => setNewEmployee({...newEmployee, StatusPensiun: e.target.value})}
                      className={`w-full px-6 py-4 rounded-2xl border text-sm font-bold ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} focus:ring-4 focus:ring-indigo-500/20`}
                      required
                    >
                      <option value="MD">MD (Meninggal Dunia)</option>
                      <option value="APS">APS (Pensiun Dini)</option>
                      <option value="BUP">BUP (Batas Usia Pensiun)</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 pt-6">
                  <button
                    type="submit"
                    className="px-8 py-4 rounded-2xl bg-indigo-600 text-white font-black text-sm hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl"
                  >
                    Simpan Pegawai
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('monitoring')}
                    className="px-8 py-4 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                  >
                    Batal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

// Login Component
const LoginPage = ({ onLogin, error, darkMode }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(username, password);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 ${darkMode ? 'bg-[#0b1120]' : 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500'}`}>
      <div className={`w-full max-w-md p-10 rounded-[3rem] shadow-2xl ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white font-black text-3xl shadow-xl mx-auto mb-6">
            S
          </div>
          <h1 className={`text-3xl font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>SIPENSI</h1>
          <p className={`text-sm font-bold mt-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Sistem Informasi Monitoring Data Pensiun</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className={`block text-xs font-black uppercase tracking-widest mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`w-full px-6 py-4 rounded-2xl border text-sm font-bold ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} focus:ring-4 focus:ring-indigo-500/20`}
              placeholder="Masukkan username"
              required
            />
          </div>

          <div>
            <label className={`block text-xs font-black uppercase tracking-widest mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-6 py-4 rounded-2xl border text-sm font-bold ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} focus:ring-4 focus:ring-indigo-500/20 pr-14`}
                placeholder="Masukkan password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}
              >
                {showPassword ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200">
              <p className="text-red-600 text-xs font-bold text-center">{error}</p>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-sm hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl"
          >
            MASUK
          </button>
        </form>

        <div className={`mt-8 p-4 rounded-2xl ${darkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
          <p className={`text-xs font-bold text-center ${darkMode ? 'text-slate-400' : 'text-slate-500'} mb-3`}>Demo Credentials</p>
          <div className="space-y-2 text-xs">
            <div className={`flex justify-between p-2 rounded-xl ${darkMode ? 'bg-slate-800' : 'bg-white'} border ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <span className={darkMode ? 'text-indigo-400' : 'text-indigo-600'}>Admin:</span>
              <span className={darkMode ? 'text-slate-300' : 'text-slate-700'}>admin / admin123</span>
            </div>
            <div className={`flex justify-between p-2 rounded-xl ${darkMode ? 'bg-slate-800' : 'bg-white'} border ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <span className={darkMode ? 'text-indigo-400' : 'text-indigo-600'}>User:</span>
              <span className={darkMode ? 'text-slate-300' : 'text-slate-700'}>user / user123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, val, icon, color }) => {
  const colors = {
    indigo: 'text-indigo-600',
    blue: 'text-blue-600',
    red: 'text-red-600',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    rose: 'text-rose-600'
  };
  return (
    <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border dark:border-slate-700 shadow-xl flex items-center gap-8 group hover:border-indigo-500 transition-all">
      <div className={`w-16 h-16 rounded-[1.5rem] bg-slate-50 dark:bg-slate-900 flex items-center justify-center ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-3xl font-black mt-1 tracking-tighter">{val}</p>
      </div>
    </div>
  );
};

const StatusBadge = ({ type, label }) => {
  const styles = {
    'sangat-segera': 'bg-rose-500 text-white shadow-rose-200',
    'segera':        'bg-amber-400 text-white shadow-amber-200',
    'menunggu':      'bg-indigo-500 text-white shadow-indigo-200',
    'done':          'bg-emerald-500 text-white shadow-emerald-200',
    'expired':       'bg-slate-800 text-white shadow-slate-200'
  };
  return (
    <span className={`inline-flex items-center justify-center px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg ${styles[type]}`}>
      {label}
    </span>
  );
};

export default App;


