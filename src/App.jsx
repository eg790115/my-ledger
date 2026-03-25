import React, { useState, useEffect, useMemo, Component } from 'react';

import { APP_VERSION, LS } from './utils/constants';
import { getParentCat, getChildCat, safeParse, safeArrayLS, safeNumberLS, nowStr, displayDateClean, parseDateForSort, getSafeCycleRange, getBenArray, getBenBadgeStyle } from './utils/helpers';
import { gasUrl, postGAS, getDeviceToken, deviceValid, setDeviceToken } from './utils/api';
// 🚀 確保有引入 doc 和 setDoc，準備直連 Firestore 寫入問候語
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db, initFirebase } from './utils/firebase';

import { useSyncEngine } from './hooks/useSyncEngine';
import { useAuth } from './hooks/useAuth';
import { useTransactions } from './hooks/useTransactions';
import { useAI } from './hooks/useAI';

import BottomNav from './components/BottomNav';
import Header from './components/Header';
import DashboardSummary from './components/DashboardSummary';
import LoginUI from './components/LoginUI';
import HistoryTab from './components/HistoryTab';
import AnalysisTab from './components/AnalysisTab';
import SettingsTab from './components/SettingsTab';

import { TransactionCard } from './components/TransactionCard';
import { TransactionGroupCard } from './components/TransactionGroupCard';

import { SvgIcon } from './components/Icons';
import { ProxyNotification } from './components/ProxyNotification';
import { ChangePinModal } from './components/ChangePinModal';
import { AddTransactionForm } from './components/AddTransactionForm';
import { EditTransactionModal } from './components/EditTransactionModal';
import { EditGroupParentModal } from './components/EditGroupParentModal';

import { useAppStore } from './store/useAppStore';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error("UI 崩潰詳細報告:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 m-4 bg-red-50 border-2 border-red-500 rounded-3xl text-red-600 font-black break-words shadow-xl animate-in">
          <h3 className="text-xl mb-3 flex items-center gap-2">⚠️ 畫面崩潰了</h3>
          <div className="text-xs bg-white p-3 rounded-xl border border-red-200 text-red-800 font-mono">{this.state.error?.toString()}</div>
          <button onClick={() => window.location.reload()} className="mt-5 w-full py-3 bg-red-600 text-white rounded-xl active:scale-95 transition-transform">重新整理 APP</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);

  useEffect(() => {
    const vaultData = safeParse(localStorage.getItem("vault_data"), null);
    if (vaultData && vaultData.firebaseConfig) {
      try {
        initFirebase(vaultData.firebaseConfig);
        setIsVaultUnlocked(true);
      } catch(e) {
        localStorage.removeItem("vault_data"); 
      }
    }
  }, []);  

  const { activeTab, setActiveTab, isOnline, setIsOnline, loadingCard, setLoadingCard, statusMsg, showStatus, triggerVibration } = useAppStore();

  const [users, setUsers] = useState(() => {
    const saved = safeArrayLS(LS.members) || [];
    return saved.length > 0 ? saved : [{ name: "爸爸", color: "bg-blue-600" }, { name: "媽媽", color: "bg-pink-600" }];
  });

  useEffect(() => {
    if (isVaultUnlocked && db) {
      const unsub = onSnapshot(collection(db, 'members'), (snapshot) => {
        const m = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (m.length > 0) {
          m.sort((a, b) => {
            if (a.name === "爸爸") return -1;
            if (b.name === "爸爸") return 1;
            return 0;
          });
          setUsers(m);
          localStorage.setItem(LS.members, JSON.stringify(m));
        }
      }, (err) => console.error("讀取成員失敗:", err));
      return () => unsub();
    }
  }, [isVaultUnlocked]);

  const [customSubtitle, setCustomSubtitle] = useState("{name}，你好！");
  // 🗑️ 已刪除：原本地快取的 greetingsCache，因為現在要直連雲端了
  const [billingStartDay, setBillingStartDay] = useState(() => safeNumberLS(LS.billingStartDay, 1));
  
  const [showClearCacheModal, setShowClearCacheModal] = useState(false);
  const [showLoginClearCacheModal, setShowLoginClearCacheModal] = useState(false);
  const [loginCachePassword, setLoginCachePassword] = useState("");
  const [showClearQueueModal, setShowClearQueueModal] = useState(false);
  const isLoading = loadingCard.show;

  const [snapshotsCache, setSnapshotsCache] = useState(() => { try { return JSON.parse(localStorage.getItem('snapshots_cache')) || {}; } catch { return {}; } });

  const [editingTx, setEditingTx] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedTrashGroups, setExpandedTrashGroups] = useState({});
  const [viewingHistoryItem, setViewingHistoryItem] = useState(null);
  const [analysisDetailData, setAnalysisDetailData] = useState(null);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [confirmHardDeleteId, setConfirmHardDeleteId] = useState(null);
  const [showConfirmEmptyTrash, setShowConfirmEmptyTrash] = useState(false);
  const [voiceReviewTxs, setVoiceReviewTxs] = useState(null);

  const [historySearch, setHistorySearch] = useState("");
  const [debouncedHistorySearch, setDebouncedHistorySearch] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState("all");
  const [historyDateFilter, setHistoryDateFilter] = useState("current_month");
  const [showSearchFilterModal, setShowSearchFilterModal] = useState(false);
  const [historyExcludeSearch, setHistoryExcludeSearch] = useState("");
  const [debouncedHistoryExcludeSearch, setDebouncedHistoryExcludeSearch] = useState("");
  const [analysisDateFilter, setAnalysisDateFilter] = useState("current_month");
  const [analysisCustomStart, setAnalysisCustomStart] = useState("");
  const [analysisCustomEnd, setAnalysisCustomEnd] = useState("");
  const [analysisType, setAnalysisType] = useState("expense");
  const [selectedAnalysisLevel1, setSelectedAnalysisLevel1] = useState(null);
  const [selectedAnalysisLevel2, setSelectedAnalysisLevel2] = useState(null);
  const [animTrigger, setAnimTrigger] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [unackedProxyTxs, setUnackedProxyTxs] = useState([]);

  const [navKey, setNavKey] = useState(0);
  useEffect(() => {
    const handleShortcutsUpdate = () => setNavKey(k => k + 1);
    window.addEventListener('shortcuts_updated', handleShortcutsUpdate);
    return () => window.removeEventListener('shortcuts_updated', handleShortcutsUpdate);
  }, []);

  const {
    currentUser, setCurrentUser, selectingUser, setSelectingUser,
    pinInput, setPinInput, fallbackToPin, setFallbackToPin,
    showBootstrapModal, setShowBootstrapModal, bootstrapSecret, setBootstrapSecret,
    showUnbindModal, setShowUnbindModal, setUnbindPin, showChangePinModal, setShowChangePinModal, 
    forceReloginForToken, handleBioLoginLocal, handleUserClick, bindDeviceBio, bioBound,
    handleLogin
  } = useAuth({ isOnline, showStatus, setLoadingCard, triggerVibration }) || {};

  useEffect(() => {
    if (!db || !currentUser?.name) return;
    
    const unsub = onSnapshot(doc(db, 'members', currentUser.name), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();

        if (data.billingStartDay) {
          setBillingStartDay(data.billingStartDay);
          localStorage.setItem('billing_start_day_v1', String(data.billingStartDay));
        }

        if (data.shortcuts) {
          localStorage.setItem('quick_shortcuts', JSON.stringify(data.shortcuts));
          window.dispatchEvent(new Event('shortcuts_updated'));
        }

        // 🚀 3. 同步個人問候語 (瞬間更新，不需再靠 GAS)
        if (data.greeting) {
          setCustomSubtitle(data.greeting);
        } else {
          setCustomSubtitle("{name}，你好！");
        }
      }
    });
    return () => unsub();
  }, [currentUser?.name]);


  const { txCache = [], trashCache = [], isSyncing = false, syncQueue = [], requestSync = () => {} } = useSyncEngine({ currentUser }) || {};

  const { 
    pendingMap = {}, visibleTransactions = [], visibleTrash = [], myTransactions = [], 
    handleAdd = () => {}, handleUpdateTx = () => {}, handleUpdateGroupParent = () => {}, handleDeleteTx = () => {}, 
    handleRestoreTrash = () => {}, handleHardDeleteTrash = () => {}, handleEmptyTrash = () => {} 
  } = useTransactions({ currentUser, txCache, trashCache, triggerVibration, showStatus, setActiveTab, setEditingTx, setEditingGroup, setConfirmHardDeleteId, setShowConfirmEmptyTrash, setShowTrashModal }) || {};

  const { aiEvalData, sysConfig, setSysConfig, isAIEvaluating, handleForceAIEval, processVoiceText, processImageReceipt } = useAI({ currentUser, isOnline, txCache, showStatus }) || {};
