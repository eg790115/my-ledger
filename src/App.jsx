import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Virtuoso } from 'react-virtuoso';

import { APP_VERSION, STORE_NAME, LS, CHART_COLORS } from './utils/constants';
import { initIndexedDB, saveToIndexedDB, loadFromIndexedDB, getParentCat, getChildCat, getBenArray, getBenBadgeStyle, safeParse, safeArrayLS, safeStringLS, safeNumberLS, nowStr, displayDateClean, formatDateOnly, parseDateForSort } from './utils/helpers';
import { gasUrl, postGAS, getDeviceToken, deviceValid, setDeviceToken, clearDeviceToken, getBioKey, isDeviceBioBound, getBioFailCount, setBioFailCount, getBioLockedUntil, setBioLockedUntil, clearBioFail, verifyPinOnline, saveLocalPinHash, unlockWithPinLocal } from './utils/api';

import BottomNav from './components/BottomNav';
import Header from './components/Header';
import DashboardSummary from './components/DashboardSummary';
import LoginUI from './components/LoginUI';
import HistoryTab from './components/HistoryTab';
import AnalysisTab from './components/AnalysisTab';
import SettingsTab from './components/SettingsTab';

import { SvgIcon } from './components/Icons';
import { ProxyNotification } from './components/ProxyNotification';
import { ChangePinModal } from './components/ChangePinModal';
import { AddTransactionForm } from './components/AddTransactionForm';
import { EditTransactionModal } from './components/EditTransactionModal';
import { EditGroupParentModal } from './components/EditGroupParentModal';

const triggerVibration = (pattern) => { 
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) { 
    try { window.navigator.vibrate(pattern); } catch (e) {} 
  } 
};

const getSafeCycleRange = (now, startDay, monthOffset = 0) => {
  const bDay = Number(startDay) || 1;
  let start = new Date(now.getFullYear(), now.getMonth(), bDay, 0, 0, 0);
  if (now.getDate() < bDay) start.setMonth(start.getMonth() - 1);
  start.setMonth(start.getMonth() + monthOffset);
  let end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(end.getDate() - 1);
  end.setHours(23, 59, 59, 999);
  return { start: start.getTime(), end: end.getTime() };
};

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [familyConfig, setFamilyConfig] = useState(() => safeArrayLS(LS.members).length ? safeArrayLS(LS.members) : [{ name: "爸爸", color: "bg-blue-600" }, { name: "媽媽", color: "bg-pink-600" }]);
  const [customSubtitle, setCustomSubtitle] = useState("{name}，你好！");
  const [greetingsCache, setGreetingsCache] = useState(() => { try { return JSON.parse(localStorage.getItem(LS.greetingsCache)) || {}; } catch { return {}; } });
  const [billingStartDay, setBillingStartDay] = useState(() => safeNumberLS(LS.billingStartDay, 1));
  const [currentUser, setCurrentUser] = useState(null);
  const [selectingUser, setSelectingUser] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [fallbackToPin, setFallbackToPin] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: "", text: "" });
  const [showClearCacheModal, setShowClearCacheModal] = useState(false);
  const [cacheClearPassword, setCacheClearPassword] = useState("");
  const [showClearQueueModal, setShowClearQueueModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loadingCard, setLoadingCard] = useState({ show: false, text: "" });
  const isLoading = loadingCard.show;
  const [lastSyncText, setLastSyncText] = useState(() => safeStringLS(LS.lastSync, "----/--/-- --:--"));
  const [lastServerTime, setLastServerTime] = useState(() => safeNumberLS('last_server_time_v1', 0));
  
  const [txCache, setTxCache] = useState([]);
  const [trashCache, setTrashCache] = useState([]);
  const [syncQueue, setSyncQueue] = useState(() => safeArrayLS(LS.pending));
  
  // 🌟 新增：冷熱分離的快照快取倉庫
  const [snapshotsCache, setSnapshotsCache] = useState(() => { try { return JSON.parse(localStorage.getItem('snapshots_cache')) || {}; } catch { return {}; } });

  const [aiEvalData, setAiEvalData] = useState(() => { try { return JSON.parse(localStorage.getItem('ai_eval_data')) || null; } catch { return null; } });
  const [isAIEvaluating, setIsAIEvaluating] = useState(false);
  const [sysConfig, setSysConfig] = useState(() => { try { return JSON.parse(localStorage.getItem('sys_config')) || { apiKey: "", prompt: "" }; } catch { return { apiKey: "", prompt: "" }; } });

  const [editingTx, setEditingTx] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [viewingHistoryItem, setViewingHistoryItem] = useState(null);
  const [analysisDetailData, setAnalysisDetailData] = useState(null);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [confirmHardDeleteId, setConfirmHardDeleteId] = useState(null);
  const [showConfirmEmptyTrash, setShowConfirmEmptyTrash] = useState(false);
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
  const [showBootstrapModal, setShowBootstrapModal] = useState(false);
  const [bootstrapSecret, setBootstrapSecret] = useState("");
  const [showUnbindModal, setShowUnbindModal] = useState(false);
  const [unbindPin, setUnbindPin] = useState("");
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [unackedProxyTxs, setUnackedProxyTxs] = useState([]);

  const pollingTimerRef = useRef(null); 
  const syncDebounceRef = useRef(null); 
  const isSyncingRef = useRef(false);
  const txCacheRef = useRef(txCache); 
  const trashCacheRef = useRef(trashCache); 
  const currentUserRef = useRef(currentUser); 
  const lastServerTimeRef = useRef(lastServerTime);

  useEffect(() => { txCacheRef.current = txCache; }, [txCache]); 
  useEffect(() => { trashCacheRef.current = trashCache; }, [trashCache]); 
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]); 
  useEffect(() => { lastServerTimeRef.current = lastServerTime; }, [lastServerTime]);
  useEffect(() => localStorage.setItem('ai_eval_data', JSON.stringify(aiEvalData || {})), [aiEvalData]);
  useEffect(() => localStorage.setItem('sys_config', JSON.stringify(sysConfig || {})), [sysConfig]);

  const showStatus = useCallback((type, text) => { 
    if (type === "success") triggerVibration([20, 50, 20]); 
    else if (type === "error") triggerVibration([50, 50, 50, 50, 50]); 
    else if (type === "info") triggerVibration(15);
    setStatusMsg({ type, text }); 
    setTimeout(() => setStatusMsg({ type: "", text: "" }), 3000); 
  }, []);
  
  const forceReloginForToken = useCallback(() => { 
    clearDeviceToken(); setCurrentUser(null); setSelectingUser(null); setPinInput(""); setBootstrapSecret(""); setShowBootstrapModal(true); 
  }, []);
  
  const bioBound = currentUser ? isDeviceBioBound(currentUser.name) : false;

  useEffect(() => {
    if (pinInput.length === 6 && selectingUser) {
      const verifyEnteredPin = async () => {
        const n = pinInput;
        try {
          if (isOnline) {
            if (!deviceValid()) { showStatus("error", "雲端尚未綁定，請先輸入雲端密碼"); setShowBootstrapModal(true); setPinInput(""); return; }
            setLoadingCard({ show:true, text:"正在連線雲端驗證..." }); 
            await verifyPinOnline(selectingUser.name, n); 
            await saveLocalPinHash(selectingUser.name, n); 
            setLoadingCard({ show:false, text:"" });
            setCurrentUser(selectingUser); setSelectingUser(null); setPinInput(""); setFallbackToPin(false); triggerVibration([20, 50, 20]); showStatus("success", "✅ 登入成功");
          } else {
            const ok = await unlockWithPinLocal(selectingUser.name, n);
            if (!ok) { showStatus("error", "PIN 錯誤，或您尚未在有網路時登入過"); setPinInput(""); return; }
            setCurrentUser(selectingUser); setSelectingUser(null); setPinInput(""); setFallbackToPin(false); triggerVibration([20, 50, 20]); showStatus("success", "✅ 登入成功 (離線)");
          }
        } catch (e) { 
          setLoadingCard({ show:false, text:"" }); 
          const msg = e.message || String(e); 
          if (msg.includes("憑證") || msg.includes("過期")) { showStatus("error", "❌ 雲端憑證無效，請重新綁定"); forceReloginForToken(); } else { showStatus("error", msg); setPinInput(""); } 
        }
      }; 
      verifyEnteredPin();
    }
  }, [pinInput, selectingUser, isOnline, forceReloginForToken, showStatus]);

  const handleBioLoginLocal = async (name) => {
    const lockedUntil = getBioLockedUntil(name); 
    if (lockedUntil && Date.now() < lockedUntil) { showStatus("error", `請稍候 ${Math.ceil((lockedUntil - Date.now())/1000)}s 再試`); return false; }
    try {
      const base64Id = localStorage.getItem(getBioKey(name)); if (!base64Id) { showStatus("error","設備未綁定"); return false; }
      const idStr = atob(base64Id); const idArray = new Uint8Array(idStr.length); 
      for (let i=0; i<idStr.length; i++) idArray[i] = idStr.charCodeAt(i); 
      const challenge = new Uint8Array(32); window.crypto.getRandomValues(challenge);
      await navigator.credentials.get({ publicKey: { challenge, allowCredentials: [{ type:"public-key", id:idArray }], userVerification: "required" } }); 
      clearBioFail(name); return true;
    } catch (e) {
      const fail = getBioFailCount(name) + 1; setBioFailCount(name, fail); const left = Math.max(0, 5 - fail); 
      if (left <= 0) { setBioLockedUntil(name, Date.now() + 30000); showStatus("error", `驗證失敗，已暫停 30 秒`); } 
      else { setBioLockedUntil(name, Date.now() + 30000); showStatus("error", `驗證失敗，剩餘 ${left} 次`); } 
      return false;
    }
  };

  const handleUserClick = async (user) => {
    triggerVibration(15); setSelectingUser(user); setPinInput(""); setFallbackToPin(false);
    if (biometricAvailable && isDeviceBioBound(user.name)) { 
      const ok = await handleBioLoginLocal(user.name); 
      if (ok) { triggerVibration([20, 50, 20]); showStatus("success", "✅ 登入成功"); setCurrentUser(user); setSelectingUser(null); setPinInput(""); } 
      else { setFallbackToPin(true); } 
    }
  };

  const bindDeviceBio = async () => {
    if (!window.PublicKeyCredential) { showStatus("error","不支援生物辨識"); return; }
    try {
      setLoadingCard({ show:true, text:"正在綁定設備..." }); 
      const challenge = new Uint8Array(32); crypto.getRandomValues(challenge); 
      const userID = new Uint8Array(16); crypto.getRandomValues(userID);
      const cred = await navigator.credentials.create({ publicKey: { challenge, rp: { name:"家庭記帳" }, user: { id:userID, name: currentUser.name, displayName: currentUser.name }, pubKeyCredParams: [{ type:"public-key", alg:-7 }, { type:"public-key", alg:-257 }], authenticatorSelection: { authenticatorAttachment:"platform", userVerification:"required" }, timeout: 60000 } });
      localStorage.setItem(getBioKey(currentUser.name), btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(cred.rawId))))); 
      clearBioFail(currentUser.name); showStatus("success","✅ 設備已綁定");
    } catch { showStatus("error","綁定失敗或已取消"); } 
    finally { setLoadingCard({ show:false, text:"" }); }
  };

  const unbindDeviceBio = async () => {
    if (unbindPin.length !== 6) { showStatus("error","請輸入 6 位 PIN"); return; } 
    if (!isOnline) { showStatus("error","需連線驗證 PIN 才能解除"); return; } 
    if (!deviceValid()) { showStatus("error","雲端憑證已過期，請先綁定雲端"); return; }
    try { 
      setLoadingCard({ show:true, text:"正在驗證..." }); 
      await verifyPinOnline(currentUser.name, unbindPin); 
      localStorage.removeItem(getBioKey(currentUser.name)); clearBioFail(currentUser.name); 
      setShowUnbindModal(false); setUnbindPin(""); showStatus("success","✅ 已解除綁定"); 
    } catch (e) { 
      setLoadingCard({ show:false, text:"" }); const msg = e.message || "PIN 錯誤"; 
      if (msg.includes("憑證") || msg.includes("過期")) { showStatus("error", "❌ 雲端憑證無效，請重新綁定"); forceReloginForToken(); } else { showStatus("error", msg); } 
    } finally { setLoadingCard({ show:false, text:"" }); }
  };

  useEffect(() => { if (activeTab === "analysis") { setAnimTrigger(false); const timer = setTimeout(() => setAnimTrigger(true), 50); return () => clearTimeout(timer); } }, [activeTab, analysisType, analysisDateFilter]);
  
  useEffect(() => {
    const handleNetworkChange = () => setIsOnline(navigator.onLine); 
    window.addEventListener('online', handleNetworkChange); 
    window.addEventListener('offline', handleNetworkChange); 
    window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') handleNetworkChange(); }); 
    window.addEventListener('focus', handleNetworkChange);
    return () => { window.removeEventListener('online', handleNetworkChange); window.removeEventListener('offline', handleNetworkChange); window.removeEventListener('visibilitychange', handleNetworkChange); window.removeEventListener('focus', handleNetworkChange); };
  }, []);

  const prevOnline = useRef(navigator.onLine);
  useEffect(() => { 
    if (prevOnline.current !== isOnline) { 
      if (isOnline) { showStatus("success", "🌐 網路已連線"); if (syncQueue.length > 0) requestSync(true, true); } 
      else { showStatus("info", "⚠️ 已進入離線模式 (變更將暫存手機)"); } 
      prevOnline.current = isOnline; 
    } 
  }, [isOnline, syncQueue]);

  useEffect(() => localStorage.setItem(LS.pending, JSON.stringify(syncQueue || [])), [syncQueue]); 
  useEffect(() => localStorage.setItem(LS.members, JSON.stringify(familyConfig || [])), [familyConfig]); 
  useEffect(() => localStorage.setItem(LS.lastSync, lastSyncText), [lastSyncText]); 
  useEffect(() => localStorage.setItem(LS.greetingsCache, JSON.stringify(greetingsCache || {})), [greetingsCache]);
  
  useEffect(() => { 
    loadFromIndexedDB(STORE_NAME).then(data => { if (data && data.length > 0) setTxCache(data); }); 
    loadFromIndexedDB("trash_store").then(data => { if (data && data.length > 0) setTrashCache(data); }); 
  }, []);
  
  useEffect(() => { if (currentUser && greetingsCache && greetingsCache[currentUser.name]) setCustomSubtitle(String(greetingsCache[currentUser.name])); else if (currentUser) setCustomSubtitle("{name}，你好！"); }, [currentUser, greetingsCache]);
  useEffect(() => { const timer = setTimeout(() => { setDebouncedHistorySearch(historySearch); setDebouncedHistoryExcludeSearch(historyExcludeSearch); }, 350); return () => clearTimeout(timer); }, [historySearch, historyExcludeSearch]);
  useEffect(() => { if (activeTab !== "analysis") { setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null); setAnalysisType("expense"); } }, [activeTab]); 
  useEffect(() => { setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null); }, [analysisType, analysisDateFilter, analysisCustomStart, analysisCustomEnd]); 
  useEffect(() => { setSelectedAnalysisLevel2(null); }, [selectedAnalysisLevel1]); 
  useEffect(() => { if (window.PublicKeyCredential) PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(v => setBiometricAvailable(v)); }, []);
  useEffect(() => { (async () => { try { const res = await fetch(gasUrl); const data = await res.json(); if (data.members && data.members.length) setFamilyConfig(data.members); } catch {} })(); }, []); 
  useEffect(() => { if (isOnline && !deviceValid()) { setShowBootstrapModal(true); setBootstrapSecret(""); } }, [isOnline]);

  useEffect(() => {
      if (!currentUser || txCache.length === 0) return;
      const acked = safeParse(localStorage.getItem(LS.ackProxyTxs), []); 
      const unacked = txCache.filter(tx => tx.member === currentUser.name && tx.recorder && tx.recorder !== currentUser.name && tx.recorder !== '系統' && !acked.includes(tx.id));
      const currentUnackedIds = unackedProxyTxs.map(t => t.id).sort().join(','); 
      const newUnackedIds = unacked.map(t => t.id).sort().join(','); 
      if (currentUnackedIds !== newUnackedIds) setUnackedProxyTxs(unacked);
  }, [currentUser, txCache, unackedProxyTxs]);

  const applyCloudData = useCallback((data, isDelta = false) => {
    let formatted = (data.transactions || []).map((t, i) => { 
      const rawDate = t["日期時間"] || t["日期"] || ""; 
      const cleanStr = String(rawDate).replace(/上午|下午|AM|PM/gi, "").trim().replace(/-/g, "/").replace("T", " "); 
      const ts = new Date(cleanStr).getTime() || 0; 
      return { 
        id: t.id || t["ID"] || String(i), amount: parseFloat(t["金額"]) || 0, category: String(t["類別"] || "其他"), 
        date: rawDate, timestamp: ts, member: String(t["成員"] || "未知"), recorder: String(t["記錄者"] || "系統"), 
        desc: String(t.desc || t["備註"] || ""), type: String(t.type || t["類型"] || "expense"), 
        groupId: String(t.groupId || t["GroupID"] || ""), parentDesc: String(t.parentDesc || t["ParentDesc"] || ""), 
        beneficiary: String(t.beneficiary || t["Beneficiary"] || t.member || t["成員"] || "未知"), 
        lastModified: Number(t.lastModified) || 0, editHistory: Array.isArray(t.editHistory) ? t.editHistory : (t["EditHistory"] || []) 
      }; 
    }).filter(t => t && t.id && t.id !== "undefined");
    
    let formattedTrash = (data.trash || []).map((t, i) => { 
      const rawDate = t["日期時間"] || t["日期"] || ""; 
      const cleanStr = String(rawDate).replace(/上午|下午|AM|PM/gi, "").trim().replace(/-/g, "/").replace("T", " "); 
      const ts = new Date(cleanStr).getTime() || 0; 
      return { 
        id: t.id || t["ID"] || String(i), amount: parseFloat(t["金額"]) || 0, category: String(t["類別"] || "其他"), 
        date: rawDate, timestamp: ts, member: String(t["成員"] || "未知"), recorder: String(t["記錄者"] || "系統"), 
        desc: String(t.desc || t["備註"] || ""), type: String(t.type || t["類型"] || "expense"), 
        groupId: String(t.groupId || t["GroupID"] || ""), parentDesc: String(t.parentDesc || t["ParentDesc"] || ""), 
        beneficiary: String(t.beneficiary || t["Beneficiary"] || t.member || t["成員"] || "未知"), 
        lastModified: Number(t.lastModified) || 0 
      }; 
    });

    let newTxCache, newTrashCache; let changed = false;
    if (isDelta) {
      const txMap = new Map((txCacheRef.current || []).map(t => [t.id, t])); 
      formatted.forEach(t => txMap.set(t.id, t)); 
      const trashIds = new Set(formattedTrash.map(t => t.id)); 
      newTxCache = Array.from(txMap.values()).filter(t => !trashIds.has(t.id)); 
      newTxCache.sort((a,b) => b.timestamp - a.timestamp || String(b.id).localeCompare(String(a.id)));
      
      const trashMap = new Map((trashCacheRef.current || []).map(t => [t.id, t])); 
      formattedTrash.forEach(t => trashMap.set(t.id, t)); 
      newTrashCache = Array.from(trashMap.values()).sort((a,b) => b.timestamp - a.timestamp || String(b.id).localeCompare(String(a.id)));
    } else { 
      newTxCache = formatted.sort((a,b) => b.timestamp - a.timestamp || String(b.id).localeCompare(String(a.id))); 
      newTrashCache = formattedTrash.sort((a,b) => b.timestamp - a.timestamp || String(b.id).localeCompare(String(a.id))); 
    }

    const oldStr = JSON.stringify(txCacheRef.current || []); 
    const newStr = JSON.stringify(newTxCache); 
    if (oldStr !== newStr) { setTxCache(newTxCache); saveToIndexedDB(STORE_NAME, newTxCache); localStorage.removeItem(LS.txCache); changed = true; }
    
    const oldTrashStr = JSON.stringify(trashCacheRef.current || []); 
    const newTrashStr = JSON.stringify(newTrashCache); 
    if (oldTrashStr !== newTrashStr) { setTrashCache(newTrashCache); saveToIndexedDB("trash_store", newTrashCache); localStorage.removeItem(LS.trashCache); changed = true; }
    
    if (data.serverTime) { setLastServerTime(data.serverTime); localStorage.setItem('last_server_time_v1', data.serverTime); }
    setLastSyncText(nowStr());
    
    if (data.greetings) setGreetingsCache(data.greetings);
    if (data.aiData) setAiEvalData(data.aiData);
    if (data.sysConfig) setSysConfig(data.sysConfig);

    // 🌟 核心：接收雲端送來的歷史快照並存進 localStorage
    if (data.snapshots) {
      setSnapshotsCache(data.snapshots);
      localStorage.setItem('snapshots_cache', JSON.stringify(data.snapshots));
    }
    
    return changed;
  }, []);

  const silentPollEngine = useCallback(async () => {
      if (!navigator.onLine || !currentUserRef.current || isSyncingRef.current) { pollingTimerRef.current = setTimeout(silentPollEngine, 5000); return; }
      if (!deviceValid()) { forceReloginForToken(); return; }
      try { 
        // 🌟 核心：加上 enableArchiving 參數，啟動雲端的冷熱分離
        const data = await postGAS({ action:"GET_TX", deviceToken: getDeviceToken(), lastSyncTime: lastServerTimeRef.current, enableArchiving: true }); 
        if (data.result === "success") { 
          const isDelta = lastServerTimeRef.current > 0; 
          if (applyCloudData(data, isDelta)) showStatus("success", "🔄 已載入雲端最新資料"); 
        } 
      } catch (e) { 
        if (e.message && (e.message.includes("憑證") || e.message.includes("過期"))) forceReloginForToken(); 
      }
      pollingTimerRef.current = setTimeout(silentPollEngine, 5000);
  }, [forceReloginForToken, applyCloudData, showStatus]);

  const syncManager = useCallback(async (isSilent = false) => {
      if (!navigator.onLine || !deviceValid() || isSyncingRef.current) return;
      isSyncingRef.current = true; if (!isSilent) setIsSyncing(true);
      try {
          const currentQueue = safeParse(localStorage.getItem(LS.pending), []).filter(Boolean); 
          let sentQueueCount = currentQueue.length; 
          const isDelta = lastServerTimeRef.current > 0;
          if (sentQueueCount > 0) {
              const res = await postGAS({ action: "BATCH_PROCESS", operations: currentQueue, deviceToken: getDeviceToken(), lastSyncTime: lastServerTimeRef.current, enableArchiving: true });
              if (res.result !== "success") throw new Error(res.message || "批次同步處理失敗");
              if (res.transactions) applyCloudData(res, isDelta);
              setSyncQueue(prev => { 
                const sentOpIds = currentQueue.map(q => q.opId).filter(Boolean); 
                const nextQ = prev.filter(Boolean).filter(p => p.opId ? !sentOpIds.includes(p.opId) : !currentQueue.find(c => (c.id === p.id && c.action === p.action) || (c.groupId && c.groupId === p.groupId && c.action === p.action))); 
                localStorage.setItem(LS.pending, JSON.stringify(nextQ)); return nextQ; 
              });
              if (res.conflicts && res.conflicts.length > 0) { showStatus("error", `⚠️ 發現 ${res.conflicts.length} 筆資料衝突，已為您捨棄本機覆蓋並保留雲端最新版！`); } 
              else if (!isSilent) { 
                const adds = currentQueue.filter(q => q.action === 'ADD').length; 
                const upds = currentQueue.filter(q => q.action.includes('UPDATE')).length; 
                const dels = currentQueue.filter(q => q.action.includes('DELETE')).length; 
                let txt = []; 
                if (adds) txt.push(`新增 ${adds} 筆`); 
                if (upds) txt.push(`修改 ${upds} 筆`); 
                if (dels) txt.push(`刪除 ${dels} 筆`); 
                if (sentQueueCount > 1) showStatus("success", `☁️ 雲端同步完成 (${txt.join('、')})`); else showStatus("success", adds > 0 ? "✅ 已同步至雲端" : upds > 0 ? "✅ 更新已同步" : "🗑️ 操作已完成"); 
              }
          } else {
              const res = await postGAS({ action: "GET_TX", deviceToken: getDeviceToken(), lastSyncTime: lastServerTimeRef.current, enableArchiving: true });
              if (res.result !== "success") throw new Error(res.message || "拉取失敗");
              if (res.transactions) { applyCloudData(res, isDelta); if (isSilent) showStatus("success", "🔄 已載入雲端最新資料"); else showStatus("success", "✅ 已是最新資料"); }
          }
      } catch (e) { 
        const msg = e.message || "未知錯誤"; 
        if (msg.includes("憑證") || msg.includes("過期")) forceReloginForToken(); else showStatus("error", `❌ 同步失敗: ${msg}`); 
      } finally { 
        isSyncingRef.current = false; setIsSyncing(false); 
        const leftoverQueue = safeParse(localStorage.getItem(LS.pending), []); 
        if (leftoverQueue.length > 0 && navigator.onLine) setTimeout(() => requestSync(true, true), 100); 
      }
  }, [forceReloginForToken, applyCloudData, showStatus]);

  const requestSync = useCallback((isSilent = false, immediate = false) => { 
    if (!navigator.onLine) return; 
    if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current); 
    if (immediate) syncManager(isSilent); else syncDebounceRef.current = setTimeout(() => syncManager(isSilent), 1000); 
  }, [syncManager]);
  
  const processRef = useRef(requestSync); 
  useEffect(() => { processRef.current = requestSync; }, [requestSync]);
  
  useEffect(() => { 
    if (isOnline && currentUser) { 
      const currentQ = safeParse(localStorage.getItem(LS.pending), []); 
      if (currentQ.length === 0) silentPollEngine(); 
      else { if (processRef.current) processRef.current(true, true); pollingTimerRef.current = setTimeout(silentPollEngine, 5000); } 
    } 
    return () => { if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current); }; 
  }, [isOnline, currentUser, silentPollEngine]); 

  const handleSyncClick = () => { triggerVibration(15); requestSync(false, true); };
  const refreshDeviceToken = async () => { const data = await postGAS({ action: "DEVICE_REFRESH", deviceToken: getDeviceToken() }); if (data.result !== "success") throw new Error(data.message || "憑證已過期"); setDeviceToken(data.deviceToken, data.deviceExp); return data; };
  const bootstrapDevice = async () => { if (!bootstrapSecret) throw new Error("請輸入雲端密碼"); const data = await postGAS({ action: "DEVICE_BOOTSTRAP", appSecret: bootstrapSecret }); if (data.result !== "success") throw new Error(data.message || "綁定失敗"); setDeviceToken(data.deviceToken, data.deviceExp); return data; };

  const handleSaveGreeting = async () => { 
    if (!isOnline || !deviceValid()) { showStatus("error", "需連線才能儲存問候語"); return; } 
    try { 
      setLoadingCard({ show:true, text:"正在儲存..." }); await refreshDeviceToken(); 
      const res = await postGAS({ action: "UPDATE_GREETING", name: currentUser.name, greeting: customSubtitle, deviceToken: getDeviceToken() }); 
      if (res.result !== "success") throw new Error(res.message); 
      setGreetingsCache(prev => ({...prev, [currentUser.name]: customSubtitle})); showStatus("success", "✅ 問候語已更新"); 
    } catch (e) { 
      setLoadingCard({ show:false, text:"" }); const msg = e.message || "儲存失敗"; 
      if (msg.includes("憑證") || msg.includes("過期")) { showStatus("error", "❌ 雲端憑證無效，請重新綁定"); forceReloginForToken(); } else { showStatus("error", msg); } 
    } finally { setLoadingCard({ show:false, text:"" }); } 
  };


  const executeFrontendAI = async (isManual = false) => {
    if (!sysConfig.apiKey || sysConfig.apiKey.includes('請在此填入')) {
      if (isManual) showStatus("error", "尚未設定 API Key");
      return;
    }
    
    setIsAIEvaluating(true);
    if (isManual) showStatus("info", "🤖 正在連線 AI 分析...");

    try {
      const cutoffTime = Date.now() - (180 * 24 * 60 * 60 * 1000); 
      let dadStr = ""; let momStr = "";
      
      txCache.forEach(tx => {
        const ts = parseDateForSort(tx);
        if (ts > cutoffTime) {
          const line = `日期:${displayDateClean(tx.date).substring(0,5)} | 類型:${tx.type==='income'?'收入':'支出'} | 項目:${tx.category} | 金額:$${tx.amount} | 對象:${tx.beneficiary || tx.member} | 備註:${tx.desc || '無'}\n`;
          if (tx.member === "爸爸") dadStr += line;
          else if (tx.member === "媽媽" || tx.member === "妈妈") momStr += line;
        }
      });

      const promptTemplate = sysConfig.prompt || "你是一位專業的家庭理財教練。請針對以下帳單給予財務建議。";

      const finalPrompt = `
${promptTemplate}

【以下為帳本資料 (包含近半年歷史供對照，請只點評近 30 天)】：
爸爸資料：
${dadStr}

媽媽資料：
${momStr}
`;

      const reqBody = {
        contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      };

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${sysConfig.apiKey}`, {
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify(reqBody)
      });
      
      const jsonRes = await response.json();

      if (jsonRes.error) throw new Error(jsonRes.error.message);
      if (!jsonRes.candidates || jsonRes.candidates.length === 0) throw new Error("AI 沒有回傳內容或 API 暫時無回應");

      const aiText = jsonRes.candidates[0].content.parts[0].text;
      
      const match = aiText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("AI 回傳格式錯誤 (非 JSON)");
      
      const parsedResult = JSON.parse(match[0]);
      
      const todayStr = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
      parsedResult.lastUpdated = `${todayStr} ${new Date().toLocaleTimeString('zh-TW', { hour12: false })}`;
      
      setAiEvalData(parsedResult);
      postGAS({ action: "SAVE_AI_RESULT", aiData: parsedResult, deviceToken: getDeviceToken() }).catch(()=>{});
      
      if (isManual) showStatus("success", "✨ AI 分析完成！");

    } catch (e) {
      if (isManual) showStatus("error", `❌ AI 錯誤: ${e.message}`);
    } finally {
      setIsAIEvaluating(false);
    }
  };

  const handleForceAIEval = () => executeFrontendAI(true);

  const hasTriggeredAutoAI = useRef(false);
  useEffect(() => {
    if (currentUser && isOnline && txCache.length > 0 && sysConfig.apiKey && !hasTriggeredAutoAI.current && deviceValid()) {
      
      const checkTimer = setTimeout(() => {
        hasTriggeredAutoAI.current = true;
        let shouldTrigger = false;
        
        if (!aiEvalData || !aiEvalData.lastUpdated) {
          shouldTrigger = true; 
        } else {
          const todayStr = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
          const lastEvalDateStr = aiEvalData.lastUpdated.split(' ')[0]; 

          if (lastEvalDateStr !== todayStr) {
            const lastTimeMs = new Date(aiEvalData.lastUpdated.replace(/-/g, "/")).getTime();
            const latestTxTime = txCache.reduce((max, tx) => Math.max(max, tx.lastModified || tx.timestamp || 0), 0);

            if (latestTxTime > lastTimeMs) {
              shouldTrigger = true;
            }
          }
        }
        
        if (shouldTrigger) {
          executeFrontendAI(false);
        }
      }, 5000);

      return () => clearTimeout(checkTimer);
    }
  }, [currentUser, isOnline, txCache, sysConfig, aiEvalData]);

  const visibleTransactions = useMemo(() => {
    if (!currentUser) return []; 
    let base = [...(txCache || [])].filter(t => t && t.id); 
    const combinedQueue = [...(syncQueue || [])].filter(Boolean); 
    base = base.filter(t => !combinedQueue.some(q => String(q.id) === String(t.id) && (q.action === 'DELETE_TX' || q.action === 'HARD_DELETE_TX'))); 
    base = base.map(t => { 
      let mod = { ...t }; 
      const pendingGUpdate = combinedQueue.find(q => String(q.groupId) === String(t.groupId) && q.action === 'UPDATE_GROUP_PARENT'); 
      if (pendingGUpdate) { mod.date = pendingGUpdate.date; mod.parentDesc = pendingGUpdate.parentDesc; } 
      const pendingUpdate = combinedQueue.find(q => String(q.id) === String(t.id) && q.action === 'UPDATE_TX'); 
      if (pendingUpdate) mod = { ...mod, ...pendingUpdate }; return mod; 
    }); 
    const baseIds = new Set(base.map(t => String(t.id))); 
    const pendingAdds = combinedQueue.filter(q => (q.action === 'ADD' || q.action === 'RESTORE_TX') && q.id && !baseIds.has(String(q.id))); 
    base = [...pendingAdds, ...base]; 
    return base.sort((a,b) => parseDateForSort(b) - parseDateForSort(a) || String(b.id).localeCompare(String(a.id)));
  }, [currentUser, txCache, syncQueue]);

  const visibleTrash = useMemo(() => {
      if (!currentUser) return []; 
      let base = [...(trashCache || [])].filter(t => t && t.id); 
      const combinedQueue = [...(syncQueue || [])].filter(Boolean); 
      base = base.filter(t => !combinedQueue.some(q => String(q.id) === String(t.id) && (q.action === 'HARD_DELETE_TX' || q.action === 'RESTORE_TX'))); 
      const pendingDeletes = combinedQueue.filter(q => q.action === 'DELETE_TX'); 
      base = [...pendingDeletes, ...base]; 
      return base.sort((a,b) => parseDateForSort(b) - parseDateForSort(a) || String(b.id).localeCompare(String(a.id)));
  }, [currentUser, trashCache, syncQueue]);

  const pendingMap = useMemo(() => { 
    const map = {}; 
    [...(syncQueue || [])].filter(Boolean).forEach(item => { 
      if (item.isOffline) { 
        if (item.id && item.action !== "UPDATE_GROUP_PARENT") map[item.id] = item.action; 
        if (item.groupId && item.action === "UPDATE_GROUP_PARENT") map[item.groupId] = item.action; 
      } 
    }); 
    return map; 
  }, [syncQueue]);
  
  const myTransactions = useMemo(() => { 
    if (!currentUser) return []; 
    return (visibleTransactions || []).filter(t => t.member === currentUser.name); 
  }, [visibleTransactions, currentUser]);

  const appendToQueueAndSync = (newItemList) => {
      let currentQ = [...(syncQueue || [])].filter(Boolean); 
      newItemList.forEach(newItem => { 
        const newOpId = Date.now() + '_' + Math.random().toString(36).substring(2, 9); 
        const idx = currentQ.findIndex(p => String(p.id) === String(newItem.id) && p.action !== "UPDATE_GROUP_PARENT"); 
        if (idx >= 0) { 
          if (currentQ[idx].action === "ADD" && newItem.action === "DELETE_TX") { 
            currentQ = currentQ.filter((_, i) => i !== idx); 
          } else { 
            currentQ[idx] = { ...newItem, action: currentQ[idx].action === 'ADD' ? 'ADD' : newItem.action, opId: newOpId }; 
          } 
        } else { 
          currentQ.push({ ...newItem, opId: newOpId }); 
        } 
      }); 
      setSyncQueue(currentQ); 
      localStorage.setItem(LS.pending, JSON.stringify(currentQ)); 
      if (!navigator.onLine) showStatus("info", `💾 已暫存於本機 (離線中)`); else requestSync(false, false); 
  };

  const handleAdd = async (newTxs) => { 
    triggerVibration([20, 40, 20]); 
    const baseDate = newTxs[0].date ? newTxs[0].date.replace("T"," ").replace(/-/g,"/") : nowStr(); 
    const baseTimestamp = Date.now(); const isMulti = newTxs.length > 1; const randomSuffix = () => Math.random().toString(36).substring(2, 8); 
    const groupId = isMulti ? `G_${baseTimestamp}_${currentUser.name}_${randomSuffix()}` : ""; const parentDesc = isMulti ? newTxs[0].parentDesc : ""; 
    const isOfflineOp = !navigator.onLine; 
    const completeTxs = newTxs.map((tx, idx) => ({ ...tx, date: baseDate, recorder: currentUser.name, id: `${baseTimestamp + idx}_${currentUser.name}_${randomSuffix()}`, groupId, parentDesc, isOffline: isOfflineOp, action: "ADD" })); 
    setActiveTab("dashboard"); appendToQueueAndSync(completeTxs); 
  };
  
  const handleUpdateTx = async (updatedTx) => { 
    triggerVibration([20, 40, 20]); 
    let fd = updatedTx.date; if (fd && fd.includes("T")) fd = fd.replace("T"," ").replace(/-/g,"/").slice(0, 16); 
    const newHist = [...(updatedTx.editHistory || []), { time: nowStr(), action: "編輯紀錄 (同步中)" }]; 
    appendToQueueAndSync([{ ...updatedTx, date: fd, editHistory: newHist, isOffline: !navigator.onLine, action: "UPDATE_TX", lastModified: updatedTx.lastModified || 0 }]); setEditingTx(null); 
  };
  
  const handleUpdateGroupParent = async (groupData) => { 
    triggerVibration([20, 40, 20]); 
    let fd = groupData.date; if (fd && fd.includes("T")) fd = fd.replace("T"," ").replace(/-/g,"/").slice(0, 16); 
    let currentQ = [...(syncQueue || [])].filter(Boolean); const newOpId = Date.now() + '_' + Math.random().toString(36).substring(2, 9); 
    const newHist = [...(groupData.editHistory || []), { time: nowStr(), action: "編輯紀錄 (同步中)" }]; 
    const newItem = { ...groupData, date: fd, editHistory: newHist, isOffline: !navigator.onLine, action: "UPDATE_GROUP_PARENT", opId: newOpId }; 
    const idx = currentQ.findIndex(p => p.action === "UPDATE_GROUP_PARENT" && String(p.groupId) === String(newItem.groupId)); 
    if (idx >= 0) { currentQ[idx] = newItem; } else { currentQ.push(newItem); } 
    setSyncQueue(currentQ); localStorage.setItem(LS.pending, JSON.stringify(currentQ)); setEditingGroup(null); 
    if (!navigator.onLine) showStatus("info", `💾 已暫存於本機 (離線中)`); else requestSync(false, false); 
  };
  
  const handleDeleteTx = async (id) => { 
    triggerVibration([30, 50, 30]); 
    const txToDelete = (visibleTransactions || []).find(t => String(t.id) === String(id)) || (txCache || []).find(t => String(t.id) === String(id)); 
    if (!txToDelete) return; 
    appendToQueueAndSync([{ ...txToDelete, isOffline: !navigator.onLine, action: "DELETE_TX", lastModified: txToDelete.lastModified || 0 }]); setEditingTx(null); 
  };
  
  const handleRestoreTrash = (tx) => { triggerVibration(15); const newOpId = Date.now() + '_' + Math.random().toString(36).substring(2, 9); appendToQueueAndSync([{ ...tx, isOffline: !navigator.onLine, action: "RESTORE_TX", opId: newOpId }]); showStatus("success", "🔄 已加入復原排程"); };
  const handleHardDeleteTrash = (tx) => { triggerVibration([30, 50, 30]); const newOpId = Date.now() + '_' + Math.random().toString(36).substring(2, 9); appendToQueueAndSync([{ ...tx, isOffline: !navigator.onLine, action: "HARD_DELETE_TX", opId: newOpId }]); setConfirmHardDeleteId(null); };
  const handleEmptyTrash = () => { triggerVibration([50, 50, 50]); const ops = visibleTrash.map(tx => ({ ...tx, isOffline: !navigator.onLine, action: "HARD_DELETE_TX", opId: Date.now() + '_' + Math.random().toString(36).substring(2, 9) })); appendToQueueAndSync(ops); setShowConfirmEmptyTrash(false); setShowTrashModal(false); showStatus("success", "🗑️ 已清空資源回收桶"); };

  const currentCycleRange = useMemo(() => { return getSafeCycleRange(new Date(), billingStartDay, 0); }, [billingStartDay]);

  const stats = useMemo(() => { 
    let income = 0; let expense = 0; 
    (myTransactions || []).forEach(t => { 
      if (pendingMap[t.id] === 'DELETE_TX' || pendingMap[t.id] === 'HARD_DELETE_TX') return; 
      const txTime = parseDateForSort(t); 
      if (txTime >= currentCycleRange.start && txTime <= currentCycleRange.end) { 
        if (t.type === "income") income += (Number(t.amount) || 0); 
        if (t.type === "expense") expense += (Number(t.amount) || 0); 
      } 
    }); 
    return { income, expense, balance: income - expense }; 
  }, [myTransactions, pendingMap, currentCycleRange]);

  const groupTransactions = (list) => { 
    const grouped = []; const groupMap = {}; 
    for (const tx of (list || [])) { 
      if (tx.groupId) { 
        if (!groupMap[tx.groupId]) { 
          const parts = String(tx.parentDesc || "").split("|||"); 
          groupMap[tx.groupId] = { 
            isGroup: true, groupId: tx.groupId, parentTitle: parts.length > 1 ? parts[0] : (parts[0] || "拆分紀錄"), 
            parentDesc: parts.length > 1 ? parts[1] : "", date: tx.date, timestamp: tx.timestamp, 
            member: tx.member, recorder: tx.recorder, type: tx.type, amount: 0, children: [], editHistory: tx.editHistory || [] 
          }; 
          grouped.push(groupMap[tx.groupId]); 
        } 
        groupMap[tx.groupId].children.push(tx); 
        if(pendingMap[tx.id] !== 'DELETE_TX' && pendingMap[tx.id] !== 'HARD_DELETE_TX') groupMap[tx.groupId].amount += Number(tx.amount || 0); 
      } else { 
        grouped.push({ ...tx, isGroup: false }); 
      } 
    } 
    return grouped; 
  };
  
  const allGroupedAndSorted = useMemo(() => { 
    return groupTransactions(visibleTransactions || []).sort((a, b) => { 
      const tA = parseDateForSort(a); const tB = parseDateForSort(b); 
      return tB - tA || String(b.isGroup ? b.children[0].id : b.id).localeCompare(String(a.isGroup ? a.children[0].id : a.id)); 
    }); 
  }, [visibleTransactions]);

  const filteredHistoryGroups = useMemo(() => {
    if (!currentUser) return []; 
    let list = (allGroupedAndSorted || []).filter(item => item.member === currentUser.name); 
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
    
    const searchTxt = debouncedHistorySearch.trim(); 
    const dateRangeRegex = /^(\d{4}\/\d{1,2}\/\d{1,2})\s*-\s*(\d{4}\/\d{1,2}\/\d{1,2})$/; 
    const match = searchTxt.match(dateRangeRegex); 
    
    if (match) { 
      const startTimestamp = new Date(`${match[1]} 00:00:00`).getTime(); 
      const endTimestamp = new Date(`${match[2]} 23:59:59`).getTime(); 
      if (!isNaN(startTimestamp) && !isNaN(endTimestamp)) { startTime = startTimestamp; endTime = endTimestamp; } 
    }
    
    if (startTime > 0 || endTime < Infinity) { 
      let filteredList = []; 
      for (const item of list) { 
        if (item.isGroup) { 
          const validChildren = (item.children || []).filter(child => { const txTime = parseDateForSort(child); return txTime >= startTime && txTime <= endTime; }); 
          if (validChildren.length > 0) { 
            let newAmount = 0; validChildren.forEach(c => { if(pendingMap[c.id] !== 'DELETE_TX' && pendingMap[c.id] !== 'HARD_DELETE_TX') newAmount += Number(c.amount || 0); }); 
            filteredList.push({ ...item, children: validChildren, amount: newAmount, date: validChildren[0].date }); 
          } 
        } else { 
          const txTime = parseDateForSort(item); 
          if (txTime >= startTime && txTime <= endTime) filteredList.push(item); 
        } 
      } 
      list = filteredList; 
    }
    
    if (searchTxt && !match) { 
      const q = searchTxt.toLowerCase(); 
      list = list.filter(item => { 
        if (item.isGroup) { 
          const groupMatch = String(item.parentTitle || "").toLowerCase().includes(q) || String(item.parentDesc || "").toLowerCase().includes(q) || String(item.amount || "").includes(q) || String(item.date || "").includes(q); 
          const childMatch = (item.children || []).some(tx => String(getParentCat(tx.category)).toLowerCase().includes(q) || String(getChildCat(tx.category)).toLowerCase().includes(q) || String(tx.desc || "").toLowerCase().includes(q) || String(tx.amount || "").includes(q) || String(tx.beneficiary || "").toLowerCase().includes(q)); 
          return groupMatch || childMatch; 
        } else { 
          return String(getParentCat(item.category)).toLowerCase().includes(q) || String(getChildCat(item.category)).toLowerCase().includes(q) || String(item.desc || "").toLowerCase().includes(q) || String(item.amount || "").includes(q) || String(item.date || "").includes(q) || String(item.beneficiary || "").toLowerCase().includes(q); 
        } 
      }); 
    }
    
    const excludeTxt = debouncedHistoryExcludeSearch.trim().toLowerCase();
    if (excludeTxt) { 
      list = list.filter(item => { 
        if (item.isGroup) { 
          const groupMatch = String(item.parentTitle || "").toLowerCase().includes(excludeTxt) || String(item.parentDesc || "").toLowerCase().includes(excludeTxt) || String(item.amount || "").includes(excludeTxt) || String(item.date || "").includes(excludeTxt); 
          const childMatch = (item.children || []).some(tx => String(getParentCat(tx.category)).toLowerCase().includes(excludeTxt) || String(getChildCat(tx.category)).toLowerCase().includes(excludeTxt) || String(tx.desc || "").toLowerCase().includes(excludeTxt) || String(tx.amount || "").includes(excludeTxt) || String(tx.beneficiary || "").toLowerCase().includes(excludeTxt)); 
          return !(groupMatch || childMatch); 
        } else { 
          return !(String(getParentCat(item.category)).toLowerCase().includes(excludeTxt) || String(getChildCat(item.category)).toLowerCase().includes(excludeTxt) || String(item.desc || "").toLowerCase().includes(excludeTxt) || String(item.amount || "").includes(excludeTxt) || String(item.date || "").includes(excludeTxt) || String(item.beneficiary || "").toLowerCase().includes(excludeTxt)); 
        } 
      }); 
    } 
    return list;
  }, [allGroupedAndSorted, currentUser, historyTypeFilter, historyDateFilter, debouncedHistorySearch, debouncedHistoryExcludeSearch, pendingMap, billingStartDay]);

  const historyFilteredStats = useMemo(() => { 
    let inc = 0; let exp = 0; 
    (filteredHistoryGroups || []).forEach(item => { 
      if (item.isGroup) { 
        (item.children || []).forEach(c => { if (pendingMap[c.id] === 'DELETE_TX' || pendingMap[c.id] === 'HARD_DELETE_TX') return; if (c.type === "income") inc += (Number(c.amount) || 0); if (c.type === "expense") exp += (Number(c.amount) || 0); }); 
      } else { 
        if (pendingMap[item.id] === 'DELETE_TX' || pendingMap[item.id] === 'HARD_DELETE_TX') return; if (item.type === "income") inc += (Number(item.amount) || 0); if (item.type === "expense") exp += (Number(item.amount) || 0); 
      } 
    }); 
    return { income: inc, expense: exp, balance: inc - exp }; 
  }, [filteredHistoryGroups, pendingMap]);

  const toggleGroup = (gId) => { triggerVibration(10); setExpandedGroups(p => ({ ...p, [gId]: !p[gId] })); };

  const renderStandaloneCard = (tx, allowEdit = true) => {
    const benArray = getBenArray(tx.beneficiary, tx.member); 
    const pAction = pendingMap[tx.id];
    return (
      <div key={tx.id} className={`flex items-stretch gap-2 mb-3 transition-opacity ${pAction === 'DELETE_TX' || pAction === 'HARD_DELETE_TX' ? 'opacity-40 grayscale' : 'opacity-100'}`}>
        {pAction && ( 
          <div className={`shrink-0 w-6 flex items-center justify-center rounded-2xl shadow-sm border ${pAction==='ADD' || pAction === 'RESTORE_TX' ?'bg-green-50 border-green-200 text-green-700':pAction==='UPDATE_TX'?'bg-blue-50 border-blue-200 text-blue-700':'bg-red-50 border-red-200 text-red-700'}`}> 
            <span className="text-[10px] font-black tracking-widest" style={{writingMode: 'vertical-rl'}}>{(pAction==='ADD' || pAction === 'RESTORE_TX')?'待處理':pAction==='UPDATE_TX'?'待處理':'待處理'}</span> 
          </div> 
        )}
        <div className="flex-1 min-w-0 w-full bg-white p-4 rounded-3xl border border-gray-100 flex items-start sm:items-center gap-3 shadow-sm relative overflow-hidden transition-colors">
          <div className="relative shrink-0 mt-1 sm:mt-0">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-[17px] leading-none ${tx.type==="income" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>{tx.type==="income" ? "收入" : "支出"}</div>
            {tx.member !== currentUser.name && ( <div className={`absolute -top-2 -left-2 text-[10px] font-black px-1.5 py-0.5 rounded-lg border-2 border-white shadow-sm ${tx.member === "爸爸" ? "bg-blue-600" : tx.member === "媽媽" ? "bg-pink-600" : "bg-gray-500"} text-white z-10`}>{tx.member}</div> )}
          </div>
          <div className="flex-1 min-w-0 pl-1 pt-1">
            <div className="font-bold text-[14px] leading-tight text-gray-800 flex items-center gap-1.5 flex-wrap">
              <span className="truncate flex-shrink">{getParentCat(tx.category)} - {getChildCat(tx.category)}</span>
              <div className="flex gap-1 flex-wrap shrink-0">{benArray.map(b => ( <span key={b} className={`text-[9px] px-1.5 py-0.5 rounded-md border font-black ${getBenBadgeStyle(b)}`}>{b}</span> ))}</div>
            </div>
            <div className="flex flex-col gap-1.5 mt-1.5 w-full items-start">
              <div className="flex items-center gap-2 flex-wrap w-full">
                <span className="text-[10px] text-gray-400 font-medium leading-none shrink-0">{displayDateClean(tx.date)}</span>
                {tx.editHistory && tx.editHistory.length > 0 && ( 
                  <button onClick={(e) => { triggerVibration(10); e.stopPropagation(); setViewingHistoryItem(tx); }} className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-md text-[9px] font-black border border-amber-200 active:scale-95 transition-transform whitespace-nowrap shrink-0">✏️ 已編輯</button> 
                )}
              </div>
              {tx.desc && <div className="text-[11px] text-gray-600 font-bold bg-gray-50 px-2.5 py-1.5 rounded-lg break-words w-full border border-gray-100 shadow-sm leading-relaxed">{tx.desc}</div>}
            </div>
          </div>
          <div className="flex flex-col items-end justify-center shrink-0 pl-1 z-10 mt-1 sm:mt-0">
            <div className={`font-black tabular-nums text-[17px] leading-none ${tx.type==="income" ? "text-green-600" : "text-red-600"}`}>${Number(tx.amount||0).toLocaleString()}</div>
            {tx.recorder && tx.recorder !== tx.member && ( <div className={`mt-2 text-[9px] font-black px-1.5 py-0.5 rounded-md border shadow-sm ${tx.recorder === "爸爸" ? "bg-blue-50 text-blue-600 border-blue-200" : tx.recorder === "媽媽" ? "bg-pink-50 text-pink-600 border-pink-200" : "bg-gray-50 text-gray-500 border-gray-200"} whitespace-nowrap shrink-0`}>✍️ {tx.recorder}代記</div> )}
          </div>
          {allowEdit && pAction !== 'DELETE_TX' && pAction !== 'HARD_DELETE_TX' && ( 
            <button onClick={(e) => { triggerVibration(10); e.stopPropagation(); setEditingTx(tx); }} className="absolute bottom-2 right-2 p-1.5 text-gray-300 hover:text-blue-500 active:text-blue-600 active:scale-90 transition-all"><SvgIcon name="edit" size={13} /></button> 
          )}
        </div>
      </div>
    );
  };

  const renderGroupCard = (group, allowEdit = true) => {
    const isExp = !!expandedGroups[group.groupId]; 
    const allBens = new Set(); 
    (group.children || []).forEach(c => { if(c.beneficiary) String(c.beneficiary).split(",").filter(Boolean).forEach(b => allBens.add(b.trim())); }); 
    const parentBenArray = getBenArray(Array.from(allBens).join(","), group.member); 
    const gAction = pendingMap[group.groupId]; 
    const hasChildAction = (group.children || []).some(c => pendingMap[c.id]); 
    const isPendingDeleteGroup = (group.children || []).every(c => pendingMap[c.id] === 'DELETE_TX' || pendingMap[c.id] === 'HARD_DELETE_TX');
    
    return (
      <div key={group.groupId} className={`flex items-stretch gap-2 mb-3 transition-opacity ${isPendingDeleteGroup ? 'opacity-40 grayscale' : 'opacity-100'}`}>
        {(gAction || hasChildAction) && ( 
          <div className={`shrink-0 w-6 flex items-center justify-center rounded-3xl shadow-sm border ${gAction==='UPDATE_GROUP_PARENT'?'bg-purple-50 border-purple-200 text-purple-700': isPendingDeleteGroup ? 'bg-red-50 border-red-200 text-red-700' : hasChildAction?'bg-gray-100 border-gray-200 text-gray-600':'bg-blue-50 border-blue-200 text-blue-700'}`}> 
            <span className="text-[10px] font-black tracking-widest" style={{writingMode: 'vertical-rl'}}>{isPendingDeleteGroup?'待處理':gAction==='UPDATE_GROUP_PARENT'?'待處理': '待處理'}</span> 
          </div> 
        )}
        <div className="flex-1 min-w-0 w-full bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-300">
          <div onClick={() => toggleGroup(group.groupId)} className="p-4 flex items-start sm:items-center gap-3 cursor-pointer active:bg-gray-50 transition-colors relative">
            <div className="relative shrink-0 mt-1 sm:mt-0">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-[17px] leading-none ${group.type==="income" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>{group.type==="income" ? "收入" : "支出"}</div>
              <div className="absolute -bottom-1 -right-1 bg-gray-800 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md border-2 border-white shadow-sm z-10">多筆</div>
              {group.member !== currentUser.name && ( <div className={`absolute -top-2 -left-2 text-[10px] font-black px-1.5 py-0.5 rounded-lg border-2 border-white shadow-sm ${group.member === "爸爸" ? "bg-blue-600" : group.member === "媽媽" ? "bg-pink-600" : "bg-gray-500"} text-white z-10`}>{group.member}</div> )}
            </div>
            <div className="flex-1 min-w-0 pl-1 pt-1">
              <div className="font-bold text-[14px] leading-tight text-gray-800 flex items-center gap-1.5 flex-wrap">
                <span className="truncate flex-shrink">{group.parentTitle}</span>
                <div className="flex gap-1 flex-wrap shrink-0">{parentBenArray.map(b => ( <span key={b} className={`text-[9px] px-1.5 py-0.5 rounded-md border font-black ${getBenBadgeStyle(b)}`}>{b}</span> ))}</div>
                <span className={`text-[10px] text-gray-400 transform transition-transform duration-300 shrink-0 ${isExp ? 'rotate-180' : ''}`}>▼</span>
              </div>
              <div className="flex flex-col gap-1.5 mt-1.5 w-full items-start">
                <div className="flex items-center gap-2 flex-wrap w-full">
                  <span className="text-[10px] text-gray-400 font-medium leading-none shrink-0">{displayDateClean(group.date)}</span>
                  {group.editHistory && group.editHistory.length > 0 && ( 
                    <button onClick={(e) => { triggerVibration(10); e.stopPropagation(); setViewingHistoryItem(group); }} className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-md text-[9px] font-black border border-amber-200 active:scale-95 transition-transform whitespace-nowrap shrink-0">✏️ 已編輯</button> 
                  )}
                </div>
                {group.parentDesc && <div className="text-[11px] text-gray-600 font-bold bg-gray-50 px-2.5 py-1.5 rounded-lg break-words w-full border border-gray-100 shadow-sm leading-relaxed">{group.parentDesc}</div>}
              </div>
            </div>
            <div className="flex flex-col items-end justify-center shrink-0 pl-1 z-10 mt-1 sm:mt-0">
              <div className={`font-black tabular-nums text-lg leading-none ${group.type==="income" ? "text-green-600" : "text-red-600"}`}>${Number(group.amount||0).toLocaleString()}</div>
              {group.recorder && group.recorder !== group.member && ( <div className={`mt-2 text-[9px] font-black px-1.5 py-0.5 rounded-md border shadow-sm ${group.recorder === "爸爸" ? "bg-blue-50 text-blue-600 border-blue-200" : group.recorder === "媽媽" ? "bg-pink-50 text-pink-600 border-pink-200" : "bg-gray-50 text-gray-500 border-gray-200"} whitespace-nowrap shrink-0`}>✍️ {group.recorder}代記</div> )}
            </div>
            {allowEdit && !isPendingDeleteGroup && ( 
              <button onClick={(e) => { triggerVibration(10); e.stopPropagation(); setEditingGroup(group); }} className="absolute bottom-2 right-2 p-1.5 text-gray-300 hover:text-blue-500 active:text-blue-600 active:scale-90 transition-all"><SvgIcon name="edit" size={13} /></button> 
            )}
          </div>

          {isExp && (
            <div className="bg-gray-50/80 p-3 flex flex-col gap-2 border-t-2 border-gray-100 shadow-inner">
              {(group.children || []).map((child, idx) => {
                const childBenArray = getBenArray(child.beneficiary, group.member); 
                const cAction = pendingMap[child.id];
                return (
                  <div key={child.id} className={`w-full flex items-center gap-2 sm:gap-3 bg-white p-2.5 sm:p-3 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden transition-opacity ${cAction === 'DELETE_TX' || cAction === 'HARD_DELETE_TX' ? 'opacity-40 grayscale' : 'opacity-100'}`}>
                    {cAction && <div className={`absolute left-0 top-0 h-full w-1 ${cAction==='ADD'?'bg-green-400':cAction==='UPDATE_TX'?'bg-blue-400':'bg-red-400'}`}></div>}
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gray-100 text-gray-400 text-[10px] font-black flex items-center justify-center shrink-0">{idx + 1}</div>
                    <div className="flex-1 min-w-0 pr-2 border-r border-gray-100">
                      <div className="font-bold text-xs sm:text-sm text-gray-800 flex items-center gap-1.5 flex-wrap leading-tight">
                        <span className="truncate flex-shrink">{getParentCat(child.category)} - {getChildCat(child.category)}</span>
                        {cAction === 'ADD' && <span className="shrink-0 bg-green-100 text-green-600 text-[8px] px-1.5 py-0.5 rounded-md border border-green-200 font-black">待處理</span>}
                        {cAction === 'UPDATE_TX' && <span className="shrink-0 bg-blue-100 text-blue-600 text-[8px] px-1.5 py-0.5 rounded-md border border-blue-200 font-black">待處理</span>}
                        {(cAction === 'DELETE_TX' || cAction === 'HARD_DELETE_TX') && <span className="shrink-0 bg-red-100 text-red-600 text-[8px] px-1.5 py-0.5 rounded-md border border-red-200 font-black">待處理</span>}
                        <div className="flex gap-1 flex-wrap shrink-0">{childBenArray.map(b => ( <span key={b} className={`text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-md border font-black ${getBenBadgeStyle(b)}`}>{b}</span> ))}</div>
                      </div>
                      {child.desc && <div className="text-[10px] sm:text-[11px] text-gray-500 mt-0.5 whitespace-normal break-words">{child.desc}</div>}
                    </div>
                    <div className="flex flex-col items-end shrink-0 min-w-[3.5rem] text-right z-10">
                      <div className={`font-black tabular-nums text-xs sm:text-sm ${child.type==="income" ? "text-green-600" : "text-gray-600"}`}>${Number(child.amount||0).toLocaleString()}</div>
                    </div>
                    {allowEdit && cAction !== 'DELETE_TX' && cAction !== 'HARD_DELETE_TX' && ( 
                      <button onClick={(e) => { triggerVibration(10); e.stopPropagation(); setEditingTx(child); }} className="absolute bottom-1 right-1.5 p-1.5 text-gray-300 hover:text-blue-500 active:text-blue-600 active:scale-90 transition-all"><SvgIcon name="edit" size={11} /></button> 
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderItemOrGroup = (item, allowEdit) => { 
    if (item.isGroup) return renderGroupCard(item, allowEdit); 
    return renderStandaloneCard(item, allowEdit); 
  };

  const setQuickDateFilter = (filterVal) => { triggerVibration(10); setHistoryDateFilter(filterVal); setAnalysisDateFilter(filterVal); setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null); };

  const isHistoryFiltered = debouncedHistorySearch || debouncedHistoryExcludeSearch || historyTypeFilter !== "all" || historyDateFilter !== "all";

  if (!currentUser) {
    return (
      <div translate="no" className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-8 animate-in relative w-full text-center font-black">
        
        {isLoading && (
          <div className="fixed inset-0 z-[9999] bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-5 animate-in">
              <SvgIcon name="spinner" size={40} className="animate-spin text-blue-600" />
              <p className="font-black text-gray-800 text-sm tracking-widest">{loadingCard.text || "處理中..."}</p>
            </div>
          </div>
        )}

        <LoginUI 
          selectingUser={selectingUser} setSelectingUser={setSelectingUser}
          familyConfig={familyConfig} handleUserClick={handleUserClick}
          syncQueue={syncQueue} setShowClearQueueModal={setShowClearQueueModal}
          triggerVibration={triggerVibration} setShowClearCacheModal={setShowClearCacheModal}
          fallbackToPin={fallbackToPin} setFallbackToPin={setFallbackToPin}
          handleBioLoginLocal={handleBioLoginLocal} showStatus={showStatus}
          setCurrentUser={setCurrentUser} pinInput={pinInput} setPinInput={setPinInput}
        />

        {showBootstrapModal && (
          <div className="fixed inset-0 z-[600] bg-gray-900/90 backdrop-blur-md flex items-center justify-center p-8 animate-in">
            <div className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 text-gray-900 relative">
              <h3 className="font-black text-lg mb-2">首次綁定雲端</h3>
              <p className="text-[11px] text-gray-500 mb-5">請輸入雲端密碼（爸爸手機號碼）。</p>
              <input value={bootstrapSecret} onChange={(e)=>setBootstrapSecret(e.target.value)} placeholder="輸入爸爸手機號碼" className="w-full bg-gray-100 rounded-2xl px-4 py-3 font-black outline-none mb-5" />
              <button onClick={async () => { try { setLoadingCard({ show:true, text:"正在綁定雲端..." }); await bootstrapDevice(); setShowBootstrapModal(false); setBootstrapSecret(""); showStatus("success","✅ 雲端已綁定"); } catch (e) { showStatus("error", e.message || "雲端密碼錯誤"); } finally { setLoadingCard({ show:false, text:"" }); } }} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black active:scale-95 disabled:opacity-40">確認</button>
            </div>
          </div>
        )}
        {showClearQueueModal && (
          <div className="fixed inset-0 z-[600] bg-gray-900/90 backdrop-blur-md flex items-center justify-center p-8 animate-in text-white" onClick={(e) => { if(e.target === e.currentTarget) setShowClearQueueModal(false); }}>
            <div className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 text-gray-900 relative text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><SvgIcon name="trash" size={32} /></div>
              <h3 className="font-black text-lg mb-2 text-red-600">強制清除同步暫存</h3>
              <p className="text-xs text-gray-500 mb-6 font-bold leading-relaxed">確定要清除卡在手機裡的 {(syncQueue || []).length} 筆暫存資料嗎？<br/>這將會永遠刪除這些尚未上傳的紀錄。</p>
              <div className="flex gap-3">
                <button onClick={() => { triggerVibration(10); setShowClearQueueModal(false); }} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black active:scale-95">取消</button>
                <button onClick={() => { triggerVibration([30, 50, 30]); setSyncQueue([]); localStorage.removeItem(LS.pending); setShowClearQueueModal(false); showStatus("success", "✅ 已清空卡死的暫存資料"); }} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black active:scale-95 shadow-md shadow-red-500/30">確認清除</button>
              </div>
            </div>
          </div>
        )}
        {showClearCacheModal && (
          <div className="fixed inset-0 z-[600] bg-gray-900/90 backdrop-blur-md flex items-center justify-center p-8 animate-in text-white" onClick={(e) => { if(e.target === e.currentTarget && !isLoading) {setShowClearCacheModal(false); setCacheClearPassword("");} }}>
            <div className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 text-gray-900 relative text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><SvgIcon name="refresh" size={32} /></div>
              <h3 className="font-black text-lg mb-2 text-red-600">深度清理 (清空快取)</h3>
              <p className="text-xs text-gray-500 mb-5 font-bold leading-relaxed">這將刪除手機內所有歷史紀錄與暫存，並重新從雲端下載。請輸入「雲端密碼」以確認執行：</p>
              <input value={cacheClearPassword} onChange={(e)=>setCacheClearPassword(e.target.value)} type="password" placeholder="請輸入雲端密碼" className="w-full bg-gray-100 rounded-2xl px-4 py-3 font-black outline-none mb-6 text-center tracking-widest" disabled={isLoading} />
              <div className="flex gap-3">
                <button onClick={() => {setShowClearCacheModal(false); setCacheClearPassword("");}} disabled={isLoading} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black active:scale-95 disabled:opacity-50">取消</button>
                <button onClick={async () => { if (!cacheClearPassword) { showStatus("error", "請輸入雲端密碼"); return; } if (!navigator.onLine) { showStatus("error", "需連線才能驗證雲端密碼"); return; } try { setLoadingCard({ show: true, text: "正在驗證密碼並清理快取..." }); const res = await postGAS({ action: "DEVICE_BOOTSTRAP", appSecret: cacheClearPassword }); if (res.result !== "success") throw new Error("雲端密碼錯誤"); setTxCache([]); setSyncQueue([]); setLastServerTime(0); localStorage.clear(); const db = await initIndexedDB(); const tx = db.transaction(STORE_NAME, "readwrite"); tx.objectStore(STORE_NAME).clear(); if ('serviceWorker' in navigator) { const registrations = await navigator.serviceWorker.getRegistrations(); for (let r of registrations) await r.unregister(); } if ('caches' in window) { const cacheNames = await caches.keys(); for (let c of cacheNames) await caches.delete(c); } setShowClearCacheModal(false); setCacheClearPassword(""); showStatus("success", "✅ 快取已清空，正在重新下載..."); setTimeout(() => { window.location.reload(true); }, 1500); } catch(e) { showStatus("error", e.message || "驗證失敗"); } finally { setLoadingCard({ show: false, text: "" }); } }} disabled={isLoading} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black active:scale-95 shadow-md shadow-red-500/30 disabled:opacity-50">確認清空</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div translate="no" className="min-h-screen bg-gray-50 text-gray-900 pb-24 max-w-md mx-auto relative flex flex-col overflow-x-hidden w-full text-left font-black">
      
      <ProxyNotification transactions={unackedProxyTxs} onAck={() => { triggerVibration(15); const acked = safeParse(localStorage.getItem(LS.ackProxyTxs), []); const newAcked = [...new Set([...acked, ...unackedProxyTxs.map(t => t.id)])]; localStorage.setItem(LS.ackProxyTxs, JSON.stringify(newAcked)); setUnackedProxyTxs([]); }} />

      {editingTx && <EditTransactionModal tx={editingTx} loginUser={currentUser.name} onSave={handleUpdateTx} onDelete={handleDeleteTx} onCancel={() => { triggerVibration(10); setEditingTx(null); }} />}
      {editingGroup && <EditGroupParentModal group={editingGroup} onSave={handleUpdateGroupParent} onCancel={() => { triggerVibration(10); setEditingGroup(null); }} />}
      {showChangePinModal && <ChangePinModal currentUser={currentUser} onCancel={() => setShowChangePinModal(false)} onSuccess={() => {setShowChangePinModal(false); setCurrentUser(null); setSelectingUser(null); setPinInput(""); showStatus("success", "✅ 密碼已更新，請重新登入");}} forceReloginForToken={forceReloginForToken} />}
      
      {showTrashModal && (
        <div className="fixed inset-0 z-[600] bg-gray-900/90 backdrop-blur-sm overflow-y-auto flex flex-col items-center justify-center p-4 sm:p-6 animate-in font-black" onClick={(e) => { if(e.target === e.currentTarget) setShowTrashModal(false); }}>
          <div className="bg-white w-full max-w-sm relative rounded-[2.5rem] shadow-2xl overflow-hidden pb-6 flex flex-col max-h-[85vh]">
            <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>
            <button onClick={() => setShowTrashModal(false)} className="absolute top-4 right-4 text-gray-400 active:scale-90"><SvgIcon name="close" size={24} /></button>
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-xl font-black text-gray-800 flex items-center gap-2"><SvgIcon name="trash" size={20} className="text-red-500" /> 資源回收桶</h2>
              <p className="text-[10px] text-gray-500 mt-1">被刪除的紀錄會暫存於此，可手動復原。</p>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-2 space-y-3 scrollbar-hide">
               {visibleTrash.length === 0 ? ( 
                 <div className="text-center text-gray-400 py-10 text-sm">回收桶是空的</div> 
               ) : ( 
                 visibleTrash.map(tx => ( 
                   <div key={tx.id} className="bg-white p-3 rounded-2xl border border-gray-100 flex flex-col gap-2 relative overflow-hidden">
                     {pendingMap[tx.id] === 'DELETE_TX' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-400"></div>}
                     {pendingMap[tx.id] === 'HARD_DELETE_TX' && <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center"><span className="text-red-600 font-black text-xs border border-red-200 bg-red-50 px-2 py-1 rounded">刪除中...</span></div>}
                     {pendingMap[tx.id] === 'RESTORE_TX' && <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center"><span className="text-green-600 font-black text-xs border border-green-200 bg-green-50 px-2 py-1 rounded">復原中...</span></div>}
                     <div className="flex justify-between items-start">
                       <div>
                         <span className="text-xs font-black text-gray-800">{getParentCat(tx.category)} - {getChildCat(tx.category)}</span>
                         <div className="text-[10px] text-gray-400 mt-0.5">{displayDateClean(tx.date)}</div>
                       </div>
                       <span className={`font-black text-sm ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>${Number(tx.amount).toLocaleString()}</span>
                     </div>
                     {(tx.desc || tx.parentDesc) && <div className="text-[10px] text-gray-500 truncate bg-white px-2 py-1 rounded-lg border border-gray-100 mt-1">{tx.parentTitle ? tx.parentTitle + ' - ' : ''}{tx.desc || tx.parentDesc}</div>}
                     <div className="flex justify-end gap-2 mt-2">
                       {confirmHardDeleteId === tx.id ? ( 
                         <button onClick={() => handleHardDeleteTrash(tx)} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-black active:scale-95 shadow-sm transition-all">確認永久刪除</button> 
                       ) : ( 
                         <button onClick={() => { triggerVibration(10); setConfirmHardDeleteId(tx.id); }} className="px-3 py-1.5 bg-white border border-gray-200 text-red-500 rounded-lg text-[10px] font-black active:scale-95 shadow-sm transition-all">永久刪除</button> 
                       )}
                       <button onClick={() => handleRestoreTrash(tx)} className="px-3 py-1.5 bg-green-50 border border-green-200 text-green-600 rounded-lg text-[10px] font-black active:scale-95 shadow-sm flex items-center gap-1 transition-all"><SvgIcon name="refresh" size={12}/> 復原</button>
                     </div>
                   </div> 
                 )) 
               )}
            </div>
            {visibleTrash.length > 0 && ( 
              <div className="px-6 mt-2 pt-3 border-t border-gray-100">
                {!showConfirmEmptyTrash ? ( 
                  <button onClick={() => { triggerVibration(10); setShowConfirmEmptyTrash(true); }} className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-black text-xs active:scale-95 transition-all border border-red-100">全部清空 (無法復原)</button> 
                ) : ( 
                  <div className="bg-red-50 p-3 rounded-xl flex flex-col gap-2 border border-red-200 animate-in">
                    <span className="text-xs font-black text-red-600 text-center">確定要永久刪除所有紀錄嗎？</span>
                    <div className="flex gap-2">
                      <button onClick={() => { triggerVibration(10); setShowConfirmEmptyTrash(false); }} className="flex-1 py-2 bg-white text-gray-600 rounded-lg font-black text-[10px] border border-gray-200 active:scale-95">取消</button>
                      <button onClick={handleEmptyTrash} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-black text-[10px] shadow-sm shadow-red-500/30 active:scale-95">確定清空</button>
                    </div>
                  </div> 
                )}
              </div> 
            )}
          </div>
        </div>
      )}
      
      {viewingHistoryItem && (
        <div className="fixed inset-0 z-[700] bg-gray-900/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 animate-in font-black" onClick={(e) => { if(e.target === e.currentTarget) setViewingHistoryItem(null); }}>
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl relative flex flex-col max-h-[85vh]">
              <button onClick={() => setViewingHistoryItem(null)} className="absolute top-6 right-6 text-gray-400 active:scale-90 transition-transform"><SvgIcon name="close" size={24}/></button>
              <h3 className="font-black text-lg mb-1 text-gray-800 pr-8 leading-tight flex items-center gap-2">✏️ 編輯歷程</h3>
              <p className="text-[10px] text-gray-500 font-bold mb-4 bg-gray-100 px-2 py-1 rounded-md self-start">{viewingHistoryItem.isGroup ? viewingHistoryItem.parentTitle : `${getParentCat(viewingHistoryItem.category)} - ${getChildCat(viewingHistoryItem.category)}`}</p>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                  {(viewingHistoryItem.editHistory || []).length === 0 ? ( <div className="text-gray-400 text-sm text-center py-4">無編輯紀錄</div> ) : (
                      (viewingHistoryItem.editHistory || []).map((h, i) => {
                         let fakeTx = null; let displayContent = h.oldContent;
                         if (displayContent && !displayContent.includes('舊標題')) { try { const rawArr = JSON.parse(displayContent); if (Array.isArray(rawArr) && rawArr.length > 2) { fakeTx = { date: rawArr[0], category: rawArr[1], amount: Number(rawArr[2]), member: rawArr[3], desc: rawArr[4], type: rawArr[5], recorder: rawArr[6], id: rawArr[7] || 'fake', groupId: rawArr[8], parentDesc: rawArr[9], beneficiary: rawArr[10] || rawArr[3] }; } } catch (e) {} }
                         return (
                           <div key={i} className="bg-white p-4 rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden">
                             <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-400"></div>
                             <div className="flex justify-between items-center mb-3 pl-2 border-b border-gray-50 pb-2">
                               <span className="font-black text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">{h.action.replace("修改明細", "編輯紀錄")}</span>
                               <span className="text-[9px] text-gray-400 font-bold">{h.time}</span>
                             </div>
                             {fakeTx ? (
                               <div className="flex items-center gap-3 pl-1">
                                 <div className="relative shrink-0">
                                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-[15px] leading-none ${fakeTx.type==="income" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>{fakeTx.type==="income" ? "收入" : "支出"}</div>
                                   {fakeTx.member && fakeTx.member !== currentUser.name && (<div className={`absolute -top-2 -left-2 text-[8px] font-black px-1.5 py-0.5 rounded-lg border-2 border-white shadow-sm ${fakeTx.member === "爸爸" ? "bg-blue-600" : fakeTx.member === "媽媽" ? "bg-pink-600" : "bg-gray-500"} text-white z-10`}>{fakeTx.member}</div>)}
                                 </div>
                                 <div className="flex-1 min-w-0 pl-1">
                                   <div className="font-bold text-[13px] leading-tight text-gray-800 flex items-center gap-1.5 flex-wrap"><span className="truncate flex-shrink">{getParentCat(fakeTx.category)} - {getChildCat(fakeTx.category)}</span><div className="flex gap-1 flex-wrap shrink-0">{getBenArray(fakeTx.beneficiary, fakeTx.member).map(b => ( <span key={b} className={`text-[8px] px-1.5 py-0.5 rounded-md border font-black ${getBenBadgeStyle(b)}`}>{b}</span> ))}</div></div>
                                   <div className="flex flex-col gap-1 mt-1 w-full items-start"><span className="text-[9px] text-gray-400 font-medium leading-none">{displayDateClean(fakeTx.date)}</span>{fakeTx.desc && <span className="text-[10px] text-gray-600 font-bold bg-gray-50 px-2 py-1 rounded-lg whitespace-normal break-words w-full">{fakeTx.desc}</span>}</div>
                                 </div>
                                 <div className="flex flex-col items-end justify-center shrink-0 pl-1 z-10"><div className={`font-black tabular-nums text-[15px] leading-none ${fakeTx.type==="income" ? "text-green-600" : "text-red-600"}`}>${Number(fakeTx.amount||0).toLocaleString()}</div></div>
                               </div>
                             ) : ( 
                               <div className="pl-1 mt-2 text-[10px] text-gray-500 bg-gray-50 p-2 rounded-xl border border-gray-100 whitespace-pre-wrap break-words"><div className="text-[9px] text-gray-400 mb-1">修改前備註：</div>{displayContent || '無變更內容或無法解析'}</div> 
                             )}
                           </div>
                         );
                      })
                  )}
              </div>
          </div>
        </div>
      )}

      {analysisDetailData && (
        <div className="fixed inset-0 z-[600] bg-gray-900/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 animate-in text-left font-black" onClick={(e) => { if(e.target === e.currentTarget) setAnalysisDetailData(null); }}>
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl relative flex flex-col max-h-[85vh]">
              <button onClick={() => setAnalysisDetailData(null)} className="absolute top-6 right-6 text-gray-400 active:scale-90 transition-transform"><SvgIcon name="close" size={24}/></button>
              <h3 className="font-black text-lg mb-1 text-gray-800 pr-8 leading-tight">{analysisDetailData.title}</h3>
              <p className="text-[10px] text-gray-500 font-bold mb-4 bg-gray-100 px-2 py-1 rounded-md self-start">共 {analysisDetailData.txs.length} 筆明細</p>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                  {groupTransactions(analysisDetailData.txs).sort((a,b) => parseDateForSort(b) - parseDateForSort(a) || String(b.id).localeCompare(String(a.id))).map(item => renderItemOrGroup(item, false))}
              </div>
          </div>
        </div>
      )}

      {showPendingModal && (
        <div className="fixed inset-0 z-[600] bg-gray-900/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in text-left">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl relative flex flex-col max-h-[80vh]">
              <button onClick={() => setShowPendingModal(false)} className="absolute top-6 right-6 text-gray-400 active:scale-90 transition-transform"><SvgIcon name="close" size={24}/></button>
              <h3 className="font-black text-xl mb-2 text-gray-800 flex items-center gap-2"><SvgIcon name="cloudSync" size={24} className="text-blue-500" /> 待同步清單 ({(syncQueue || []).length})</h3>
              <p className="text-[10px] text-gray-500 font-bold mb-4">以下清單為暫存於手機尚未上傳的操作（包含待刪除項目），點擊下方按鈕即可一併同步至雲端。</p>
              <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2 scrollbar-hide">
                  {(syncQueue || []).map((item, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex items-stretch gap-3 relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-1.5 h-full ${item.action==='ADD'?'bg-green-500':item.action==='DELETE_TX'?'bg-red-500':'bg-blue-500'}`}></div>
                        <div className="flex-1 min-w-0 pl-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {item.type && <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-md font-black text-white ${item.type==='income'?'bg-green-500':'bg-red-500'}`}>{item.type==='income'?'收入':'支出'}</span>}
                            {!item.type && <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-md font-black text-white bg-purple-500">母項目</span>}
                            <span className="text-[12px] font-black text-gray-800 truncate">{item.category || item.parentTitle || '未知項目'}</span>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${item.action==='ADD'?'text-green-600 border-green-200 bg-green-50':item.action==='DELETE_TX'?'text-red-600 border-red-200 bg-red-50':'text-blue-600 border-blue-200 bg-blue-50'}`}>{item.action==='ADD'?'待處理':item.action==='DELETE_TX'?'待處理':'待處理'}</span>
                          </div>
                          <div className="text-[10px] text-gray-400 font-bold mb-0.5">{displayDateClean(item.date)}</div>
                          {(item.desc || item.parentDesc) && <div className="text-[10px] text-gray-600 truncate w-full mt-1 bg-gray-50 px-2 py-1 rounded-lg">{item.desc || item.parentDesc}</div>}
                        </div>
                        {item.amount !== undefined && <div className={`font-black flex items-center text-sm shrink-0 ${item.type==='income'?'text-green-600':'text-red-600'}`}>${Number(item.amount||0).toLocaleString()}</div>}
                      </div>
                  ))}
              </div>
              <button onClick={() => { triggerVibration(10); setShowPendingModal(false); requestSync(false, true); }} disabled={isSyncing} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black active:scale-95 shadow-xl shadow-blue-500/30 flex items-center justify-center gap-2 disabled:opacity-50">
                {isSyncing ? <SvgIcon name="spinner" size={20} className="animate-spin" /> : <SvgIcon name="cloudSync" size={20} />} {isSyncing ? "同步中..." : "立即同步至雲端"}
              </button>
          </div>
        </div>
      )}

      <Header 
        currentUser={currentUser} 
        customSubtitle={customSubtitle} 
        handleSyncClick={handleSyncClick} 
        isSyncing={isSyncing} 
        syncQueue={syncQueue} 
        isOnline={isOnline} 
      />

      <main className="p-6 pb-32 flex-1 overflow-y-auto scrollbar-hide text-gray-800 flex flex-col relative">
        
        {activeTab === "dashboard" && (
          <div className="space-y-6 animate-in">
            <DashboardSummary stats={stats} />
            <div className="space-y-4 text-left">
              <h3 className="font-black text-lg px-1 text-gray-800">最新動態</h3>
              <div className="space-y-3">{(allGroupedAndSorted || []).slice(0, 5).map(item => renderItemOrGroup(item, false))}</div>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <HistoryTab
            setQuickDateFilter={setQuickDateFilter}
            historyDateFilter={historyDateFilter}
            setHistoryDateFilter={setHistoryDateFilter}
            setHistorySearch={setHistorySearch}
            setHistoryExcludeSearch={setHistoryExcludeSearch}
            setHistoryTypeFilter={setHistoryTypeFilter}
            historySearch={historySearch}
            historyExcludeSearch={historyExcludeSearch}
            triggerVibration={triggerVibration}
            setShowTrashModal={setShowTrashModal}
            setConfirmHardDeleteId={setConfirmHardDeleteId}
            setShowConfirmEmptyTrash={setShowConfirmEmptyTrash}
            showSearchFilterModal={showSearchFilterModal}
            setShowSearchFilterModal={setShowSearchFilterModal}
            debouncedHistorySearch={debouncedHistorySearch}
            debouncedHistoryExcludeSearch={debouncedHistoryExcludeSearch}
            historyTypeFilter={historyTypeFilter}
            isHistoryFiltered={isHistoryFiltered}
            historyFilteredStats={historyFilteredStats}
            filteredHistoryGroups={filteredHistoryGroups}
            renderItemOrGroup={renderItemOrGroup}
          />
        )}

        {activeTab === "analysis" && (
          <AnalysisTab
            analysisDateFilter={analysisDateFilter}
            setAnalysisDateFilter={setAnalysisDateFilter}
            setSelectedAnalysisLevel1={setSelectedAnalysisLevel1}
            setSelectedAnalysisLevel2={setSelectedAnalysisLevel2}
            analysisCustomStart={analysisCustomStart}
            setAnalysisCustomStart={setAnalysisCustomStart}
            analysisCustomEnd={analysisCustomEnd}
            setAnalysisCustomEnd={setAnalysisCustomEnd}
            analysisType={analysisType}
            setAnalysisType={setAnalysisType}
            aiEvalData={aiEvalData}
            currentUser={currentUser}
            isAIEvaluating={isAIEvaluating}
            handleForceAIEval={handleForceAIEval}
            myTransactions={myTransactions}
            billingStartDay={billingStartDay}
            pendingMap={pendingMap}
            selectedAnalysisLevel1={selectedAnalysisLevel1}
            setAnalysisDetailData={setAnalysisDetailData}
            animTrigger={animTrigger}
            triggerVibration={triggerVibration}
            renderItemOrGroup={renderItemOrGroup}
            snapshotsCache={snapshotsCache} // 🌟 將快照傳遞給分析圖表
          />
        )}

        {activeTab === "add" && <AddTransactionForm loginUser={currentUser.name} onSubmit={handleAdd} />}

        {activeTab === "settings" && (
          <SettingsTab
            handleForceAIEval={handleForceAIEval}
            isAIEvaluating={isAIEvaluating}
            isSyncing={isSyncing}
            triggerVibration={triggerVibration}
            billingStartDay={billingStartDay}
            setBillingStartDay={setBillingStartDay}
            currentCycleRange={currentCycleRange}
            customSubtitle={customSubtitle}
            setCustomSubtitle={setCustomSubtitle}
            handleSaveGreeting={handleSaveGreeting}
            currentUser={currentUser}
            setShowChangePinModal={setShowChangePinModal}
            bioBound={bioBound}
            setUnbindPin={setUnbindPin}
            setShowUnbindModal={setShowUnbindModal}
            bindDeviceBio={bindDeviceBio}
            setShowClearCacheModal={setShowClearCacheModal}
            setCurrentUser={setCurrentUser}
            setSelectingUser={setSelectingUser}
            setPinInput={setPinInput}
            setActiveTab={setActiveTab}
            syncQueue={syncQueue}
            setShowClearQueueModal={setShowClearQueueModal}
            isLogOpen={isLogOpen}
            setIsLogOpen={setIsLogOpen}
          />
        )}
      </main>

      <BottomNav 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        triggerVibration={triggerVibration} 
      />

      {statusMsg.text && ( 
        <div className="fixed bottom-24 left-0 right-0 flex justify-center z-[1000] pointer-events-none px-4 text-center">
          <div className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in pointer-events-auto ${statusMsg.type === "success" ? "bg-green-600 text-white" : statusMsg.type === "error" ? "bg-red-600 text-white" : statusMsg.type === "info" ? "bg-gray-800 text-white border border-gray-600" : "bg-blue-600 text-white"}`}>
            <span className="text-sm font-bold tracking-tight text-center">{statusMsg.text}</span>
          </div>
        </div> 
      )}
    </div>
  );
}

export default App;