const handleImageRecordStop = async (base64, mimeType) => {
    const safeName = currentUser?.name || "未知";
    setLoadingCard({ show: true, text: "📸 AI 正在用力看圖識字中..." });
    try {
      const parsedTxs = await processImageReceipt(base64, mimeType, safeName);
      if (parsedTxs && parsedTxs.length > 0) setVoiceReviewTxs(parsedTxs); 
    } catch (e) { 
      showStatus("error", e.message || "圖片解析失敗"); 
    } finally { 
      setLoadingCard({ show: false, text: "" }); 
    }
  };
  const fallbackHandleLogin = async (user, pin) => {
    setLoadingCard({ show: true, text: "登入中..." });
    try {
      const { verifyPinOnline } = await import('./utils/api');
      await verifyPinOnline(user.name, pin);
      setCurrentUser(user);
      showStatus("success", `歡迎回來，${user.name}`);
    } catch (e) {
      showStatus("error", e.message || "密碼錯誤");
    } finally {
      setLoadingCard({ show: false, text: "" });
    }
  };
  const finalHandleLogin = handleLogin || fallbackHandleLogin;

  const ToastUI = statusMsg?.text ? (
    <div className="fixed bottom-24 left-0 right-0 flex justify-center z-[1000] pointer-events-none px-4 text-center">
      <div className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in pointer-events-auto ${statusMsg.type === "success" ? "bg-green-600 text-white" : statusMsg.type === "error" ? "bg-red-600 text-white" : statusMsg.type === "info" ? "bg-gray-800 text-white border border-gray-600" : "bg-blue-600 text-white"}`}>
        <span className="text-sm font-bold tracking-tight text-center">{statusMsg.text}</span>
      </div>
    </div>
  ) : null;

  const handleVoiceRecordStop = async (text) => {
    const safeName = currentUser?.name || "未知";
    setLoadingCard({ show: true, text: "🤖 正在呼叫 AI 大腦解析中..." });
    try {
      const parsedTxs = await processVoiceText(text, safeName);
      if (parsedTxs && parsedTxs.length > 0) setVoiceReviewTxs(parsedTxs);
    } catch (e) { showStatus("error", e.message); } finally { setLoadingCard({ show: false, text: "" }); }
  };

  const handleConfirmVoice = () => {
    if (triggerVibration) triggerVibration([20, 40, 20]);
    const baseTimestamp = Date.now();
    const groupMap = {}; 
    const randomSuffix = () => Math.random().toString(36).substring(2, 8);
    const safeName = currentUser?.name || "未知";

    const completeTxs = (voiceReviewTxs || []).map((tx, idx) => {
      let gId = ""; let pDesc = "";
      if (tx.isGroup && tx.parentTitle) {
         if (!groupMap[tx.parentTitle]) groupMap[tx.parentTitle] = `G_${baseTimestamp}_${safeName}_${randomSuffix()}`;
         gId = groupMap[tx.parentTitle]; pDesc = tx.parentTitle;
      }
      return {
         id: `${baseTimestamp + idx}_${safeName}_${randomSuffix()}`,
         date: (tx.date || nowStr()).replace('T', ' '), 
         timestamp: baseTimestamp + idx,
         type: tx.type || "expense",
         category: tx.category || "其他/雜項", amount: Number(tx.amount) || 0,
         desc: tx.desc || "", member: tx.member || safeName, recorder: safeName, beneficiary: tx.beneficiary || safeName,
         groupId: gId, parentDesc: pDesc
      };
    });

    if (setActiveTab) setActiveTab("dashboard");
    completeTxs.forEach(tx => handleAdd(tx));
    setVoiceReviewTxs(null); 
  };

  // 🚀 完整替換：已經修復「空白備註不會亂帶名稱」的全新寫法
  const handleQuickAdd = (side, manualAmount) => {
    if (!side || typeof side !== 'string' || side.nativeEvent) return; 
    if (triggerVibration) triggerVibration([20, 40]);
    
    const safeName = currentUser?.name || "未知";
    const saved = JSON.parse(localStorage.getItem('quick_shortcuts') || '{}');
    const targetShortcut = saved[side];

    if (!targetShortcut) {
        showStatus("error", "捷徑讀取失敗，請重新儲存設定");
        return;
    }

    let finalAmount = 0;
    if (manualAmount !== undefined && manualAmount !== null && !isNaN(Number(manualAmount)) && Number(manualAmount) !== 0) {
        finalAmount = Number(manualAmount);
    } else {
        finalAmount = Number(targetShortcut.amount) || 0;
    }
    
    let type = "expense";
    if (targetShortcut.category && String(targetShortcut.category).includes("收入")) type = "income";
    else if (targetShortcut.type === "income") type = "income";

    const newTx = {
        amount: finalAmount,
        category: targetShortcut.category || "其他/雜項",
        desc: targetShortcut.memo !== undefined ? targetShortcut.memo : "", 
        type: type,
        date: nowStr().replace('T', ' '),
        timestamp: Date.now(),
        member: safeName,
        recorder: safeName,
        beneficiary: safeName
    };

    handleAdd(newTx);
  };

  useEffect(() => { if (activeTab === "analysis") { setAnimTrigger(false); const timer = setTimeout(() => setAnimTrigger(true), 50); return () => clearTimeout(timer); } }, [activeTab, analysisType, analysisDateFilter]);
  useEffect(() => { const handleNetworkChange = () => { if (setIsOnline) setIsOnline(navigator.onLine); }; window.addEventListener('online', handleNetworkChange); window.addEventListener('offline', handleNetworkChange); return () => { window.removeEventListener('online', handleNetworkChange); window.removeEventListener('offline', handleNetworkChange); }; }, [setIsOnline]);
  
  // 🗑️ 已刪除：原本依賴 greetingsCache 切換名稱的 useEffect
  
  useEffect(() => { const timer = setTimeout(() => { setDebouncedHistorySearch(historySearch); setDebouncedHistoryExcludeSearch(historyExcludeSearch); }, 350); return () => clearTimeout(timer); }, [historySearch, historyExcludeSearch]);
  useEffect(() => { if (activeTab !== "analysis") { setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null); setAnalysisType("expense"); } }, [activeTab]);
  useEffect(() => { setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null); }, [analysisType, analysisDateFilter, analysisCustomStart, analysisCustomEnd]);
  useEffect(() => { setSelectedAnalysisLevel2(null); }, [selectedAnalysisLevel1]);

  useEffect(() => {
    if (!currentUser || !txCache || txCache.length === 0) return;
    const acked = safeParse(localStorage.getItem(LS.ackProxyTxs), []);
    const safeUserName = String(currentUser?.name || "").trim();
    const unacked = txCache.filter(tx => String(tx.member).trim() === safeUserName && tx.recorder && String(tx.recorder).trim() !== safeUserName && String(tx.recorder).trim() !== '系統' && !acked.includes(tx.id));
    const currentUnackedIds = (unackedProxyTxs || []).map(t => t.id).sort().join(',');
    const newUnackedIds = unacked.map(t => t.id).sort().join(',');
    if (currentUnackedIds !== newUnackedIds) setUnackedProxyTxs(unacked);
  }, [currentUser, txCache, unackedProxyTxs]);

  const handleSyncClick = () => { if(triggerVibration) triggerVibration(15); if(showStatus) showStatus("info", "系統已為即時同步模式"); };
  const refreshDeviceToken = async () => { const data = await postGAS({ action: "DEVICE_REFRESH", deviceToken: getDeviceToken() }); if (data.result !== "success") throw new Error(data.message || "憑證已過期"); setDeviceToken(data.deviceToken, data.deviceExp); return data; };
  
  const bootstrapDevice = async (secret) => { 
    if (!secret) throw new Error("請輸入雲端密碼"); 
    const data = await postGAS({ action: "DEVICE_BOOTSTRAP", appSecret: secret }); 
    if (data.result !== "success") throw new Error(data.message || "綁定失敗"); 
    const safeForeverExp = Date.now() + (10 * 365 * 24 * 60 * 60 * 1000);
    setDeviceToken(data.deviceToken, safeForeverExp); 
    return data; 
  };
  
  // 🚀 全新替換：直連 Firestore 儲存問候語，拔除 GAS 的依賴
  const handleSaveGreeting = async () => {
    if (!db || !currentUser?.name) { showStatus("error", "資料庫未連線"); return; }
    try {
      setLoadingCard({ show: true, text: "正在儲存..." });
      await setDoc(doc(db, 'members', currentUser.name), { greeting: customSubtitle }, { merge: true });
      showStatus("success", "✅ 問候語已同步至個人雲端");
    } catch (e) { 
      showStatus("error", e.message || "儲存失敗"); 
    } finally { 
      setLoadingCard({ show: false, text: "" }); 
    }
  };

  const currentCycleRange = useMemo(() => getSafeCycleRange(new Date(), billingStartDay, 0), [billingStartDay]);
  const stats = useMemo(() => {
    let income = 0; let expense = 0;
    (myTransactions || []).forEach(t => {
      const txTime = parseDateForSort(t);
      if (txTime >= currentCycleRange.start && txTime <= currentCycleRange.end) {
        if (t.type === "income") income += (Number(t.amount) || 0);
        if (t.type === "expense") expense += (Number(t.amount) || 0);
      }
    });
    return { income, expense, balance: income - expense };
  }, [myTransactions, currentCycleRange]);

  const groupTransactions = (list) => {
    const grouped = []; const groupMap = {};
    for (const tx of (list || [])) {
      if (tx.groupId) {
        if (!groupMap[tx.groupId]) {
          const parts = String(tx.parentDesc || "").split("|||");
          groupMap[tx.groupId] = { isGroup: true, groupId: tx.groupId, parentTitle: parts.length > 1 ? parts[0] : (parts[0] || "拆分紀錄"), parentDesc: parts.length > 1 ? parts[1] : "", date: tx.date, timestamp: tx.timestamp, member: tx.member, recorder: tx.recorder, type: tx.type, amount: 0, children: [], editHistory: tx.editHistory || [] };
          grouped.push(groupMap[tx.groupId]);
        }
        groupMap[tx.groupId].children.push(tx);
        groupMap[tx.groupId].amount += Number(tx.amount || 0);
      } else { grouped.push({ ...tx, isGroup: false }); }
    }
    return grouped;
  };

  const allGroupedAndSorted = useMemo(() => {
    const safeUserName = String(currentUser?.name || "").trim();
    const grouped = groupTransactions(visibleTransactions || []) || [];

    const filtered = grouped.filter(item => {
      if (item.isGroup) {
        return item.children.some(c => String(c.member).trim() === safeUserName || String(c.recorder).trim() === safeUserName);
      }
      return String(item.member).trim() === safeUserName;
    });

    return filtered.sort((a, b) => {
      const tA = parseDateForSort(a); const tB = parseDateForSort(b);
      return tB - tA || String(b.isGroup ? (b.children[0]?.id || "") : b.id).localeCompare(String(a.isGroup ? (a.children[0]?.id || "") : a.id));
    });
  }, [visibleTransactions, currentUser]);

  const filteredHistoryGroups = useMemo(() => {
    if (!currentUser) return [];
    try {
      const safeSearchTxt = String(debouncedHistorySearch || "").trim().toLowerCase();
      const safeExcludeTxt = String(debouncedHistoryExcludeSearch || "").trim().toLowerCase();
      let list = [...(allGroupedAndSorted || [])];

      if (historyTypeFilter !== "all") list = list.filter(item => item.type === historyTypeFilter);

      let startTime = 0; let endTime = Infinity;
      if (historyDateFilter !== "all") {
        const now = new Date();
        if (historyDateFilter === "current_month") { const range = getSafeCycleRange(now, billingStartDay, 0); startTime = range.start; endTime = range.end; }
        else if (historyDateFilter === "last_month") { const range = getSafeCycleRange(now, billingStartDay, -1); startTime = range.start; endTime = range.end; }
        else {
          endTime = now.getTime(); const cutoff = new Date();
          if (historyDateFilter === "7d") cutoff.setDate(now.getDate() - 7);
          else if (historyDateFilter === "14d") cutoff.setDate(now.getDate() - 14);
          else if (historyDateFilter === "1m") cutoff.setMonth(now.getMonth() - 1);
          else if (historyDateFilter === "3m") cutoff.setMonth(now.getMonth() - 3);
          else if (historyDateFilter === "6m") cutoff.setMonth(now.getMonth() - 6);
          else if (historyDateFilter === "1y") cutoff.setFullYear(now.getFullYear() - 1);
          startTime = cutoff.getTime();
        }
      }

      if (startTime > 0 || endTime < Infinity) {
        let filteredList = [];
        for (const item of list) {
          if (item.isGroup) {
            const validChildren = (item.children || []).filter(child => { const txTime = parseDateForSort(child); return txTime >= startTime && txTime <= endTime; });
            if (validChildren.length > 0) {
              let newAmount = 0; validChildren.forEach(c => { newAmount += Number(c.amount || 0); });
              filteredList.push({ ...item, children: validChildren, amount: newAmount, date: validChildren[0]?.date || item.date });
            }
          } else { const txTime = parseDateForSort(item); if (txTime >= startTime && txTime <= endTime) filteredList.push(item); }
        }
        list = filteredList;
      }
      return list;
    } catch (error) { return []; }
  }, [allGroupedAndSorted, currentUser, historyTypeFilter, historyDateFilter, debouncedHistorySearch, debouncedHistoryExcludeSearch, billingStartDay]);

  const historyFilteredStats = useMemo(() => {
    let inc = 0; let exp = 0;
    const safeUserName = String(currentUser?.name || "").trim();
    
    (filteredHistoryGroups || []).forEach(item => {
      if (item.isGroup) { 
        (item.children || []).forEach(c => { 
          if (String(c.member).trim() === safeUserName) {
            if (c.type === "income") inc += (Number(c.amount) || 0); 
            if (c.type === "expense") exp += (Number(c.amount) || 0); 
          }
        }); 
      } 
      else { 
        if (String(item.member).trim() === safeUserName) {
          if (item.type === "income") inc += (Number(item.amount) || 0); 
          if (item.type === "expense") exp += (Number(item.amount) || 0); 
        }
      }
    });
    return { income: inc, expense: exp, balance: inc - exp };
  }, [filteredHistoryGroups, currentUser]);

  function toggleGroup(gId) { if(triggerVibration) triggerVibration(10); setExpandedGroups(p => ({ ...p, [gId]: !p[gId] })); }
  function toggleTrashGroup(gId) { if(triggerVibration) triggerVibration(10); setExpandedTrashGroups(p => ({ ...p, [gId]: !p[gId] })); }

  function renderItemOrGroup(item, allowEdit) {
    if (item.isGroup) {
      return <TransactionGroupCard key={item.groupId} group={item} allowEdit={allowEdit} pendingMap={{}} auditLogs={[]} currentUser={currentUser} setViewingHistoryItem={setViewingHistoryItem} setEditingGroup={setEditingGroup} setEditingTx={setEditingTx} triggerVibration={triggerVibration} expandedGroups={expandedGroups} toggleGroup={toggleGroup} />;
    }
    return <TransactionCard key={item.id} tx={item} allowEdit={allowEdit} pendingMap={{}} auditLogs={[]} currentUser={currentUser} setViewingHistoryItem={setViewingHistoryItem} setEditingTx={setEditingTx} triggerVibration={triggerVibration} />;
  }

  const setQuickDateFilter = (filterVal) => { if(triggerVibration) triggerVibration(10); setHistoryDateFilter(filterVal); setAnalysisDateFilter(filterVal); setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null); };
  const isHistoryFiltered = debouncedHistorySearch || debouncedHistoryExcludeSearch || historyTypeFilter !== "all" || historyDateFilter !== "all";

  const processedTrash = useMemo(() => {
    const groups = [];
    const map = {};
    (visibleTrash || []).forEach(tx => {
      if (tx.deleteBatchId) {
        if (!map[tx.deleteBatchId]) {
          map[tx.deleteBatchId] = { isBatch: true, id: tx.deleteBatchId, children: [], amount: 0, title: tx.parentTitle || '拆分紀錄', date: tx.date, type: tx.type };
          groups.push(map[tx.deleteBatchId]);
        }
        map[tx.deleteBatchId].children.push(tx);
        map[tx.deleteBatchId].amount += Number(tx.amount || 0);
      } else {
        groups.push(tx);
      }
    });
    return groups.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [visibleTrash]);

  if (!isVaultUnlocked) {
    return (
      <div translate="no" className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-8 animate-in relative w-full text-center font-black">
        {ToastUI}
        {isLoading && (
          <div className="fixed inset-0 z-[9999] bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-5 animate-in">
              <SvgIcon name="spinner" size={40} className="animate-spin text-blue-600" />
              <p className="font-black text-gray-800 text-sm tracking-widest">{loadingCard?.text || "處理中..."}</p>
            </div>
          </div>
        )}
        <div className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 text-gray-900 relative shadow-2xl">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🔐</div>
          <h3 className="font-black text-xl mb-2 text-red-600">最高權限鎖定</h3>
          <p className="text-xs text-gray-500 mb-6 font-bold leading-relaxed">請輸入您的雲端密碼以解鎖金庫。</p>
          <input type="password" value={bootstrapSecret || ""} onChange={(e) => setBootstrapSecret(e.target.value)} placeholder="請輸入雲端密碼" className="w-full bg-gray-100 rounded-2xl px-4 py-4 font-black outline-none mb-6 text-center tracking-widest text-lg" disabled={isLoading} />
          <button onClick={async () => {
              if (!bootstrapSecret) { showStatus("error", "請輸入密碼！"); return; }
              try {
                setLoadingCard({ show: true, text: "正在開啟金庫大門..." });
                const res = await postGAS({ action: "UNLOCK_VAULT", appSecret: bootstrapSecret });
                if (res.result !== "success") throw new Error(res.message || "驗證失敗");
                
                localStorage.setItem("vault_data", JSON.stringify({ firebaseConfig: res.firebaseConfig }));
                initFirebase(res.firebaseConfig);

                setLoadingCard({ show: true, text: "正在安全綁定通訊..." });
                await new Promise(r => setTimeout(r, 1000));
                await bootstrapDevice(bootstrapSecret);

                if (typeof setShowBootstrapModal === 'function') setShowBootstrapModal(false);
                
                setIsVaultUnlocked(true);
                showStatus("success", "解鎖與綁定成功！");
              } catch (e) { showStatus("error", e.message || "密碼錯誤或網路異常"); } 
              finally { setLoadingCard({ show: false, text: "" }); }
            }} disabled={isLoading} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black active:scale-95 disabled:opacity-50 shadow-lg shadow-red-500/30">解鎖金庫</button>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div translate="no" className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-8 animate-in relative w-full text-center font-black">
        {ToastUI}
        {isLoading && ( <div className="fixed inset-0 z-[9999] bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center p-4"> <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-5 animate-in"> <SvgIcon name="spinner" size={40} className="animate-spin text-blue-600" /> <p className="font-black text-gray-800 text-sm tracking-widest">{loadingCard.text || "處理中..."}</p> </div> </div> )}
        
        <LoginUI 
          users={users} 
          familyConfig={users} 
          onLogin={finalHandleLogin}
          selectingUser={selectingUser} 
          setSelectingUser={setSelectingUser} 
          handleUserClick={handleUserClick} 
          syncQueue={syncQueue} 
          setShowClearQueueModal={setShowClearQueueModal} 
          triggerVibration={triggerVibration} 
          setShowClearCacheModal={setShowLoginClearCacheModal} 
          fallbackToPin={fallbackToPin} 
          setFallbackToPin={setFallbackToPin} 
          handleBioLoginLocal={handleBioLoginLocal} 
          showStatus={showStatus} 
          setCurrentUser={setCurrentUser} 
          pinInput={pinInput} 
          setPinInput={setPinInput} 
          isLoading={isLoading}
          loadingCard={loadingCard}
          bioBound={bioBound}
        />
        
        {showBootstrapModal && !deviceValid() && (
          <div className="fixed inset-0 z-[800] bg-gray-900/90 backdrop-blur-md flex items-center justify-center p-8 animate-in text-white">
            <div className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 text-gray-900 relative text-center">
              <h3 className="font-black text-lg mb-2 text-blue-600">設備尚未綁定</h3>
              <p className="text-xs text-gray-500 mb-5 font-bold leading-relaxed">您的手機憑證已失效，請重新輸入雲端密碼完成綁定：</p>
              <input value={bootstrapSecret} onChange={(e)=>setBootstrapSecret(e.target.value)} type="password" placeholder="請輸入雲端密碼" className="w-full bg-gray-100 rounded-2xl px-4 py-3 font-black outline-none mb-6 text-center tracking-widest" disabled={isLoading} />
              <button onClick={async () => {
                try {
                  setLoadingCard({ show:true, text:"正在綁定雲端..." });
                  await bootstrapDevice(bootstrapSecret); 
                  if (setShowBootstrapModal) setShowBootstrapModal(false);
                  setBootstrapSecret("");
                  showStatus("success","✅ 手機設備已成功綁定！");
                } catch (e) {
                  showStatus("error", e.message || "雲端密碼錯誤");
                } finally {
                  setLoadingCard({ show:false, text:"" });
                }
              }} disabled={isLoading} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black active:scale-95 shadow-md shadow-blue-500/30 disabled:opacity-50">確認綁定</button>
            </div>
          </div>
        )}

        {showLoginClearCacheModal && (
          <div className="fixed inset-0 z-[800] bg-gray-900/90 backdrop-blur-md flex items-center justify-center p-8 animate-in text-white" onClick={(e) => { if(e.target === e.currentTarget && !isLoading) {setShowLoginClearCacheModal(false); setLoginCachePassword("");} }}>
            <div className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 text-gray-900 relative text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><SvgIcon name="refresh" size={32} /></div>
              <h3 className="font-black text-lg mb-2 text-red-600">深度清理 (清空快取)</h3>
              <p className="text-xs text-gray-500 mb-5 font-bold leading-relaxed">請輸入「雲端密碼」確認執行：</p>
              <input value={loginCachePassword} onChange={(e)=>setLoginCachePassword(e.target.value)} type="password" placeholder="請輸入雲端密碼" className="w-full bg-gray-100 rounded-2xl px-4 py-3 font-black outline-none mb-6 text-center tracking-widest" disabled={isLoading} />
              <div className="flex gap-3">
                <button onClick={() => {setShowLoginClearCacheModal(false); setLoginCachePassword("");}} disabled={isLoading} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black active:scale-95 disabled:opacity-50">取消</button>
                <button onClick={async () => {
                  if (!loginCachePassword) { showStatus("error", "請輸入密碼！"); return; }
                  try {
                    setLoadingCard({ show: true, text: "正在驗證密碼..." });
                    const res = await postGAS({ action: "DEVICE_BOOTSTRAP", appSecret: loginCachePassword });
                    if (res.result !== "success") throw new Error("密碼錯誤");
                    
                    setLoadingCard({ show: true, text: "正在清理快取..." });
                    localStorage.clear();
                    if ('serviceWorker' in navigator) { const registrations = await navigator.serviceWorker.getRegistrations(); for (let r of registrations) await r.unregister(); }
                    if ('caches' in window) { const cacheNames = await caches.keys(); for (let c of cacheNames) await caches.delete(c); }
                    
                    showStatus("success", "快取已清空！即將重啟");
                    setShowLoginClearCacheModal(false); setLoginCachePassword(""); 
                    setTimeout(() => { window.location.reload(true); }, 1500);
                  } catch(e) { showStatus("error", e.message || "密碼錯誤"); } finally { setLoadingCard({ show: false, text: "" }); }
                }} disabled={isLoading} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black active:scale-95 shadow-md shadow-red-500/30 disabled:opacity-50">確認清空</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const safeUserName = String(currentUser?.name || "").trim();

  return (
    <div translate="no" className="min-h-screen bg-gray-50 text-gray-900 pb-24 max-w-md mx-auto relative flex flex-col overflow-x-hidden w-full text-left font-black">
      <ProxyNotification transactions={unackedProxyTxs || []} onAck={() => { if(triggerVibration) triggerVibration(15); const acked = safeParse(localStorage.getItem(LS.ackProxyTxs), []); const newAcked = [...new Set([...acked, ...(unackedProxyTxs || []).map(t => t.id)])]; localStorage.setItem(LS.ackProxyTxs, JSON.stringify(newAcked)); setUnackedProxyTxs([]); }} />
      {isLoading && ( <div className="fixed inset-0 z-[9999] bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center p-4"> <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-5 animate-in slide-in-from-bottom-4"> <SvgIcon name="spinner" size={40} className="animate-spin text-blue-600" /> <p className="font-black text-gray-800 text-sm tracking-widest">{loadingCard.text || "處理中..."}</p> </div> </div> )}
      
      {/* 🚀 主畫面的深度清理快取視窗 */}
      {showClearCacheModal && (
        <div className="fixed inset-0 z-[800] bg-gray-900/90 backdrop-blur-md flex items-center justify-center p-8 animate-in text-white" onClick={(e) => { if(e.target === e.currentTarget && !isLoading) {setShowClearCacheModal(false); setLoginCachePassword("");} }}>
          <div className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 text-gray-900 relative text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><SvgIcon name="refresh" size={32} /></div>
            <h3 className="font-black text-lg mb-2 text-red-600">深度清理 (清空快取)</h3>
            <p className="text-xs text-gray-500 mb-5 font-bold leading-relaxed">請輸入「雲端密碼」確認執行：</p>
            <input value={loginCachePassword} onChange={(e)=>setLoginCachePassword(e.target.value)} type="password" placeholder="請輸入雲端密碼" className="w-full bg-gray-100 rounded-2xl px-4 py-3 font-black outline-none mb-6 text-center tracking-widest" disabled={isLoading} />
            <div className="flex gap-3">
              <button onClick={() => {setShowClearCacheModal(false); setLoginCachePassword("");}} disabled={isLoading} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black active:scale-95 disabled:opacity-50">取消</button>
              <button onClick={async () => {
                if (!loginCachePassword) { showStatus("error", "請輸入密碼！"); return; }
                try {
                  setLoadingCard({ show: true, text: "正在驗證密碼..." });
                  const res = await postGAS({ action: "DEVICE_BOOTSTRAP", appSecret: loginCachePassword });
                  if (res.result !== "success") throw new Error("密碼錯誤");
                  
                  setLoadingCard({ show: true, text: "正在清理快取..." });
                  localStorage.clear();
                  if ('serviceWorker' in navigator) { const registrations = await navigator.serviceWorker.getRegistrations(); for (let r of registrations) await r.unregister(); }
                  if ('caches' in window) { const cacheNames = await caches.keys(); for (let c of cacheNames) await caches.delete(c); }
                  
                  showStatus("success", "快取已清空！即將重啟");
                  setShowClearCacheModal(false); setLoginCachePassword(""); 
                  setTimeout(() => { window.location.reload(true); }, 1500);
                } catch(e) { showStatus("error", e.message || "密碼錯誤"); } finally { setLoadingCard({ show: false, text: "" }); }
              }} disabled={isLoading} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black active:scale-95 shadow-md shadow-red-500/30 disabled:opacity-50">確認清空</button>
            </div>
          </div>
        </div>
      )}

      {voiceReviewTxs && (() => {
  const editingIdx = (voiceReviewTxs || []).findIndex(t => t.isEditing);
  
  // 1. 單筆編輯模式
  if (editingIdx !== -1) {
    return (
      <EditTransactionModal 
        tx={voiceReviewTxs[editingIdx]} 
        loginUser={currentUser?.name || "未知"} 
        onSave={(updatedTx) => { 
          const newTxs = [...(voiceReviewTxs || [])]; 
          delete updatedTx.isEditing; 
          newTxs[editingIdx] = updatedTx; 
          setVoiceReviewTxs(newTxs); 
        }} 
        onDelete={() => { setVoiceReviewTxs(prev => (prev || []).filter((_, i) => i !== editingIdx)); }} 
        onCancel={() => { 
          if(triggerVibration) triggerVibration(10); 
          const newTxs = [...(voiceReviewTxs || [])]; 
          delete newTxs[editingIdx].isEditing; 
          setVoiceReviewTxs(newTxs); 
        }} 
      />
    );
  }

  // 2. 總覽清單模式 (對齊歷史清單樣式)
  return (
    <div className="fixed inset-0 z-[1100] bg-gray-900/80 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 animate-in">
      <div className="bg-gray-50 w-full max-w-sm rounded-[2.5rem] p-5 sm:p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
        <h3 className="font-black text-xl mb-2 text-gray-800 flex items-center gap-2">
          <SvgIcon name="sparkles" size={24} className="text-blue-500" /> AI 解析結果確認
        </h3>
        <p className="text-[10px] text-gray-400 font-bold mb-4 bg-white p-2 rounded-lg border border-gray-100 uppercase tracking-widest text-center">
          請檢查明細，點擊右下角編輯圖示即可修正
        </p>

        <div className="flex-1 overflow-y-auto pr-1 scrollbar-hide mb-4 space-y-3">
          {(voiceReviewTxs || []).length === 0 ? (
            <div className="text-center text-gray-400 py-10 text-sm font-bold bg-white rounded-3xl border border-gray-100">已清空所有紀錄</div>
          ) : (
            (voiceReviewTxs || []).map((tx, idx) => (
              <div key={idx} className="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100">
                {/* 🚀 直接調用核心組件，保證與歷史清單視覺統一 */}
                <TransactionCard 
                  tx={tx} 
                  allowEdit={true} 
                  currentUser={currentUser}
                  triggerVibration={triggerVibration}
                  setEditingTx={() => {
                    if(triggerVibration) triggerVibration(10);
                    const newTxs = [...voiceReviewTxs];
                    const target = newTxs[idx];
                    // 補齊分類斜線邏輯
                    if (target.category && !target.category.includes('/')) {
                      if (target.category.includes('餐') || target.category.includes('食')) target.category = "食/其他";
                      else if (target.category.includes('衣')) target.category = "衣/其他";
                      else if (target.category.includes('行')) target.category = "行/其他";
                      else target.category = "雜項/其他";
                    }
                    target.isEditing = true;
                    if (!target.id) target.id = "temp_" + Date.now();
                    setVoiceReviewTxs(newTxs);
                  }}
                  pendingMap={{}}
                  auditLogs={[]}
                />
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2 pt-1 border-t border-gray-100 mt-1">
          <button onClick={() => setVoiceReviewTxs(null)} className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-2xl font-black text-[13px] active:scale-95 transition-all">
            取消退出
          </button>
          <button 
            onClick={handleConfirmVoice} 
            disabled={(voiceReviewTxs || []).length === 0} 
            className="flex-[2] py-3.5 bg-blue-600 text-white rounded-2xl font-black text-[15px] active:scale-95 transition-all shadow-xl shadow-blue-500/30 disabled:opacity-50"
          >
            確認並寫入 ({(voiceReviewTxs || []).length}筆)
          </button>
        </div>
      </div>
    </div>
  );
})()}
      
      {editingTx && ( <EditTransactionModal tx={editingTx} loginUser={currentUser?.name || "未知"} onSave={(tx) => handleUpdateTx(tx)} onDelete={(tx) => handleDeleteTx(tx)} onCancel={() => { if(triggerVibration) triggerVibration(10); setEditingTx(null); }} /> )}
      
      {editingGroup && ( 
        <EditGroupParentModal 
          group={editingGroup} 
          currentUser={currentUser} 
          onSave={(g, newSubs) => { handleUpdateGroupParent(g); if(newSubs && newSubs.length > 0) handleAdd(newSubs); }} 
          onDeleteGroup={(children) => { handleDeleteTx(children); setEditingGroup(null); }}
          onCancel={() => { if(triggerVibration) triggerVibration(10); setEditingGroup(null); }} 
        /> 
      )}
      
      {showChangePinModal && <ChangePinModal currentUser={currentUser} onCancel={() => setShowChangePinModal(false)} onSuccess={() => {setShowChangePinModal(false); setCurrentUser(null); setSelectingUser(null); setPinInput(""); showStatus("success", "✅ 密碼已更新，請重新登入");}} forceReloginForToken={forceReloginForToken} />}

      {showTrashModal && (
        <div className="fixed inset-0 z-[600] bg-gray-900/90 backdrop-blur-sm overflow-y-auto flex flex-col items-center justify-center p-4 sm:p-6 animate-in font-black" onClick={(e) => { if(e.target === e.currentTarget) setShowTrashModal(false); }}>
          <div className="bg-white w-full max-w-sm relative rounded-[2.5rem] shadow-2xl overflow-hidden pb-6 flex flex-col max-h-[85vh]">
            <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>
            <button onClick={() => setShowTrashModal(false)} className="absolute top-4 right-4 text-gray-400 active:scale-90"><SvgIcon name="close" size={24} /></button>
            <div className="px-6 pt-6 pb-2"><h2 className="text-xl font-black text-gray-800 flex items-center gap-2"><SvgIcon name="trash" size={20} className="text-red-500" /> 資源回收桶</h2></div>
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-2 space-y-4 custom-scrollbar">
              {processedTrash.length === 0 ? ( <div className="text-center text-gray-400 py-10 text-sm">回收桶是空的</div> ) : ( 
                processedTrash.map(item => {
                  if (item.isBatch) {
                    const isExp = !!expandedTrashGroups[item.id];
                    const allBens = new Set();
                    item.children.forEach(c => { if(c.beneficiary) String(c.beneficiary).split(",").filter(Boolean).forEach(b => allBens.add(b.trim())); });
                    const parentBenArray = getBenArray(Array.from(allBens).join(","), item.children[0]?.member || safeUserName);

                    return (
                      <div key={item.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col animate-in">
                        <div onClick={() => toggleTrashGroup(item.id)} className="p-4 flex items-start sm:items-center gap-3 cursor-pointer active:bg-gray-50 transition-colors relative">
                          <div className="relative shrink-0 mt-1 sm:mt-0">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-[17px] leading-none ${item.type==="income" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>{item.type==="income" ? "收入" : "支出"}</div>
                            <div className="absolute -bottom-1 -right-1 bg-gray-800 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md border-2 border-white shadow-sm z-10">多筆</div>
                          </div>
                          <div className="flex-1 min-w-0 pl-1 pt-1">
                            <div className="font-bold text-[14px] leading-tight text-gray-800 flex items-center gap-1.5 flex-wrap">
                              <span className="truncate flex-shrink">{item.title}</span>
                              <div className="flex gap-1 flex-wrap shrink-0">{parentBenArray.map(b => ( <span key={b} className={`text-[9px] px-1.5 py-0.5 rounded-md border font-black ${getBenBadgeStyle(b)}`}>{b}</span> ))}</div>
                              <span className={`text-[10px] text-gray-400 transform transition-transform duration-300 shrink-0 ${isExp ? 'rotate-180' : ''}`}>▼</span>
                            </div>
                            <div className="flex flex-col gap-1.5 mt-1.5 w-full items-start">
                              <div className="flex items-center gap-2 flex-wrap w-full">
                                <span className="text-[10px] text-gray-400 font-medium leading-none shrink-0">{displayDateClean(item.date)}</span>
                              </div>
                              <span className="text-[10px] font-black text-red-500 bg-red-50 px-2 py-1 rounded border border-red-100">已打包刪除 ({item.children.length}筆)</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end justify-center shrink-0 pl-1 z-10 mt-1 sm:mt-0 pb-2">
                            <div className={`font-black tabular-nums text-[17px] leading-none ${item.type==="income" ? "text-green-600" : "text-red-600"}`}>${Number(item.amount||0).toLocaleString()}</div>
                          </div>
                        </div>

                        {isExp && (
                          <div className="bg-gray-50/80 p-3 flex flex-col gap-2 border-t-2 border-gray-100 shadow-inner">
                             {item.children.map((child, idx) => {
                                const childBenArray = getBenArray(child.beneficiary, child.member);
                                return (
                                  <div key={child.id} className={`w-full flex items-center gap-2 sm:gap-3 bg-white p-2.5 sm:p-3 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden`}>
                                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gray-100 text-gray-400 text-[10px] font-black flex items-center justify-center shrink-0">{idx + 1}</div>
                                    <div className="flex-1 min-w-0 pr-2 border-r border-gray-100">
                                      <div className="font-bold text-xs sm:text-sm text-gray-800 flex items-center gap-1.5 flex-wrap leading-tight">
                                        <span className="truncate flex-shrink">{getParentCat(child.category)} - {getChildCat(child.category)}</span>
                                        <div className="flex gap-1 flex-wrap shrink-0">{childBenArray.map(b => ( <span key={b} className={`text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-md border font-black ${getBenBadgeStyle(b)}`}>{b}</span> ))}</div>
                                      </div>
                                      {child.desc && <div className="text-[10px] sm:text-[11px] text-gray-500 mt-0.5 whitespace-normal break-words">{child.desc}</div>}
                                    </div>
                                    <div className="flex flex-col items-end shrink-0 min-w-[3.5rem] text-right z-10 pb-1">
                                      <div className={`font-black tabular-nums text-xs sm:text-sm ${child.type==="income" ? "text-green-600" : "text-gray-600"}`}>${Number(child.amount||0).toLocaleString()}</div>
                                      {child.member !== safeUserName && ( <div className={`mt-1 text-[8px] font-black px-1 py-0.5 rounded-md border ${child.member === "爸爸" ? "bg-blue-50 text-blue-600 border-blue-200" : child.member === "媽媽" ? "bg-pink-50 text-pink-600 border-pink-200" : "bg-gray-50 text-gray-500 border-gray-200"} whitespace-nowrap`}>{child.member}的帳</div> )}
                                    </div>
                                  </div>
                                )
                             })}
                          </div>
                        )}

                        <div className="p-3 bg-white flex justify-end gap-2 border-t border-gray-100">
                          {confirmHardDeleteId === item.id ? ( <button onClick={() => handleHardDeleteTrash(item.children)} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-black active:scale-95 shadow-sm transition-all">確認永久刪除</button> ) : ( <button onClick={() => { if(triggerVibration) triggerVibration(10); setConfirmHardDeleteId(item.id); }} className="px-4 py-2 bg-white border border-gray-200 text-red-500 rounded-xl text-xs font-black active:scale-95 shadow-sm transition-all">永久刪除</button> )}
                          <button onClick={() => handleRestoreTrash(item.children)} className="px-4 py-2 bg-green-50 border border-green-200 text-green-600 rounded-xl text-xs font-black active:scale-95 shadow-sm flex items-center gap-1 transition-all"><SvgIcon name="refresh" size={14}/> 全部復原</button>
                        </div>
                      </div>
                    )
                  } else {
                    const tx = item;
                    return (
                      <div key={tx.id} className="bg-white p-4 rounded-3xl border border-gray-100 flex flex-col gap-3 shadow-sm relative overflow-hidden animate-in">
                        <div className="flex items-start sm:items-center gap-3">
                          <div className="relative shrink-0 mt-1 sm:mt-0">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-[17px] leading-none ${tx.type==="income" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>{tx.type==="income" ? "收入" : "支出"}</div>
                            {tx.member !== safeUserName && ( <div className={`absolute -top-2 -left-2 text-[10px] font-black px-1.5 py-0.5 rounded-lg border-2 border-white shadow-sm ${tx.member === "爸爸" ? "bg-blue-600" : tx.member === "媽媽" ? "bg-pink-600" : "bg-gray-500"} text-white z-10`}>{tx.member}</div> )}
                          </div>
                          <div className="flex-1 min-w-0 pl-1 pt-1">
                            <div className="font-bold text-[14px] leading-tight text-gray-800 flex items-center gap-1.5 flex-wrap">
                              <span className="truncate flex-shrink">{getParentCat(tx.category)} - {getChildCat(tx.category)}</span>
                              <div className="flex gap-1 flex-wrap shrink-0">{getBenArray(tx.beneficiary, tx.member).map(b => ( <span key={b} className={`text-[9px] px-1.5 py-0.5 rounded-md border font-black ${getBenBadgeStyle(b)}`}>{b}</span> ))}</div>
                            </div>
                            <div className="flex flex-col gap-1.5 mt-1.5 w-full items-start">
                              <span className="text-[10px] text-gray-400 font-medium leading-none shrink-0">{displayDateClean(tx.date)}</span>
                              {tx.desc && <div className="text-[11px] text-gray-600 font-bold bg-gray-50 px-2.5 py-1.5 rounded-lg break-words w-full border border-gray-100 shadow-sm leading-relaxed">{tx.desc}</div>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end justify-center shrink-0 pl-1 z-10 mt-1 sm:mt-0 pb-2">
                            <div className={`font-black tabular-nums text-[17px] leading-none ${tx.type==="income" ? "text-green-600" : "text-red-600"}`}>${Number(tx.amount||0).toLocaleString()}</div>
                            {tx.recorder && tx.recorder !== tx.member && ( <div className={`mt-2 text-[9px] font-black px-1.5 py-0.5 rounded-md border shadow-sm ${tx.recorder === "爸爸" ? "bg-blue-50 text-blue-600 border-blue-200" : tx.recorder === "媽媽" ? "bg-pink-50 text-pink-600 border-pink-200" : "bg-gray-50 text-gray-500 border-gray-200"} whitespace-nowrap shrink-0`}>✍️ {tx.recorder}代記</div> )}
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-1 border-t border-gray-50 pt-3">
                          {confirmHardDeleteId === tx.id ? ( <button onClick={() => handleHardDeleteTrash([tx])} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-black active:scale-95 shadow-sm transition-all">確認永久刪除</button> ) : ( <button onClick={() => { if(triggerVibration) triggerVibration(10); setConfirmHardDeleteId(tx.id); }} className="px-4 py-2 bg-white border border-gray-200 text-red-500 rounded-xl text-xs font-black active:scale-95 shadow-sm transition-all">永久刪除</button> )}
                          <button onClick={() => handleRestoreTrash([tx])} className="px-4 py-2 bg-green-50 border border-green-200 text-green-600 rounded-xl text-xs font-black active:scale-95 shadow-sm flex items-center gap-1 transition-all"><SvgIcon name="refresh" size={14}/> 復原</button>
                        </div>
                      </div>
                    )
                  }
                })
              )}
            </div>
            {processedTrash.length > 0 && ( <div className="px-6 mt-2 pt-3 border-t border-gray-100">{!showConfirmEmptyTrash ? ( <button onClick={() => { if(triggerVibration) triggerVibration(10); setShowConfirmEmptyTrash(true); }} className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-black text-xs active:scale-95 transition-all border border-red-100">全部清空 (無法復原)</button> ) : ( <div className="bg-red-50 p-3 rounded-xl flex flex-col gap-2 border border-red-200 animate-in"><span className="text-xs font-black text-red-600 text-center">確定要永久刪除所有紀錄嗎？</span><div className="flex gap-2"><button onClick={() => { if(triggerVibration) triggerVibration(10); setShowConfirmEmptyTrash(false); }} className="flex-1 py-2 bg-white text-gray-600 rounded-lg font-black text-[10px] border border-gray-200 active:scale-95">取消</button><button onClick={handleEmptyTrash} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-black text-[10px] shadow-sm shadow-red-500/30 active:scale-95">確定清空</button></div></div> )}</div> )}
          </div>
        </div>
      )}

      {viewingHistoryItem && (
        <div className="fixed inset-0 z-[700] bg-gray-900/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 animate-in font-black" onClick={(e) => { if(e.target === e.currentTarget) setViewingHistoryItem(null); }}>
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl relative flex flex-col max-h-[85vh]">
            <button onClick={() => setViewingHistoryItem(null)} className="absolute top-6 right-6 text-gray-400 active:scale-90 transition-transform"><SvgIcon name="close" size={24}/></button>
            <h3 className="font-black text-lg mb-1 text-gray-800 pr-8 leading-tight flex items-center gap-2">✏️ 編輯歷程</h3>
            <p className="text-[10px] text-gray-500 font-bold mb-4 bg-gray-100 px-2 py-1 rounded-md self-start">{viewingHistoryItem.isGroup ? viewingHistoryItem.parentTitle : `${getParentCat(viewingHistoryItem.category)} - ${getChildCat(viewingHistoryItem.category)}`}</p>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar pb-2">
              {(() => {
                let logs = viewingHistoryItem.editHistory ? [...viewingHistoryItem.editHistory].reverse() : [];
                
                if (logs.length === 0) return <div className="text-gray-400 text-sm text-center py-8">無編輯紀錄</div>;
                return logs.map((h, i) => {
                  const snapshot = h.snapshot;
                  return (
                    <div key={i} className="relative pb-4">
                      {i !== logs.length - 1 && (
                        <div className="absolute left-[0.375rem] top-6 bottom-[-0.5rem] flex flex-col items-center z-0 transform -translate-x-1/2">
                          <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-l-transparent border-r-transparent border-b-blue-300 -mb-[0.5px]"></div>
                          <div className="w-[2px] flex-1 bg-blue-100"></div>
                        </div>
                      )}
                      
                      <div className="relative z-10 flex items-center gap-2 mb-2.5 text-[11px] font-black text-gray-500">
                        <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_0_3px_#DBEAFE] shrink-0 mt-0.5"></div>
                        <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">{h.time}</span> 
                        <span>{h.recorder} 修改前</span>
                      </div>
                      
                      {snapshot && snapshot['金額'] !== undefined ? (
                        <div className="ml-5 bg-white p-3.5 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden flex items-start gap-3">
                          <div className="relative shrink-0 mt-0.5">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-[15px] leading-none ${viewingHistoryItem.type==="income" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>{viewingHistoryItem.type==="income" ? "收入" : "支出"}</div>
                            {snapshot['成員'] && snapshot['成員'] !== safeUserName && ( <div className={`absolute -top-2 -left-2 text-[9px] font-black px-1.5 py-0.5 rounded-lg border-2 border-white shadow-sm ${snapshot['成員'] === "爸爸" ? "bg-blue-600" : snapshot['成員'] === "媽媽" ? "bg-pink-600" : "bg-gray-500"} text-white z-10`}>{snapshot['成員']}</div> )}
                          </div>
                          
                          <div className="flex-1 min-w-0 pl-0.5">
                            <div className="font-bold text-[13px] leading-tight text-gray-800 flex items-center gap-1.5 flex-wrap">
                              <span className="truncate flex-shrink">{snapshot['類別']}</span>
                              <div className="flex gap-1 flex-wrap shrink-0">
                                 {snapshot['對象'] && getBenArray(snapshot['對象'], snapshot['成員']).map(b => ( <span key={b} className={`text-[8px] px-1.5 py-0.5 rounded-md border font-black ${getBenBadgeStyle(b)}`}>{b}</span> ))}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1 mt-1.5 w-full items-start">
                              <span className="text-[9px] text-gray-400 font-medium leading-none shrink-0">{snapshot['日期']}</span>
                              {snapshot['備註'] && <div className="text-[10px] text-gray-600 font-bold bg-gray-50 px-2 py-1 rounded-lg break-words w-full border border-gray-100 shadow-sm leading-relaxed">{snapshot['備註']}</div>}
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end justify-center shrink-0 z-10 pb-1">
                            <div className={`font-black tabular-nums text-[15px] leading-none ${viewingHistoryItem.type==="income" ? "text-green-600" : "text-red-600"}`}>${Number(snapshot['金額']).toLocaleString()}</div>
                          </div>
                        </div>
                      ) : ( 
                        <div className="ml-5 text-xs text-gray-400 italic bg-gray-50 p-3 rounded-2xl border border-gray-100">{snapshot ? snapshot['內容'] : '無詳細快照'}</div> 
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {analysisDetailData && (
        <div className="fixed inset-0 z-[600] bg-gray-900/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 animate-in text-left font-black" onClick={(e) => { if(e.target === e.currentTarget) setAnalysisDetailData(null); }}>
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl relative flex flex-col max-h-[85vh]">
            <button onClick={() => setAnalysisDetailData(null)} className="absolute top-6 right-6 text-gray-400 active:scale-90 transition-transform"><SvgIcon name="close" size={24}/></button>
            <h3 className="font-black text-lg mb-1 text-gray-800 pr-8 leading-tight">{analysisDetailData.title}</h3>
            <p className="text-[10px] text-gray-500 font-bold mb-4 bg-gray-100 px-2 py-1 rounded-md self-start">共 {(analysisDetailData.txs || []).length} 筆明細</p>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
              {(groupTransactions(analysisDetailData.txs || []) || []).sort((a,b) => parseDateForSort(b) - parseDateForSort(a) || String(b.id).localeCompare(String(a.id))).map(item => renderItemOrGroup(item, false))}
            </div>
          </div>
        </div>
      )}

      <Header currentUser={currentUser} customSubtitle={customSubtitle} handleSyncClick={handleSyncClick} isSyncing={isSyncing} syncQueue={syncQueue || []} isOnline={isOnline} />

      <main className="p-6 pb-32 flex-1 overflow-y-auto scrollbar-hide text-gray-800 flex flex-col relative">
        <ErrorBoundary>
          {activeTab === "dashboard" && (
            <div className="space-y-6 animate-in">
              <DashboardSummary stats={stats} />
              <div className="space-y-4 text-left"><h3 className="font-black text-lg px-1 text-gray-800">最新動態</h3><div className="space-y-3">{(allGroupedAndSorted || []).slice(0, 5).map(item => renderItemOrGroup(item, false))}</div></div>
            </div>
          )}
          {activeTab === "history" && ( <HistoryTab setQuickDateFilter={setQuickDateFilter} historyDateFilter={historyDateFilter} setHistoryDateFilter={setHistoryDateFilter} setHistorySearch={setHistorySearch} setHistoryExcludeSearch={setHistoryExcludeSearch} setHistoryTypeFilter={setHistoryTypeFilter} historySearch={historySearch} historyExcludeSearch={historyExcludeSearch} triggerVibration={triggerVibration} setShowTrashModal={setShowTrashModal} setConfirmHardDeleteId={setConfirmHardDeleteId} setShowConfirmEmptyTrash={setShowConfirmEmptyTrash} showSearchFilterModal={showSearchFilterModal} setShowSearchFilterModal={setShowSearchFilterModal} debouncedHistorySearch={debouncedHistorySearch} debouncedHistoryExcludeSearch={debouncedHistoryExcludeSearch} historyTypeFilter={historyTypeFilter} isHistoryFiltered={isHistoryFiltered} historyFilteredStats={historyFilteredStats} filteredHistoryGroups={filteredHistoryGroups || []} renderItemOrGroup={renderItemOrGroup} /> )}
          {activeTab === "analysis" && ( <AnalysisTab analysisDateFilter={analysisDateFilter} setAnalysisDateFilter={setAnalysisDateFilter} setSelectedAnalysisLevel1={setSelectedAnalysisLevel1} setSelectedAnalysisLevel2={setSelectedAnalysisLevel2} analysisCustomStart={analysisCustomStart} setAnalysisCustomStart={setAnalysisCustomStart} analysisCustomEnd={analysisCustomEnd} setAnalysisCustomEnd={setAnalysisCustomEnd} analysisType={analysisType} setAnalysisType={setAnalysisType} aiEvalData={aiEvalData} currentUser={currentUser} isAIEvaluating={isAIEvaluating} handleForceAIEval={handleForceAIEval} myTransactions={myTransactions || []} billingStartDay={billingStartDay} pendingMap={{}} selectedAnalysisLevel1={selectedAnalysisLevel1} setAnalysisDetailData={setAnalysisDetailData} animTrigger={animTrigger} triggerVibration={triggerVibration} renderItemOrGroup={renderItemOrGroup} snapshotsCache={snapshotsCache} /> )}
          {activeTab === "add" && ( <AddTransactionForm loginUser={currentUser?.name || "未知"} onSubmit={(tx) => handleAdd(tx)} onClose={() => setActiveTab('dashboard')} onImageRecordStop={handleImageRecordStop} isAIEvaluating={isAIEvaluating || loadingCard.show} /> )}
          {activeTab === "settings" && ( <SettingsTab handleForceAIEval={handleForceAIEval} txCache={visibleTransactions} isAIEvaluating={isAIEvaluating} isSyncing={isSyncing} triggerVibration={triggerVibration} billingStartDay={billingStartDay} setBillingStartDay={setBillingStartDay} currentCycleRange={currentCycleRange} customSubtitle={customSubtitle} setCustomSubtitle={setCustomSubtitle} handleSaveGreeting={handleSaveGreeting} currentUser={currentUser} setShowChangePinModal={setShowChangePinModal} bioBound={bioBound} setUnbindPin={setUnbindPin} setShowUnbindModal={setShowUnbindModal} bindDeviceBio={bindDeviceBio} setShowClearCacheModal={setShowClearCacheModal} setCurrentUser={setCurrentUser} setSelectingUser={setSelectingUser} setPinInput={setPinInput} setActiveTab={setActiveTab} syncQueue={syncQueue || []} setShowClearQueueModal={setShowClearQueueModal} isLogOpen={isLogOpen} setIsLogOpen={setIsLogOpen} /> )}
        </ErrorBoundary>
      </main>

      <BottomNav key={`nav-${navKey}`} activeTab={activeTab} setActiveTab={setActiveTab} triggerVibration={triggerVibration} onQuickAdd={handleQuickAdd} loginUser={currentUser?.name || "未知"} onVoiceRecordStop={handleVoiceRecordStop} />
      {ToastUI}
    </div>
  );
}

export default App;