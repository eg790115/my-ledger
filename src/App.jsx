import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

import { APP_VERSION, LS, CATEGORY_MAP, BEN_OPTIONS, CHART_COLORS } from './utils/constants.js';
import { safeParse, safeArrayLS, safeStringLS, safeNumberLS, nowStr, displayDateClean, formatDateOnly, parseDateForSort, getCycleRange, getParentCat, getChildCat, getBenArray, getBenBadgeStyle, saveToIndexedDB, loadFromIndexedDB } from './utils/helpers.js';
import { gasUrl, postGAS, getDeviceToken, getDeviceExp, deviceValid, setDeviceToken, clearDeviceToken, getBioKey, isDeviceBioBound, getBioFailCount, setBioFailCount, getBioLockedUntil, setBioLockedUntil, clearBioFail, verifyPinOnline, saveLocalPinHash, unlockWithPinLocal } from './utils/api.js';

import { SvgIcon } from './components/Icons.jsx';
import { CategorySelectPair } from './components/CategorySelectPair.jsx';
import { AddTransactionForm } from './components/AddTransactionForm.jsx';
import { EditTransactionModal } from './components/EditTransactionModal.jsx';
import { EditGroupParentModal } from './components/EditGroupParentModal.jsx';
import { ChangePinModal } from './components/ChangePinModal.jsx';
import { ProxyNotification } from './components/ProxyNotification.jsx';

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
  const [txCache, setTxCache] = useState(() => safeArrayLS(LS.txCache));
  const [trashCache, setTrashCache] = useState(() => safeArrayLS(LS.trashCache));
  const [syncQueue, setSyncQueue] = useState(() => safeArrayLS(LS.pending));
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
  const [historyVisibleCount, setHistoryVisibleCount] = useState(20);
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

  useEffect(() => { txCacheRef.current = txCache; }, [txCache]);
  useEffect(() => { trashCacheRef.current = trashCache; }, [trashCache]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  const showStatus = useCallback((type, text) => { setStatusMsg({ type, text }); setTimeout(() => setStatusMsg({ type: "", text: "" }), 3000); }, []);
  const forceReloginForToken = useCallback(() => { clearDeviceToken(); setCurrentUser(null); setSelectingUser(null); setPinInput(""); setBootstrapSecret(""); setShowBootstrapModal(true); }, []);
  const bioBound = currentUser ? isDeviceBioBound(currentUser.name) : false;

  useEffect(() => {
    if (pinInput.length === 6 && selectingUser) {
      const verifyEnteredPin = async () => {
        const n = pinInput;
        try {
          if (isOnline) {
            if (!deviceValid()) { showStatus("error", "雲端尚未綁定，請先輸入雲端密碼"); setShowBootstrapModal(true); setPinInput(""); return; }
            setLoadingCard({ show:true, text:"正在驗證..." }); 
            await verifyPinOnline(selectingUser.name, n); 
            await saveLocalPinHash(selectingUser.name, n);
            setLoadingCard({ show:false, text:"" });
            setCurrentUser(selectingUser); setSelectingUser(null); setPinInput(""); setFallbackToPin(false);
          } else {
            const ok = await unlockWithPinLocal(selectingUser.name, n);
            if (!ok) { showStatus("error", "PIN 錯誤，或您尚未在有網路時登入過"); setPinInput(""); return; }
            setCurrentUser(selectingUser); setSelectingUser(null); setPinInput(""); setFallbackToPin(false);
          }
        } catch (e) {
          setLoadingCard({ show:false, text:"" });
          const msg = e.message || "PIN 錯誤";
          if (msg.includes("憑證") || msg.includes("無效") || msg.includes("過期") || msg.includes("重新綁定")) { showStatus("error", "❌ 雲端憑證無效，請重新綁定"); forceReloginForToken(); } else { showStatus("error", msg); setPinInput(""); }
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
      const idStr = atob(base64Id); const idArray = new Uint8Array(idStr.length); for (let i=0;i<idStr.length;i++) idArray[i] = idStr.charCodeAt(i);
      const challenge = new Uint8Array(32); window.crypto.getRandomValues(challenge);
      // @ts-ignore
      await navigator.credentials.get({ publicKey: { challenge, allowCredentials: [{ type:"public-key", id:idArray }], userVerification: "required" } });
      clearBioFail(name); return true;
    } catch (e) {
      const fail = getBioFailCount(name) + 1; setBioFailCount(name, fail); const left = Math.max(0, 5 - fail); 
      if (left <= 0) { setBioLockedUntil(name, Date.now() + 30000); showStatus("error", `驗證失敗，已暫停 30 秒`); } else { setBioLockedUntil(name, Date.now() + 30000); showStatus("error", `驗證失敗，剩餘 ${left} 次`); }
      return false;
    }
  };

  const handleUserClick = async (user) => {
    setSelectingUser(user); setPinInput(""); setFallbackToPin(false);
    if (biometricAvailable && isDeviceBioBound(user.name)) {
      const ok = await handleBioLoginLocal(user.name);
      if (ok) { setCurrentUser(user); setSelectingUser(null); setPinInput(""); } else { setFallbackToPin(true); }
    }
  };

  const bindDeviceBio = async () => {
    if (!window.PublicKeyCredential) { showStatus("error","不支援生物辨識"); return; }
    try {
      setLoadingCard({ show:true, text:"正在綁定設備..." });
      const challenge = new Uint8Array(32); crypto.getRandomValues(challenge); const userID = new Uint8Array(16); crypto.getRandomValues(userID);
      // @ts-ignore
      const cred = await navigator.credentials.create({ publicKey: { challenge, rp: { name:"家庭記帳" }, user: { id:userID, name: currentUser.name, displayName: currentUser.name }, pubKeyCredParams: [{ type:"public-key", alg:-7 }, { type:"public-key", alg:-257 }], authenticatorSelection: { authenticatorAttachment:"platform", userVerification:"required" }, timeout: 60000 } });
      localStorage.setItem(getBioKey(currentUser.name), btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(cred.rawId)))));
      clearBioFail(currentUser.name); showStatus("success","✅ 設備已綁定");
    } catch { showStatus("error","綁定失敗或已取消"); } finally { setLoadingCard({ show:false, text:"" }); }
  };

  const unbindDeviceBio = async () => {
    if (unbindPin.length !== 6) { showStatus("error","請輸入 6 位 PIN"); return; }
    if (!isOnline) { showStatus("error","需連線驗證 PIN 才能解除"); return; }
    if (!deviceValid()) { showStatus("error","雲端憑證已過期，請先綁定雲端"); return; }
    try {
      setLoadingCard({ show:true, text:"正在驗證..." }); await verifyPinOnline(currentUser.name, unbindPin);
      localStorage.removeItem(getBioKey(currentUser.name)); clearBioFail(currentUser.name); setShowUnbindModal(false); setUnbindPin(""); showStatus("success","✅ 已解除綁定");
    } catch (e) {
      setLoadingCard({ show:false, text:"" }); const msg = e.message || "PIN 錯誤";
      if (msg.includes("憑證") || msg.includes("無效") || msg.includes("過期") || msg.includes("重新綁定")) { showStatus("error", "❌ 雲端憑證無效，請重新綁定"); forceReloginForToken(); } else { showStatus("error", msg); }
    } finally { setLoadingCard({ show:false, text:"" }); }
  };

  useEffect(() => { if (activeTab === "analysis") { setAnimTrigger(false); const timer = setTimeout(() => setAnimTrigger(true), 50); return () => clearTimeout(timer); } }, [activeTab, analysisType, analysisDateFilter]);
  
  useEffect(() => {
    const handleNetworkChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleNetworkChange); window.addEventListener('offline', handleNetworkChange);
    window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') handleNetworkChange(); });
    window.addEventListener('focus', handleNetworkChange);
    return () => { window.removeEventListener('online', handleNetworkChange); window.removeEventListener('offline', handleNetworkChange); window.removeEventListener('visibilitychange', handleNetworkChange); window.removeEventListener('focus', handleNetworkChange); };
  }, []);

  const prevOnline = useRef(navigator.onLine);
  useEffect(() => {
      if (prevOnline.current !== isOnline) {
          if (isOnline) { showStatus("success", "🌐 網路已連線"); if (syncQueue.length > 0) requestSync(false, true); } 
          else { showStatus("info", "⚠️ 已進入離線模式 (變更將暫存手機)"); }
          prevOnline.current = isOnline;
      }
  }, [isOnline, syncQueue]);

  useEffect(() => localStorage.setItem(LS.pending, JSON.stringify(syncQueue || [])), [syncQueue]);
  useEffect(() => localStorage.setItem(LS.members, JSON.stringify(familyConfig || [])), [familyConfig]);
  useEffect(() => localStorage.setItem(LS.lastSync, lastSyncText), [lastSyncText]);
  useEffect(() => localStorage.setItem(LS.greetingsCache, JSON.stringify(greetingsCache || {})), [greetingsCache]);
  useEffect(() => { loadFromIndexedDB().then(idbData => { if (idbData && idbData.length > 0) setTxCache(idbData); }); }, []);
  useEffect(() => { if (currentUser && greetingsCache && greetingsCache[currentUser.name]) setCustomSubtitle(String(greetingsCache[currentUser.name])); else if (currentUser) setCustomSubtitle("{name}，你好！"); }, [currentUser, greetingsCache]);
  useEffect(() => { const timer = setTimeout(() => { setDebouncedHistorySearch(historySearch); setDebouncedHistoryExcludeSearch(historyExcludeSearch); }, 350); return () => clearTimeout(timer); }, [historySearch, historyExcludeSearch]);
  useEffect(() => setHistoryVisibleCount(20), [debouncedHistorySearch, debouncedHistoryExcludeSearch, historyTypeFilter, historyDateFilter, activeTab]);
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

  const applyCloudData = useCallback((data) => {
    let formatted = (data.transactions || []).map((t, i) => {
      const rawDate = t["日期時間"] || t["日期"] || ""; const cleanStr = String(rawDate).replace(/上午|下午|AM|PM/gi, "").trim().replace(/-/g, "/").replace("T", " "); const ts = new Date(cleanStr).getTime() || 0;
      return {
        id: t.id || t["ID"] || String(i), amount: parseFloat(t["金額"]) || 0, category: String(t["類別"] || "其他"), date: rawDate, timestamp: ts, 
        member: String(t["成員"] || "未知"), recorder: String(t["記錄者"] || "系統"), desc: String(t.desc || t["備註"] || ""), type: String(t.type || t["類型"] || "expense"), 
        groupId: String(t.groupId || t["GroupID"] || ""), parentDesc: String(t.parentDesc || t["ParentDesc"] || ""), beneficiary: String(t.beneficiary || t["Beneficiary"] || t.member || t["成員"] || "未知"),
        editHistory: Array.isArray(t.editHistory) ? t.editHistory : (t["EditHistory"] || [])
      };
    }).filter(t => t && t.id && t.id !== "undefined").sort((a,b) => b.timestamp - a.timestamp || String(b.id).localeCompare(String(a.id)));
    
    let formattedTrash = (data.trash || []).map((t, i) => {
      const rawDate = t["日期時間"] || t["日期"] || ""; const cleanStr = String(rawDate).replace(/上午|下午|AM|PM/gi, "").trim().replace(/-/g, "/").replace("T", " "); const ts = new Date(cleanStr).getTime() || 0;
      return {
        id: t.id || t["ID"] || String(i), amount: parseFloat(t["金額"]) || 0, category: String(t["類別"] || "其他"), date: rawDate, timestamp: ts, 
        member: String(t["成員"] || "未知"), recorder: String(t["記錄者"] || "系統"), desc: String(t.desc || t["備註"] || ""), type: String(t.type || t["類型"] || "expense"), 
        groupId: String(t.groupId || t["GroupID"] || ""), parentDesc: String(t.parentDesc || t["ParentDesc"] || ""), beneficiary: String(t.beneficiary || t["Beneficiary"] || t.member || t["成員"] || "未知")
      };
    });

    let changed = false;
    const oldStr = JSON.stringify(txCacheRef.current || []); const newStr = JSON.stringify(formatted);
    if (oldStr !== newStr) { setTxCache(formatted); setLastSyncText(nowStr()); if (data.greetings) setGreetingsCache(data.greetings); saveToIndexedDB(formatted); localStorage.setItem(LS.txCache, newStr); changed = true; }
    const oldTrashStr = JSON.stringify(trashCacheRef.current || []); const newTrashStr = JSON.stringify(formattedTrash);
    if (oldTrashStr !== newTrashStr) { setTrashCache(formattedTrash); localStorage.setItem(LS.trashCache, newTrashStr); changed = true; }
    return changed;
  }, []);

  const silentPollEngine = useCallback(async () => {
      if (!navigator.onLine || !currentUserRef.current || isSyncingRef.current) { pollingTimerRef.current = setTimeout(silentPollEngine, 5000); return; }
      if (!deviceValid()) { forceReloginForToken(); return; }
      try { const data = await postGAS({ action:"GET_TX", deviceToken: getDeviceToken() }); if (data.result === "success") { if (applyCloudData(data)) showStatus("success", "🔄 已載入雲端最新資料"); } } 
      catch (e) { if (e.message && (e.message.includes("憑證") || e.message.includes("無效") || e.message.includes("過期"))) forceReloginForToken(); }
      pollingTimerRef.current = setTimeout(silentPollEngine, 5000);
  }, [forceReloginForToken, applyCloudData, showStatus]);

  const syncManager = useCallback(async (isSilent = false) => {
      if (!navigator.onLine || !deviceValid() || isSyncingRef.current) return;
      isSyncingRef.current = true; if (!isSilent) setIsSyncing(true);
      try {
          const currentQueue = safeParse(localStorage.getItem(LS.pending), []).filter(Boolean);
          let sentQueueCount = currentQueue.length;
          if (sentQueueCount > 0) {
              const res = await postGAS({ action: "BATCH_PROCESS", operations: currentQueue, deviceToken: getDeviceToken() });
              if (res.result !== "success") throw new Error(res.message || "批次同步處理失敗");
              setSyncQueue(prev => {
                  const sentOpIds = currentQueue.map(q => q.opId).filter(Boolean);
                  const nextQ = prev.filter(Boolean).filter(p => p.opId ? !sentOpIds.includes(p.opId) : !currentQueue.find(c => (c.id === p.id && c.action === p.action) || (c.groupId && c.groupId === p.groupId && c.action === p.action)));
                  localStorage.setItem(LS.pending, JSON.stringify(nextQ)); return nextQ;
              });
              if (!isSilent) {
                  const adds = currentQueue.filter(q => q.action === 'ADD').length; const upds = currentQueue.filter(q => q.action.includes('UPDATE')).length; const dels = currentQueue.filter(q => q.action.includes('DELETE')).length;
                  let txt = []; if (adds) txt.push(`新增 ${adds} 筆`); if (upds) txt.push(`修改 ${upds} 筆`); if (dels) txt.push(`刪除 ${dels} 筆`);
                  if (sentQueueCount > 1) showStatus("success", `☁️ 雲端同步完成 (${txt.join('、')})`); else showStatus("success", adds > 0 ? "✅ 已同步至雲端" : upds > 0 ? "✅ 更新已同步" : "🗑️ 操作已完成");
              }
              if (res.transactions) applyCloudData(res);
          } else {
              const res = await postGAS({ action: "GET_TX", deviceToken: getDeviceToken() });
              if (res.result !== "success") throw new Error(res.message || "拉取失敗");
              if (res.transactions) { applyCloudData(res); if (isSilent) showStatus("success", "🔄 已載入雲端最新資料"); else showStatus("success", "✅ 已是最新資料"); }
          }
      } catch (e) {
          const msg = e.message || "未知錯誤";
          if (msg.includes("憑證") || msg.includes("過期") || msg.includes("無效")) forceReloginForToken(); else if (!isSilent) showStatus("error", `❌ 同步失敗: ${msg}`);
      } finally {
          isSyncingRef.current = false; setIsSyncing(false);
          const leftoverQueue = safeParse(localStorage.getItem(LS.pending), []);
          if (leftoverQueue.length > 0 && navigator.onLine) setTimeout(() => requestSync(false, true), 100);
      }
  }, [forceReloginForToken, applyCloudData, showStatus]);

  const requestSync = useCallback((isSilent = false, immediate = false) => {
      if (!navigator.onLine) return;
      if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
      if (immediate) syncManager(isSilent); else syncDebounceRef.current = setTimeout(() => syncManager(isSilent), 1000); 
  }, [syncManager]);

  const processRef = useRef(requestSync);
  useEffect(() => { processRef.current = requestSync; }, [requestSync]);

  const prevOnlineEffect = useRef(navigator.onLine);
  useEffect(() => {
      if (prevOnlineEffect.current !== isOnline) {
          if (isOnline) { showStatus("success", "🌐 網路已連線"); if (syncQueue.length > 0) requestSync(false, true); } 
          else { showStatus("info", "⚠️ 已進入離線模式 (變更將暫存手機)"); }
          prevOnlineEffect.current = isOnline;
      }
  }, [isOnline, syncQueue, requestSync]);

  useEffect(() => {
    if (isOnline && currentUser) {
        const currentQ = safeParse(localStorage.getItem(LS.pending), []);
        if (currentQ.length === 0) silentPollEngine(); else { if (processRef.current) processRef.current(false, true); pollingTimerRef.current = setTimeout(silentPollEngine, 5000); }
    }
    return () => { if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current); };
  }, [isOnline, currentUser, silentPollEngine]); 

  const handleSyncClick = () => requestSync(false, true); 
  const refreshDeviceToken = async () => { const data = await postGAS({ action: "DEVICE_REFRESH", deviceToken: getDeviceToken() }); if (data.result !== "success") throw new Error(data.message || "憑證已過期"); setDeviceToken(data.deviceToken, data.deviceExp); return data; };
  const bootstrapDevice = async () => { if (!bootstrapSecret) throw new Error("請輸入雲端密碼"); const data = await postGAS({ action: "DEVICE_BOOTSTRAP", appSecret: bootstrapSecret }); if (data.result !== "success") throw new Error(data.message || "綁定失敗"); setDeviceToken(data.deviceToken, data.deviceExp); return data; };

  const handleSaveGreeting = async () => {
     if (!isOnline || !deviceValid()) { showStatus("error", "需連線才能儲存問候語"); return; }
     try { setLoadingCard({ show:true, text:"正在儲存..." }); await refreshDeviceToken(); const res = await postGAS({ action: "UPDATE_GREETING", name: currentUser.name, greeting: customSubtitle, deviceToken: getDeviceToken() }); if (res.result !== "success") throw new Error(res.message); setGreetingsCache(prev => ({...prev, [currentUser.name]: customSubtitle})); showStatus("success", "✅ 問候語已更新"); } 
     catch (e) { setLoadingCard({ show:false, text:"" }); const msg = e.message || "儲存失敗"; if (msg.includes("憑證") || msg.includes("無效") || msg.includes("過期") || msg.includes("重新綁定")) { showStatus("error", "❌ 雲端憑證無效，請重新綁定"); forceReloginForToken(); } else { showStatus("error", msg); } } 
     finally { setLoadingCard({ show:false, text:"" }); }
  };

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
        if (pendingUpdate) mod = { ...mod, ...pendingUpdate };
        return mod;
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
    if (!currentUser) return []; return (visibleTransactions || []).filter(t => t.member === currentUser.name);
  }, [visibleTransactions, currentUser]);

  const appendToQueueAndSync = (newItemList) => {
      let currentQ = [...(syncQueue || [])].filter(Boolean);
      newItemList.forEach(newItem => {
          const newOpId = Date.now() + '_' + Math.random().toString(36).substring(2, 9);
          const idx = currentQ.findIndex(p => String(p.id) === String(newItem.id) && p.action !== "UPDATE_GROUP_PARENT");
          if (idx >= 0) {
              if (currentQ[idx].action === "ADD" && newItem.action === "DELETE_TX") { currentQ = currentQ.filter((_, i) => i !== idx); } 
              else { currentQ[idx] = { ...newItem, action: currentQ[idx].action === 'ADD' ? 'ADD' : newItem.action, opId: newOpId }; }
          } else { currentQ.push({ ...newItem, opId: newOpId }); }
      });
      setSyncQueue(currentQ); localStorage.setItem(LS.pending, JSON.stringify(currentQ));
      if (!navigator.onLine) showStatus("info", `💾 已暫存於本機 (離線中)`); else requestSync(false, false); 
  };

  const handleAdd = async (newTxs) => {
    const baseDate = newTxs[0].date ? newTxs[0].date.replace("T"," ").replace(/-/g,"/") : nowStr();
    const baseTimestamp = Date.now(); const isMulti = newTxs.length > 1; const randomSuffix = () => Math.random().toString(36).substring(2, 8);
    const groupId = isMulti ? `G_${baseTimestamp}_${currentUser.name}_${randomSuffix()}` : ""; const parentDesc = isMulti ? newTxs[0].parentDesc : "";
    const isOfflineOp = !navigator.onLine;
    const completeTxs = newTxs.map((tx, idx) => ({ ...tx, date: baseDate, recorder: currentUser.name, id: `${baseTimestamp + idx}_${currentUser.name}_${randomSuffix()}`, groupId, parentDesc, isOffline: isOfflineOp, action: "ADD" }));
    setActiveTab("dashboard"); appendToQueueAndSync(completeTxs);
  };

  const handleUpdateTx = async (updatedTx) => {
    let fd = updatedTx.date; if (fd && fd.includes("T")) fd = fd.replace("T"," ").replace(/-/g,"/").slice(0, 16);
    const newHist = [...(updatedTx.editHistory || []), { time: nowStr(), action: "編輯紀錄 (同步中)" }];
    appendToQueueAndSync([{ ...updatedTx, date: fd, editHistory: newHist, isOffline: !navigator.onLine, action: "UPDATE_TX" }]); setEditingTx(null);
  };

  const handleUpdateGroupParent = async (groupData) => {
    let fd = groupData.date; if (fd && fd.includes("T")) fd = fd.replace("T"," ").replace(/-/g,"/").slice(0, 16);
    let currentQ = [...(syncQueue || [])].filter(Boolean);
    const newOpId = Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const newHist = [...(groupData.editHistory || []), { time: nowStr(), action: "編輯紀錄 (同步中)" }];
    const newItem = { ...groupData, date: fd, editHistory: newHist, isOffline: !navigator.onLine, action: "UPDATE_GROUP_PARENT", opId: newOpId };
    const idx = currentQ.findIndex(p => p.action === "UPDATE_GROUP_PARENT" && String(p.groupId) === String(newItem.groupId));
    if (idx >= 0) { currentQ[idx] = newItem; } else { currentQ.push(newItem); }
    setSyncQueue(currentQ); localStorage.setItem(LS.pending, JSON.stringify(currentQ)); setEditingGroup(null);
    if (!navigator.onLine) showStatus("info", `💾 已暫存於本機 (離線中)`); else requestSync(false, false);
  };

  const handleDeleteTx = async (id) => {
    const txToDelete = (visibleTransactions || []).find(t => String(t.id) === String(id)) || (txCache || []).find(t => String(t.id) === String(id)); 
    if (!txToDelete) return; appendToQueueAndSync([{ ...txToDelete, isOffline: !navigator.onLine, action: "DELETE_TX" }]); setEditingTx(null);
  };

  const handleRestoreTrash = (tx) => { const newOpId = Date.now() + '_' + Math.random().toString(36).substring(2, 9); appendToQueueAndSync([{ ...tx, isOffline: !navigator.onLine, action: "RESTORE_TX", opId: newOpId }]); showStatus("success", "🔄 已加入復原排程"); };
  const handleHardDeleteTrash = (tx) => { const newOpId = Date.now() + '_' + Math.random().toString(36).substring(2, 9); appendToQueueAndSync([{ ...tx, isOffline: !navigator.onLine, action: "HARD_DELETE_TX", opId: newOpId }]); setConfirmHardDeleteId(null); };
  const handleEmptyTrash = () => { const ops = visibleTrash.map(tx => ({ ...tx, isOffline: !navigator.onLine, action: "HARD_DELETE_TX", opId: Date.now() + '_' + Math.random().toString(36).substring(2, 9) })); appendToQueueAndSync(ops); setShowConfirmEmptyTrash(false); setShowTrashModal(false); showStatus("success", "🗑️ 已清空資源回收桶"); };

  const currentCycleRange = useMemo(() => { return getCycleRange(new Date(), billingStartDay, 0); }, [billingStartDay]);

  const stats = useMemo(() => {
    let income = 0; let expense = 0;
    (myTransactions || []).forEach(t => {
       if (pendingMap[t.id] === 'DELETE_TX' || pendingMap[t.id] === 'HARD_DELETE_TX') return;
       const txTime = parseDateForSort(t);
       if (txTime >= currentCycleRange.start && txTime <= currentCycleRange.end) { if (t.type === "income") income += (Number(t.amount) || 0); if (t.type === "expense") expense += (Number(t.amount) || 0); }
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
      } else { grouped.push({ ...tx, isGroup: false }); }
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
      if (historyDateFilter === "current_month") { const range = getCycleRange(now, billingStartDay, 0); startTime = range.start; endTime = range.end; } 
      else if (historyDateFilter === "last_month") { const range = getCycleRange(now, billingStartDay, -1); startTime = range.start; endTime = range.end; } 
      else {
          endTime = now.getTime(); const cutoff = new Date();
          if (historyDateFilter === "7d") cutoff.setDate(now.getDate() - 7); else if (historyDateFilter === "14d") cutoff.setDate(now.getDate() - 14); else if (historyDateFilter === "1m") cutoff.setMonth(now.getMonth() - 1);
          else if (historyDateFilter === "3m") cutoff.setMonth(now.getMonth() - 3); else if (historyDateFilter === "6m") cutoff.setMonth(now.getMonth() - 6); else if (historyDateFilter === "1y") cutoff.setFullYear(now.getFullYear() - 1);
          startTime = cutoff.getTime();
      }
    }
    const searchTxt = debouncedHistorySearch.trim(); const dateRangeRegex = /^(\d{4}\/\d{1,2}\/\d{1,2})\s*-\s*(\d{4}\/\d{1,2}\/\d{1,2})$/; const match = searchTxt.match(dateRangeRegex);
    if (match) { const startTimestamp = new Date(`${match[1]} 00:00:00`).getTime(); const endTimestamp = new Date(`${match[2]} 23:59:59`).getTime(); if (!isNaN(startTimestamp) && !isNaN(endTimestamp)) { startTime = startTimestamp; endTime = endTimestamp; } }

    if (startTime > 0 || endTime < Infinity) {
         let filteredList = [];
         for (const item of list) {
             if (item.isGroup) {
                 const validChildren = (item.children || []).filter(child => { const txTime = parseDateForSort(child); return txTime >= startTime && txTime <= endTime; });
                 if (validChildren.length > 0) {
                     let newAmount = 0; validChildren.forEach(c => { if(pendingMap[c.id] !== 'DELETE_TX' && pendingMap[c.id] !== 'HARD_DELETE_TX') newAmount += Number(c.amount || 0); });
                     filteredList.push({ ...item, children: validChildren, amount: newAmount, date: validChildren[0].date });
                 }
             } else { const txTime = parseDateForSort(item); if (txTime >= startTime && txTime <= endTime) filteredList.push(item); }
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
        } else { return String(getParentCat(item.category)).toLowerCase().includes(q) || String(getChildCat(item.category)).toLowerCase().includes(q) || String(item.desc || "").toLowerCase().includes(q) || String(item.amount || "").includes(q) || String(item.date || "").includes(q) || String(item.beneficiary || "").toLowerCase().includes(q); }
      });
    }
    const excludeTxt = debouncedHistoryExcludeSearch.trim().toLowerCase();
    if (excludeTxt) {
       list = list.filter(item => {
        if (item.isGroup) {
          const groupMatch = String(item.parentTitle || "").toLowerCase().includes(excludeTxt) || String(item.parentDesc || "").toLowerCase().includes(excludeTxt) || String(item.amount || "").includes(excludeTxt) || String(item.date || "").includes(excludeTxt);
          const childMatch = (item.children || []).some(tx => String(getParentCat(tx.category)).toLowerCase().includes(excludeTxt) || String(getChildCat(tx.category)).toLowerCase().includes(excludeTxt) || String(tx.desc || "").toLowerCase().includes(excludeTxt) || String(tx.amount || "").includes(excludeTxt) || String(tx.beneficiary || "").toLowerCase().includes(excludeTxt));
          return !(groupMatch || childMatch);
        } else { return !(String(getParentCat(item.category)).toLowerCase().includes(excludeTxt) || String(getChildCat(item.category)).toLowerCase().includes(excludeTxt) || String(item.desc || "").toLowerCase().includes(excludeTxt) || String(item.amount || "").includes(excludeTxt) || String(item.date || "").includes(excludeTxt) || String(item.beneficiary || "").toLowerCase().includes(excludeTxt)); }
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

  const toggleGroup = (gId) => setExpandedGroups(p => ({ ...p, [gId]: !p[gId] }));

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
        <div className="flex-1 min-w-0 w-full bg-white p-4 rounded-3xl border border-gray-100 flex items-center gap-3 shadow-sm relative overflow-hidden transition-colors">
          <div className="relative shrink-0">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-[17px] leading-none ${tx.type==="income" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>{tx.type==="income" ? "收入" : "支出"}</div>
            {tx.member !== currentUser.name && ( <div className={`absolute -top-2 -left-2 text-[10px] font-black px-1.5 py-0.5 rounded-lg border-2 border-white shadow-sm ${tx.member === "爸爸" ? "bg-blue-600" : tx.member === "媽媽" ? "bg-pink-600" : "bg-gray-500"} text-white z-10`}>{tx.member}</div> )}
          </div>
          <div className="flex-1 min-w-0 pl-1">
            <div className="font-bold text-[14px] leading-tight text-gray-800 flex items-center gap-1.5 flex-wrap">
              <span className="truncate flex-shrink">{getParentCat(tx.category)} - {getChildCat(tx.category)}</span>
              <div className="flex gap-1 flex-wrap shrink-0">
                 {benArray.map(b => ( <span key={b} className={`text-[9px] px-1.5 py-0.5 rounded-md border font-black ${getBenBadgeStyle(b)}`}>{b}</span> ))}
              </div>
            </div>
            <div className="flex flex-col gap-1 mt-1.5 w-full items-start">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 font-medium leading-none">{displayDateClean(tx.date)}</span>
                {tx.editHistory && tx.editHistory.length > 0 && ( <button onClick={(e) => { e.stopPropagation(); setViewingHistoryItem(tx); }} className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-[9px] font-black border border-amber-200 active:scale-95 transition-transform">✏️ 已編輯</button> )}
              </div>
              {tx.desc && <span className="text-[11px] text-gray-600 font-bold bg-gray-50 px-2 py-1 rounded-lg whitespace-normal break-words w-full">{tx.desc}</span>}
            </div>
          </div>
          <div className="flex flex-col items-end justify-center shrink-0 pl-1 z-10">
            <div className={`font-black tabular-nums text-[17px] leading-none ${tx.type==="income" ? "text-green-600" : "text-red-600"}`}>${Number(tx.amount||0).toLocaleString()}</div>
            {tx.recorder && tx.recorder !== tx.member && ( <div className={`mt-2 text-[9px] font-black px-1.5 py-0.5 rounded-md border shadow-sm ${tx.recorder === "爸爸" ? "bg-blue-50 text-blue-600 border-blue-200" : tx.recorder === "媽媽" ? "bg-pink-50 text-pink-600 border-pink-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>✍️ {tx.recorder}代記</div> )}
          </div>
          {allowEdit && pAction !== 'DELETE_TX' && pAction !== 'HARD_DELETE_TX' && (
            <button onClick={(e) => { e.stopPropagation(); setEditingTx(tx); }} className="absolute bottom-2 right-2 p-1.5 text-gray-300 hover:text-blue-500 active:text-blue-600 active:scale-90 transition-all"><SvgIcon name="edit" size={13} /></button>
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
    const gAction = pendingMap[group.groupId]; const hasChildAction = (group.children || []).some(c => pendingMap[c.id]);
    const isPendingDeleteGroup = (group.children || []).every(c => pendingMap[c.id] === 'DELETE_TX' || pendingMap[c.id] === 'HARD_DELETE_TX');

    return (
      <div key={group.groupId} className={`flex items-stretch gap-2 mb-3 transition-opacity ${isPendingDeleteGroup ? 'opacity-40 grayscale' : 'opacity-100'}`}>
        {(gAction || hasChildAction) && (
            <div className={`shrink-0 w-6 flex items-center justify-center rounded-3xl shadow-sm border ${gAction==='UPDATE_GROUP_PARENT'?'bg-purple-50 border-purple-200 text-purple-700': isPendingDeleteGroup ? 'bg-red-50 border-red-200 text-red-700' : hasChildAction?'bg-gray-100 border-gray-200 text-gray-600':'bg-blue-50 border-blue-200 text-blue-700'}`}>
                <span className="text-[10px] font-black tracking-widest" style={{writingMode: 'vertical-rl'}}>{isPendingDeleteGroup?'待處理':gAction==='UPDATE_GROUP_PARENT'?'待處理': '待處理'}</span>
            </div>
        )}
        <div className="flex-1 min-w-0 w-full bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-300">
          <div onClick={() => toggleGroup(group.groupId)} className="p-4 flex items-center gap-3 cursor-pointer active:bg-gray-50 transition-colors relative">
            <div className="relative shrink-0">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-[17px] leading-none ${group.type==="income" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>{group.type==="income" ? "收入" : "支出"}</div>
              <div className="absolute -bottom-1 -right-1 bg-gray-800 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md border-2 border-white shadow-sm z-10">多筆</div>
              {group.member !== currentUser.name && ( <div className={`absolute -top-2 -left-2 text-[10px] font-black px-1.5 py-0.5 rounded-lg border-2 border-white shadow-sm ${group.member === "爸爸" ? "bg-blue-600" : group.member === "媽媽" ? "bg-pink-600" : "bg-gray-500"} text-white z-10`}>{group.member}</div> )}
            </div>
            <div className="flex-1 min-w-0 pl-1">
              <div className="font-bold text-[14px] leading-tight text-gray-800 flex items-center gap-1.5 flex-wrap">
                <span className="truncate flex-shrink">{group.parentTitle}</span>
                <div className="flex gap-1 flex-wrap shrink-0">{parentBenArray.map(b => ( <span key={b} className={`text-[9px] px-1.5 py-0.5 rounded-md border font-black ${getBenBadgeStyle(b)}`}>{b}</span> ))}</div>
                <span className={`text-[10px] text-gray-400 transform transition-transform duration-300 shrink-0 ${isExp ? 'rotate-180' : ''}`}>▼</span>
              </div>
              <div className="flex flex-col gap-1 mt-1 w-full items-start">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 font-medium leading-none">{displayDateClean(group.date)}</span>
                  {group.editHistory && group.editHistory.length > 0 && ( <button onClick={(e) => { e.stopPropagation(); setViewingHistoryItem(group); }} className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-[9px] font-black border border-amber-200 active:scale-95 transition-transform">✏️ 已編輯</button> )}
                </div>
                {group.parentDesc && <span className="text-[11px] text-gray-600 font-bold bg-gray-50 px-2 py-1 rounded-lg whitespace-normal break-words w-full">{group.parentDesc}</span>}
              </div>
            </div>
            <div className="flex flex-col items-end justify-center shrink-0 pl-1 z-10">
              <div className={`font-black tabular-nums text-lg leading-none ${group.type==="income" ? "text-green-600" : "text-red-600"}`}>${Number(group.amount||0).toLocaleString()}</div>
              {group.recorder && group.recorder !== group.member && ( <div className={`mt-2 text-[9px] font-black px-1.5 py-0.5 rounded-md border shadow-sm ${group.recorder === "爸爸" ? "bg-blue-50 text-blue-600 border-blue-200" : group.recorder === "媽媽" ? "bg-pink-50 text-pink-600 border-pink-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>✍️ {group.recorder}代記</div> )}
            </div>
            {allowEdit && !isPendingDeleteGroup && ( <button onClick={(e) => { e.stopPropagation(); setEditingGroup(group); }} className="absolute bottom-2 right-2 p-1.5 text-gray-300 hover:text-blue-500 active:text-blue-600 active:scale-90 transition-all"><SvgIcon name="edit" size={13} /></button> )}
          </div>

          {isExp && (
            <div className="bg-gray-50/80 p-3 flex flex-col gap-2 border-t-2 border-gray-100 shadow-inner">
              {(group.children || []).map((child, idx) => {
                const childBenArray = getBenArray(child.beneficiary, group.member); const cAction = pendingMap[child.id];
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
                    {allowEdit && cAction !== 'DELETE_TX' && cAction !== 'HARD_DELETE_TX' && ( <button onClick={(e) => { e.stopPropagation(); setEditingTx(child); }} className="absolute bottom-1 right-1.5 p-1.5 text-gray-300 hover:text-blue-500 active:text-blue-600 active:scale-90 transition-all"><SvgIcon name="edit" size={11} /></button> )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderItemOrGroup = (item, allowEdit) => { if (item.isGroup) return renderGroupCard(item, allowEdit); return renderStandaloneCard(item, allowEdit); };
  const setQuickDateFilter = (filterVal) => { setHistoryDateFilter(filterVal); setAnalysisDateFilter(filterVal); setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null); };

  const isHistoryFiltered = debouncedHistorySearch || debouncedHistoryExcludeSearch || historyTypeFilter !== "all" || historyDateFilter !== "all";

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-8 animate-in relative w-full text-center font-black">
        {!selectingUser ? (
          <>
            <div className="mb-12 text-white animate-in">
              <div className="bg-blue-600 w-20 h-20 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/30 text-white"><SvgIcon name="wallet" size={36} /></div>
              <h1 className="text-4xl font-black italic tracking-tighter">家庭記帳</h1>
              <p className="text-gray-500 text-[10px] font-mono mt-4 opacity-50 uppercase tracking-[0.3em]">v{APP_VERSION}</p>
            </div>
            <div className="grid grid-cols-1 gap-6 w-full max-w-xs text-white animate-in">
              {(familyConfig || []).map(user => ( <button key={user.name} onClick={() => handleUserClick(user)} className={`bg-${user.color ? user.color.replace('bg-', '') : (user.name==="媽媽"?"pink-600":"blue-600")} py-6 rounded-[2.5rem] font-black text-2xl shadow-lg border-4 border-white/5 active:scale-95 transition-all text-white`}>{user.name}</button> ))}
            </div>
            {syncQueue && syncQueue.length > 0 && ( <button onClick={() => setShowClearQueueModal(true)} className="mt-10 px-4 py-2 bg-red-500/20 text-red-400 rounded-full text-xs font-bold border border-red-500/30 active:scale-95 transition-all">⚠️ 發現同步卡死？點此強制清除暫存</button> )}
            <button onClick={() => setShowClearCacheModal(true)} className="mt-6 px-4 py-2 text-gray-500 rounded-full text-xs font-bold active:scale-95 transition-all underline underline-offset-4">🛠️ 系統深度清理</button>
          </>
        ) : (
          <div className="w-full max-w-sm animate-in text-white text-center font-black">
            <div className="bg-gray-800 rounded-[2.5rem] p-8 shadow-2xl border border-white/10 relative">
              <div className={`bg-${selectingUser.color ? selectingUser.color.replace('bg-', '') : (selectingUser.name==="媽媽"?"pink-600":"blue-600")} w-16 h-16 mx-auto rounded-[1.5rem] flex items-center justify-center text-white font-black text-2xl shadow-lg mb-4`}>{selectingUser.name.charAt(0)}</div>
              <p className="font-black text-3xl mb-1 tracking-tight text-white">{selectingUser.name}</p>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest opacity-80 mb-8">{isDeviceBioBound(selectingUser.name) && !fallbackToPin ? "請進行生物辨識解鎖" : "輸入 6 位 PIN 解鎖"}</p>

              {isDeviceBioBound(selectingUser.name) && !fallbackToPin ? (
                <div className="flex flex-col items-center mb-8 animate-in">
                  <button onClick={async () => { const ok = await handleBioLoginLocal(selectingUser.name); if (ok) { setCurrentUser(selectingUser); setSelectingUser(null); setPinInput(""); } else { setFallbackToPin(true); } }} className="w-20 h-20 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center border-2 border-blue-500/50 mb-6 active:scale-95 transition-transform"><SvgIcon name="bio" size={36} /></button>
                  <button onClick={() => setFallbackToPin(true)} className="text-[11px] text-gray-400 underline underline-offset-4 font-bold active:text-white transition-colors">無法辨識？改用 PIN 碼登入</button>
                </div>
              ) : (
                <>
                  <div className="flex justify-center gap-3 mb-10">{[...Array(6)].map((_, i) => <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 border-blue-500 transition-all duration-200 ${pinInput.length > i ? "bg-blue-500 scale-125 shadow-[0_0_12px_#3b82f6]" : "bg-transparent"}`}></div>)}</div>
                  <div className="grid grid-cols-3 gap-3 mb-8 text-white">
                    {[1,2,3,4,5,6,7,8,9,"C",0,"←"].map(k => (
                      <button key={k} onClick={() => { if (k === "C") { setPinInput(""); return; } if (k === "←") { setPinInput(prev => prev.slice(0,-1)); return; } setPinInput(prev => prev.length < 6 ? prev + String(k) : prev); }} className="bg-white/5 h-16 rounded-2xl font-black text-2xl active:bg-blue-600 transition-all border border-white/5 text-white shadow-sm hover:bg-white/10">{k}</button>
                    ))}
                  </div>
                </>
              )}
              <button onClick={() => { setSelectingUser(null); setPinInput(""); setFallbackToPin(false); }} className="text-red-400 text-xs font-black uppercase tracking-widest underline underline-offset-4 active:text-red-300 transition-colors">返回成員列表</button>
            </div>
          </div>
        )}
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
                <button onClick={() => setShowClearQueueModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black active:scale-95">取消</button>
                <button onClick={() => { setSyncQueue([]); localStorage.removeItem(LS.pending); setShowClearQueueModal(false); showStatus("success", "✅ 已清空卡死的暫存資料"); }} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black active:scale-95 shadow-md shadow-red-500/30">確認清除</button>
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
                <button onClick={async () => { if (!cacheClearPassword) { showStatus("error", "請輸入雲端密碼"); return; } if (!navigator.onLine) { showStatus("error", "需連線才能驗證雲端密碼"); return; } try { setLoadingCard({ show: true, text: "正在驗證密碼並清理快取..." }); const res = await postGAS({ action: "DEVICE_BOOTSTRAP", appSecret: cacheClearPassword }); if (res.result !== "success") throw new Error("雲端密碼錯誤"); setTxCache([]); setSyncQueue([]); localStorage.clear(); const db = await initIndexedDB(); const tx = db.transaction(STORE_NAME, "readwrite"); tx.objectStore(STORE_NAME).clear(); if ('serviceWorker' in navigator) { const registrations = await navigator.serviceWorker.getRegistrations(); for (let r of registrations) await r.unregister(); } if ('caches' in window) { const cacheNames = await caches.keys(); for (let c of cacheNames) await caches.delete(c); } setShowClearCacheModal(false); setCacheClearPassword(""); showStatus("success", "✅ 快取已清空，正在重新下載..."); setTimeout(() => { window.location.reload(true); }, 1500); } catch(e) { showStatus("error", e.message || "驗證失敗"); } finally { setLoadingCard({ show: false, text: "" }); } }} disabled={isLoading} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black active:scale-95 shadow-md shadow-red-500/30 disabled:opacity-50">確認清空</button>
              </div>
            </div>
          </div>
        )}
        {statusMsg.text && (
          <div className="fixed bottom-12 left-0 right-0 flex justify-center z-[1000] pointer-events-none px-4 text-center">
            <div className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in pointer-events-auto ${statusMsg.type === "success" ? "bg-green-600 text-white" : statusMsg.type === "error" ? "bg-red-600 text-white" : statusMsg.type === "info" ? "bg-gray-800 text-white border border-gray-600" : "bg-blue-600 text-white"}`}>
              <span className="text-sm font-bold tracking-tight text-center">{statusMsg.text}</span>
            </div>
          </div>
        )}
        {loadingCard?.show && (
          <div className="fixed inset-0 z-[900] bg-gray-900/70 backdrop-blur-sm flex items-center justify-center p-8">
            <div className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 text-gray-900 shadow-2xl animate-in flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-4"><SvgIcon name="spinner" size={28} className="animate-spin text-blue-600"/></div>
              <div className="font-black text-lg">處理中</div>
              <div className="text-xs text-gray-500 mt-2 font-bold">{loadingCard.text || "請稍候..."}</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-28 max-w-md mx-auto relative flex flex-col overflow-x-hidden w-full text-left font-black">
      
      <ProxyNotification 
        transactions={unackedProxyTxs} 
        onAck={() => { 
          const acked = safeParse(localStorage.getItem(LS.ackProxyTxs), []); 
          const newAcked = [...new Set([...acked, ...unackedProxyTxs.map(t => t.id)])]; 
          localStorage.setItem(LS.ackProxyTxs, JSON.stringify(newAcked)); 
          setUnackedProxyTxs([]); 
        }} 
      />

      {editingTx && <EditTransactionModal tx={editingTx} loginUser={currentUser.name} onSave={handleUpdateTx} onDelete={handleDeleteTx} onCancel={() => { setEditingTx(null); }} />}
      {editingGroup && <EditGroupParentModal group={editingGroup} onSave={handleUpdateGroupParent} onCancel={() => setEditingGroup(null)} />}
      {showChangePinModal && <ChangePinModal currentUser={currentUser} onCancel={() => setShowChangePinModal(false)} onSuccess={() => {setShowChangePinModal(false); setCurrentUser(null); setSelectingUser(null); setPinInput(""); showStatus("success", "✅ 密碼已更新，請重新登入");}} forceReloginForToken={forceReloginForToken} />}
      
      {showTrashModal && (
        <div className="fixed inset-0 z-[600] bg-gray-900/90 backdrop-blur-sm overflow-y-auto flex flex-col items-center justify-center p-4 sm:p-6 animate-in font-black" onClick={(e) => { if(e.target === e.currentTarget) setShowTrashModal(false); }}>
          <div className="bg-white w-full max-w-sm relative rounded-[2.5rem] shadow-2xl overflow-hidden pb-6 flex flex-col max-h-[85vh]">
            <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>
            <button onClick={() => setShowTrashModal(false)} className="absolute top-4 right-4 text-gray-400 active:scale-90"><SvgIcon name="close" size={24} /></button>
            <div className="px-6 pt-6 pb-2"><h2 className="text-xl font-black text-gray-800 flex items-center gap-2"><SvgIcon name="trash" size={20} className="text-red-500" /> 資源回收桶</h2><p className="text-[10px] text-gray-500 mt-1">被刪除的紀錄會暫存於此，可手動復原。</p></div>
            <div className="flex-1 overflow-y-auto px-6 py-2 space-y-3 scrollbar-hide">
               {visibleTrash.length === 0 ? ( <div className="text-center text-gray-400 py-10 text-sm">回收桶是空的</div> ) : (
                   visibleTrash.map(tx => (
                       <div key={tx.id} className="bg-gray-50 p-3 rounded-2xl border border-gray-100 flex flex-col gap-2 relative overflow-hidden">
                           {pendingMap[tx.id] === 'DELETE_TX' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-400"></div>}
                           {pendingMap[tx.id] === 'HARD_DELETE_TX' && <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center"><span className="text-red-600 font-black text-xs border border-red-200 bg-red-50 px-2 py-1 rounded">刪除中...</span></div>}
                           {pendingMap[tx.id] === 'RESTORE_TX' && <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center"><span className="text-green-600 font-black text-xs border border-green-200 bg-green-50 px-2 py-1 rounded">復原中...</span></div>}
                           <div className="flex justify-between items-start">
                               <div><span className="text-xs font-black text-gray-800">{getParentCat(tx.category)} - {getChildCat(tx.category)}</span><div className="text-[10px] text-gray-400 mt-0.5">{displayDateClean(tx.date)}</div></div>
                               <span className={`font-black text-sm ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>${Number(tx.amount).toLocaleString()}</span>
                           </div>
                           {(tx.desc || tx.parentDesc) && <div className="text-[10px] text-gray-500 truncate bg-white px-2 py-1 rounded-lg border border-gray-100 mt-1">{tx.parentTitle ? tx.parentTitle + ' - ' : ''}{tx.desc || tx.parentDesc}</div>}
                           <div className="flex justify-end gap-2 mt-2">
                               {confirmHardDeleteId === tx.id ? ( <button onClick={() => handleHardDeleteTrash(tx)} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-black active:scale-95 shadow-sm transition-all">確認永久刪除</button> ) : ( <button onClick={() => setConfirmHardDeleteId(tx.id)} className="px-3 py-1.5 bg-white border border-gray-200 text-red-500 rounded-lg text-[10px] font-black active:scale-95 shadow-sm transition-all">永久刪除</button> )}
                               <button onClick={() => handleRestoreTrash(tx)} className="px-3 py-1.5 bg-green-50 border border-green-200 text-green-600 rounded-lg text-[10px] font-black active:scale-95 shadow-sm flex items-center gap-1 transition-all"><SvgIcon name="refresh" size={12}/> 復原</button>
                           </div>
                       </div>
                   ))
               )}
            </div>
            {visibleTrash.length > 0 && (
                <div className="px-6 mt-2 pt-3 border-t border-gray-100">
                    {!showConfirmEmptyTrash ? ( <button onClick={() => setShowConfirmEmptyTrash(true)} className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-black text-xs active:scale-95 transition-all border border-red-100">全部清空 (無法復原)</button> ) : (
                        <div className="bg-red-50 p-3 rounded-xl flex flex-col gap-2 border border-red-200 animate-in">
                            <span className="text-xs font-black text-red-600 text-center">確定要永久刪除所有紀錄嗎？</span>
                            <div className="flex gap-2">
                                <button onClick={() => setShowConfirmEmptyTrash(false)} className="flex-1 py-2 bg-white text-gray-600 rounded-lg font-black text-[10px] border border-gray-200 active:scale-95">取消</button>
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
                               <div className="flex justify-between items-center mb-3 pl-2 border-b border-gray-50 pb-2"><span className="font-black text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">{h.action.replace("修改明細", "編輯紀錄")}</span><span className="text-[9px] text-gray-400 font-bold">{h.time}</span></div>
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
                               ) : ( <div className="pl-1 mt-2 text-[10px] text-gray-500 bg-gray-50 p-2 rounded-xl border border-gray-100 whitespace-pre-wrap break-words"><div className="text-[9px] text-gray-400 mb-1">修改前備註：</div>{displayContent || '無變更內容或無法解析'}</div> )}
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
              <button onClick={() => { setShowPendingModal(false); requestSync(false, true); }} disabled={isSyncing} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black active:scale-95 shadow-xl shadow-blue-500/30 flex items-center justify-center gap-2 disabled:opacity-50">{isSyncing ? <SvgIcon name="spinner" size={20} className="animate-spin" /> : <SvgIcon name="cloudSync" size={20} />} {isSyncing ? "同步中..." : "立即同步至雲端"}</button>
          </div>
        </div>
      )}

      {showSearchFilterModal && (
        <div className="fixed inset-0 z-[500] bg-gray-900/90 backdrop-blur-sm overflow-y-auto flex flex-col items-center justify-center p-4 sm:p-6 animate-in font-black" onClick={(e) => { if(e.target === e.currentTarget) setShowSearchFilterModal(false); }}>
          <div className="w-full max-w-sm relative">
            <button onClick={() => setShowSearchFilterModal(false)} className="absolute -top-12 right-0 text-white p-2 active:scale-90 opacity-80 hover:opacity-100 transition"><SvgIcon name="close" size={32} /></button>
            <div className="bg-white p-5 sm:p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden pb-8">
              <div className="absolute top-0 left-0 w-full h-2 bg-blue-500"></div>
              <h2 className="text-xl font-black text-center mb-6 text-gray-800 pt-2">篩選與搜尋</h2>
              <div className="space-y-4 text-left">
                <div className="bg-gray-100 py-3 px-4 rounded-xl flex flex-col gap-1 border border-transparent focus-within:border-blue-200 transition-colors"><label className="text-[10px] font-black text-blue-500 uppercase tracking-widest shrink-0">包含關鍵字</label><input type="text" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="搜尋品項、金額或備註..." className="w-full bg-transparent font-black border-none outline-none text-gray-800 placeholder:text-gray-300 text-sm min-w-0" /></div>
                <div className="bg-gray-100 py-3 px-4 rounded-xl flex flex-col gap-1 border border-transparent focus-within:border-red-200 transition-colors"><label className="text-[10px] font-black text-red-500 uppercase tracking-widest shrink-0">排除關鍵字</label><input type="text" value={historyExcludeSearch} onChange={(e) => setHistoryExcludeSearch(e.target.value)} placeholder="排除不想看的內容..." className="w-full bg-transparent font-black border-none outline-none text-gray-800 placeholder:text-gray-300 text-sm min-w-0" /></div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <label className="text-[10px] font-black text-gray-400 uppercase block mb-2 tracking-widest">時間區間快捷篩選</label>
                    <div className="flex flex-wrap gap-2">{["all", "1m", "3m", "6m"].map(val => (<button key={val} onClick={() => setQuickDateFilter(val)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${historyDateFilter === val ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>{val === 'all' ? '全部' : val === '1m' ? '本期' : val === '3m' ? '近3期' : '近半年'}</button>))}</div>
                </div>
                <div className="flex gap-2">
                  <div className="bg-gray-100 p-2 px-3 rounded-xl flex-1 min-w-0 border border-transparent focus-within:border-blue-200 transition-colors"><label className="text-[8px] font-black text-gray-400 uppercase block mb-0.5 tracking-widest">收支類型</label><select value={historyTypeFilter} onChange={(e) => setHistoryTypeFilter(e.target.value)} className="w-full bg-transparent border-none outline-none appearance-none font-black text-sm text-gray-800"><option value="all">全部收支</option><option value="expense">僅支出</option><option value="income">僅收入</option></select></div>
                  <div className="bg-gray-100 p-2 px-3 rounded-xl flex-1 min-w-0 border border-transparent focus-within:border-blue-200 transition-colors"><label className="text-[8px] font-black text-gray-400 uppercase block mb-0.5 tracking-widest">精細時間設定</label><select value={historyDateFilter} onChange={(e) => setHistoryDateFilter(e.target.value)} className="w-full bg-transparent border-none outline-none appearance-none font-black text-sm text-gray-800 truncate"><option value="all">全部時間</option><option value="current_month">本期</option><option value="last_month">上期</option><option value="1m">近一期</option><option value="3m">近 3 期</option><option value="6m">近半年</option><option value="1y">近 1 年</option></select></div>
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button onClick={() => { setHistorySearch(""); setHistoryExcludeSearch(""); setHistoryTypeFilter("all"); setHistoryDateFilter("all"); }} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black active:scale-95 transition-all flex items-center justify-center gap-1">清空條件</button>
                <button onClick={() => setShowSearchFilterModal(false)} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black active:scale-95 transition-all shadow-lg shadow-blue-500/30 flex justify-center items-center gap-2">查看結果</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="px-6 pt-12 pb-4 bg-white/90 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center border-b border-gray-100 shrink-0 text-gray-800 shadow-sm">
        <div className="flex items-center gap-3 text-left">
          <div className={`bg-${currentUser.color ? currentUser.color.replace('bg-', '') : (currentUser.name==="媽媽"?"pink-600":"blue-600")} w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-500/30`}>{currentUser.name.charAt(0)}</div>
          <div className="flex flex-col justify-center">
            <h1 className="text-xl font-black tracking-tighter italic leading-none mb-1">家庭記帳</h1>
            <p className="text-[10px] text-gray-400 font-bold tracking-widest leading-none">{String(customSubtitle || "{name}，你好！").replace(/{name}/g, currentUser.name)}</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1 mt-1">
          <button onClick={handleSyncClick} className="relative p-2 bg-blue-50 text-blue-600 rounded-xl active:scale-90 transition-all flex items-center justify-center border border-blue-100">
            <SvgIcon name="cloudSync" size={20} className={isSyncing ? "animate-spin" : ""} />
            {syncQueue && syncQueue.length > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border-2 border-white leading-none shadow-sm min-w-[20px] text-center">{syncQueue.length}</span>}
          </button>
          <span className={`text-[8px] font-black tracking-widest uppercase ${isOnline ? 'text-green-500' : 'text-red-500'}`}>{isOnline ? (isSyncing ? '同步中' : '線上') : '離線'}</span>
        </div>
      </header>

      <main className="p-6 flex-1 overflow-y-auto scrollbar-hide text-gray-800">
        {activeTab === "dashboard" && (
          <div className="space-y-6 animate-in">
            <div className="bg-gray-900 p-8 rounded-[3rem] shadow-2xl text-white relative overflow-hidden text-center">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[60px] rounded-full"></div>
              <span className="text-[10px] font-black uppercase mb-3 block tracking-widest text-blue-200">本期估算結餘</span>
              <div className="text-5xl font-black mb-8 tracking-tighter tabular-nums">${stats.balance.toLocaleString()}</div>
              <div className="flex w-full gap-4 pt-6 border-t border-white/10 text-sm text-gray-300">
                <div className="flex-1 text-center"><p className="text-[9px] uppercase mb-1 font-black">本期收入</p><p className="text-xl text-green-400 font-black">+${stats.income.toLocaleString()}</p></div>
                <div className="flex-1 border-l border-white/10 text-center"><p className="text-[9px] uppercase mb-1 font-black">本期支出</p><p className="text-xl text-red-400 font-black">-${stats.expense.toLocaleString()}</p></div>
              </div>
            </div>
            <div className="space-y-4 text-left">
              <h3 className="font-black text-lg px-1 text-gray-800">最新動態</h3>
              <div className="space-y-3">{(allGroupedAndSorted || []).slice(0, 5).map(item => renderItemOrGroup(item, false))}</div>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-4 animate-in pb-20 text-left">
            <div className="flex justify-between items-center px-1 mb-3 gap-2">
               <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1">
                  <h3 className="font-black text-xl text-gray-800 shrink-0">歷史清單</h3>
                  <div className="flex bg-gray-200/60 p-0.5 rounded-xl gap-0.5 shrink-0">
                     <button onClick={()=>setHistoryDateFilter("current_month")} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${historyDateFilter==='current_month'?'bg-white text-blue-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>本期</button>
                     <button onClick={()=>setHistoryDateFilter("last_month")} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${historyDateFilter==='last_month'?'bg-white text-blue-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>上期</button>
                     <button onClick={()=>{setHistoryDateFilter("all"); setHistorySearch(""); setHistoryExcludeSearch(""); setHistoryTypeFilter("all");}} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${historyDateFilter==='all' && !historySearch && !historyExcludeSearch && historyTypeFilter==='all'?'bg-white text-gray-800 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>還原</button>
                  </div>
               </div>
               <div className="flex items-center gap-2 shrink-0">
                   <button onClick={() => {setShowTrashModal(true); setConfirmHardDeleteId(null); setShowConfirmEmptyTrash(false);}} className="flex items-center justify-center w-8 h-8 bg-red-50 rounded-full border border-red-100 active:scale-95 transition-all text-red-500"><SvgIcon name="trash" size={14} /></button>
                   <button onClick={() => setShowSearchFilterModal(true)} className="flex items-center justify-center w-8 h-8 bg-blue-50 rounded-full border border-blue-100 active:scale-95 transition-all text-blue-600"><SvgIcon name="search" size={14} /></button>
               </div>
            </div>
            {(debouncedHistorySearch || debouncedHistoryExcludeSearch || historyTypeFilter !== "all" || historyDateFilter !== "all") && (
               <div className="flex flex-wrap gap-2 mb-2 px-1">
                  {debouncedHistorySearch && <span className="text-[9px] bg-blue-100 text-blue-700 px-2 py-1 rounded-md font-bold">🔍 包含: {debouncedHistorySearch}</span>}
                  {debouncedHistoryExcludeSearch && <span className="text-[9px] bg-red-100 text-red-700 px-2 py-1 rounded-md font-bold">🚫 排除: {debouncedHistoryExcludeSearch}</span>}
                  {historyTypeFilter !== "all" && <span className="text-[9px] bg-gray-200 text-gray-700 px-2 py-1 rounded-md font-bold">類型: {historyTypeFilter === 'expense' ? '支出' : '收入'}</span>}
                  {historyDateFilter !== "all" && <span className="text-[9px] bg-gray-200 text-gray-700 px-2 py-1 rounded-md font-bold">時間: {historyDateFilter === 'current_month' ? '本期' : historyDateFilter === 'last_month' ? '上期' : historyDateFilter === '1m' ? '近一期' : historyDateFilter === '3m' ? '近3期' : historyDateFilter === '6m' ? '近半年' : historyDateFilter === '1y' ? '近1年' : '全部'}</span>}
               </div>
            )}
            {isHistoryFiltered && (
                <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100 flex items-center justify-around mb-4 animate-in">
                   <div className="text-center w-1/2"><div className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">總支出</div><div className="text-xl font-black text-red-500">${historyFilteredStats.expense.toLocaleString()}</div></div>
                   <div className="w-px h-10 bg-gray-100"></div>
                   <div className="text-center w-1/2"><div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">總收入</div><div className="text-xl font-black text-green-500">${historyFilteredStats.income.toLocaleString()}</div></div>
                </div>
            )}
            <div className="space-y-3 mt-4">
              {(filteredHistoryGroups || []).slice(0, historyVisibleCount).map(item => renderItemOrGroup(item, true))}
              {historyVisibleCount < (filteredHistoryGroups || []).length && ( <button onClick={() => setHistoryVisibleCount(prev => prev + 20)} className="w-full py-4 bg-white border border-gray-200 text-blue-600 rounded-2xl font-black text-xs active:bg-gray-50 transition-colors shadow-sm mt-4 flex justify-center items-center gap-2"><SvgIcon name="refresh" size={14} className="text-blue-500" /> 載入更多紀錄 ({historyVisibleCount} / {(filteredHistoryGroups || []).length})</button> )}
              {(filteredHistoryGroups || []).length === 0 && <div className="text-center py-10 flex flex-col items-center gap-2"><span className="text-gray-400 text-sm font-bold">尚無符合條件的紀錄</span></div>}
            </div>
          </div>
        )}

        {activeTab === "analysis" && (
          <div className="space-y-6 animate-in pb-20 text-left">
            <div className="flex flex-col gap-3 px-1">
              <div className="flex justify-between items-center mb-2 gap-2">
                 <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1">
                    <h3 className="font-black text-xl text-gray-800 shrink-0">圖表分析</h3>
                    <div className="flex bg-gray-200/60 p-0.5 rounded-xl gap-0.5 shrink-0">
                       <button onClick={()=>{setAnalysisDateFilter("current_month"); setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null);}} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${analysisDateFilter==='current_month'?'bg-white text-blue-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>本期</button>
                       <button onClick={()=>{setAnalysisDateFilter("last_month"); setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null);}} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${analysisDateFilter==='last_month'?'bg-white text-blue-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>上期</button>
                       <button onClick={()=>{setAnalysisDateFilter("all"); setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null);}} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${analysisDateFilter==='all'?'bg-white text-gray-800 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>還原</button>
                    </div>
                 </div>
                 <div className="relative shrink-0 border-l pl-2 border-gray-200">
                    <select value={analysisDateFilter} onChange={(e) => {setAnalysisDateFilter(e.target.value); setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null);}} className="appearance-none bg-transparent py-1.5 pl-1 pr-4 font-black text-[10px] text-gray-400 outline-none text-right">
                      <option value="all">全部</option><option value="current_month">本期</option><option value="last_month">上期</option><option value="7d">近7日</option><option value="14d">近14日</option>
                      <option value="1m">近一期</option><option value="3m">近3期</option><option value="6m">近半年</option><option value="1y">近1年</option><option value="custom">自訂</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pointer-events-none"><span className="text-[8px] text-gray-400">▼</span></div>
                 </div>
              </div>
              {analysisDateFilter === "custom" && (
                <div className="flex gap-2 items-center bg-gray-100 p-2.5 rounded-xl border border-gray-200 animate-in shadow-inner">
                  <input type="date" value={analysisCustomStart} onChange={e => setAnalysisCustomStart(e.target.value)} className="flex-1 bg-transparent font-black text-[10px] text-gray-700 outline-none text-center" />
                  <span className="text-gray-400 font-bold text-xs">~</span>
                  <input type="date" value={analysisCustomEnd} onChange={e => setAnalysisCustomEnd(e.target.value)} className="flex-1 bg-transparent font-black text-[10px] text-gray-700 outline-none text-center" />
                </div>
              )}
            </div>
            
            <div className="flex bg-gray-100 p-1.5 rounded-2xl text-sm text-gray-500">
              <button onClick={() => {setAnalysisType("expense"); setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null);}} className={`flex-1 py-2 rounded-xl font-black transition-all ${analysisType === "expense" ? "bg-white text-red-500 shadow-sm" : ""}`}>支出分析</button>
              <button onClick={() => {setAnalysisType("income"); setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null);}} className={`flex-1 py-2 rounded-xl font-black transition-all ${analysisType === "income" ? "bg-white text-green-500 shadow-sm" : ""}`}>收入分析</button>
            </div>

            {(() => {
              let analysisTxs = myTransactions || []; let prevAnalysisTxs = []; let yoyAnalysisTxs = []; const showCompare = (analysisDateFilter === "current_month" || analysisDateFilter === "last_month");
              if (analysisDateFilter !== "all") {
                if (analysisDateFilter === "custom") {
                  const start = analysisCustomStart ? new Date(`${analysisCustomStart}T00:00:00`).getTime() : 0; const end = analysisCustomEnd ? new Date(`${analysisCustomEnd}T23:59:59`).getTime() : Infinity;
                  analysisTxs = analysisTxs.filter(item => { const txTime = parseDateForSort(item); return txTime >= start && txTime <= end; });
                } else {
                  const now = new Date(); let startTime = 0; let endTime = now.getTime();
                  if (analysisDateFilter === "current_month") { const range = getCycleRange(now, billingStartDay, 0); startTime = range.start; endTime = range.end; } 
                  else if (analysisDateFilter === "last_month") { const range = getCycleRange(now, billingStartDay, -1); startTime = range.start; endTime = range.end; } 
                  else {
                      const cutoff = new Date();
                      if (analysisDateFilter === "7d") cutoff.setDate(now.getDate() - 7); else if (analysisDateFilter === "14d") cutoff.setDate(now.getDate() - 14); else if (analysisDateFilter === "1m") cutoff.setMonth(now.getMonth() - 1);
                      else if (analysisDateFilter === "3m") cutoff.setMonth(now.getMonth() - 3); else if (analysisDateFilter === "6m") cutoff.setMonth(now.getMonth() - 6); else if (historyDateFilter === "1y") cutoff.setFullYear(now.getFullYear() - 1);
                      startTime = cutoff.getTime();
                  }
                  analysisTxs = analysisTxs.filter(item => { const tTime = parseDateForSort(item); return tTime >= startTime && tTime <= endTime; });
                  if (showCompare) {
                      const baseOffset = analysisDateFilter === "current_month" ? 0 : -1;
                      const prevR = getCycleRange(now, billingStartDay, baseOffset - 1); const yoyR = getCycleRange(now, billingStartDay, baseOffset - 12);
                      prevAnalysisTxs = myTransactions.filter(item => { const tTime = parseDateForSort(item); return tTime >= prevR.start && tTime <= prevR.end; });
                      yoyAnalysisTxs = myTransactions.filter(item => { const tTime = parseDateForSort(item); return tTime >= yoyR.start && tTime <= yoyR.end; });
                  }
                }
              }

              if (analysisType === "expense" || analysisType === "income") { analysisTxs = analysisTxs.filter(t => t.type === analysisType); prevAnalysisTxs = prevAnalysisTxs.filter(t => t.type === analysisType); yoyAnalysisTxs = yoyAnalysisTxs.filter(t => t.type === analysisType); }

              if (analysisTxs.length === 0) return <div className="text-center text-gray-400 py-10 text-sm font-bold bg-white rounded-[2rem] border border-gray-100 shadow-sm">該區間尚無紀錄</div>;
              
              const currentColors = CHART_COLORS[analysisType] || CHART_COLORS.expense;
              let level1Totals = {}; let grandTotal = 0; let prevLevel1Totals = {}; let totalPrev = 0; let yoyLevel1Totals = {}; let totalYoy = 0;

              const aggregateTotals = (txs, totalsObj) => { let total = 0; txs.forEach(t => { if (pendingMap[t.id] === 'DELETE_TX' || pendingMap[t.id] === 'HARD_DELETE_TX') return; const amt = Number(t.amount) || 0; total += amt; const pCat = getParentCat(t.category); totalsObj[pCat] = (totalsObj[pCat] || 0) + amt; }); return total; };
              grandTotal = aggregateTotals(analysisTxs, level1Totals); if (showCompare) { totalPrev = aggregateTotals(prevAnalysisTxs, prevLevel1Totals); totalYoy = aggregateTotals(yoyAnalysisTxs, yoyLevel1Totals); }

              const sortedLevel1 = Object.entries(level1Totals).sort((a,b) => b[1] - a[1]);
              let conicStr = ""; let currentPct = 0;
              sortedLevel1.forEach(([cat, amt], idx) => { const pct = grandTotal > 0 ? (amt / grandTotal) * 100 : 0; const color = currentColors[idx % currentColors.length]; conicStr += color + " " + currentPct + "% " + (currentPct + pct) + "%, "; currentPct += pct; }); conicStr = conicStr.slice(0, -2);

              let level2Totals = {}; let level1SelectedTotal = 0; let prevLevel2Totals = {}; let yoyLevel2Totals = {};
              if (selectedAnalysisLevel1) {
                const aggregateLevel2 = (txs, totalsObj) => { txs.forEach(t => { if (pendingMap[t.id] === 'DELETE_TX' || pendingMap[t.id] === 'HARD_DELETE_TX') return; if (getParentCat(t.category) === selectedAnalysisLevel1) { const cCat = getChildCat(t.category); const amt = Number(t.amount) || 0; totalsObj[cCat] = (totalsObj[cCat] || 0) + amt; } }); };
                aggregateLevel2(analysisTxs, level2Totals); Object.values(level2Totals).forEach(v => level1SelectedTotal += v); if (showCompare) { aggregateLevel2(prevAnalysisTxs, prevLevel2Totals); aggregateLevel2(yoyAnalysisTxs, yoyLevel2Totals); }
              }
              const sortedLevel2 = Object.entries(level2Totals).sort((a,b) => b[1] - a[1]);

              const activeColorClass = analysisType === "expense" ? "blue" : "green"; const isExp = analysisType === "expense"; const clrUp = isExp ? "text-red-500" : "text-green-500"; const clrDn = isExp ? "text-green-500" : "text-red-500";
              let maxIncreaseCat = null; let maxIncreaseAmt = 0; let maxDecreaseCat = null; let maxDecreaseAmt = 0; let diffTotalPrev = grandTotal - totalPrev; let diffTotalYoy = grandTotal - totalYoy;

              if (showCompare && isExp) {
                  sortedLevel1.forEach(([cat, amt]) => { const pAmt = prevLevel1Totals[cat] || 0; const diff = amt - pAmt; if (diff > maxIncreaseAmt) { maxIncreaseAmt = diff; maxIncreaseCat = cat; } if (diff < maxDecreaseAmt) { maxDecreaseAmt = diff; maxDecreaseCat = cat; } });
                  Object.entries(prevLevel1Totals).forEach(([cat, pAmt]) => { if (!level1Totals[cat]) { const diff = 0 - pAmt; if (diff < maxDecreaseAmt) { maxDecreaseAmt = diff; maxDecreaseCat = cat; } } });
              }

              return (
                <div className="space-y-4">
                  {showCompare && isExp && (
                    <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 relative overflow-hidden animate-in">
                       <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
                       <h4 className="font-black text-gray-800 text-sm mb-3 flex items-center gap-2"><SvgIcon name="chart" size={16} className="text-blue-500" />智能抓漏報告 (與上期/去年比)</h4>
                       <div className="space-y-2 text-[11px] font-bold text-gray-600">
                          <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                             <span className="uppercase tracking-widest text-[9px] text-gray-400">總花費變化</span>
                             <div className="flex gap-2">
                                {diffTotalPrev !== 0 ? ( <span className="bg-white px-2 py-0.5 rounded border border-gray-100">上期 {diffTotalPrev > 0 ? <span className="text-red-500">⬆ ${diffTotalPrev.toLocaleString()}</span> : <span className="text-green-500">⬇ ${Math.abs(diffTotalPrev).toLocaleString()}</span>}</span> ) : <span className="bg-white px-2 py-0.5 rounded border border-gray-100 text-gray-400">上期持平</span>}
                                {diffTotalYoy !== 0 ? ( <span className="bg-white px-2 py-0.5 rounded border border-gray-100">去年 {diffTotalYoy > 0 ? <span className="text-red-500">⬆ ${diffTotalYoy.toLocaleString()}</span> : <span className="text-green-500">⬇ ${Math.abs(diffTotalYoy).toLocaleString()}</span>}</span> ) : <span className="bg-white px-2 py-0.5 rounded border border-gray-100 text-gray-400">去年持平</span>}
                             </div>
                          </div>
                          {maxIncreaseCat && maxIncreaseAmt > 0 && ( <div className="flex gap-2 items-start bg-red-50 p-2.5 rounded-xl border border-red-100"><span className="text-red-500 shrink-0 text-sm">⚠️</span><span className="text-red-700 leading-relaxed">【{maxIncreaseCat}】較上期暴增 <span className="font-black text-red-600">${maxIncreaseAmt.toLocaleString()}</span>，請注意控制！</span></div> )}
                          {maxDecreaseCat && maxDecreaseAmt < 0 && ( <div className="flex gap-2 items-start bg-green-50 p-2.5 rounded-xl border border-green-100"><span className="text-green-500 shrink-0 text-sm">✅</span><span className="text-green-700 leading-relaxed">【{maxDecreaseCat}】較上期省了 <span className="font-black text-green-600">${Math.abs(maxDecreaseAmt).toLocaleString()}</span>，維持得很棒！</span></div> )}
                       </div>
                    </div>
                  )}

                  <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 relative">
                    <div className="relative w-48 h-48 mx-auto mb-8 rounded-full shadow-lg" style={{ background: `conic-gradient(${conicStr})` }}>
                      <div className="absolute inset-0 m-auto w-32 h-32 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                        <span className="text-[10px] text-gray-400 font-black uppercase mb-1">{analysisType === "expense" ? "總支出" : "總收入"}</span>
                        <span className="text-xl font-black text-gray-800">${grandTotal.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-[9px] text-center font-black text-gray-400 uppercase tracking-widest mb-3 bg-gray-50 py-1.5 rounded-lg border border-gray-100">點擊下方分類查看細項</div>
                      {(sortedLevel1 || []).map(([cat, amt], idx) => {
                        const isSelected = selectedAnalysisLevel1 === cat; const diffP = amt - (prevLevel1Totals[cat] || 0); const diffY = amt - (yoyLevel1Totals[cat] || 0);
                        return (
                          <div key={cat} onClick={() => { setSelectedAnalysisLevel1(isSelected ? null : cat); setSelectedAnalysisLevel2(null); }} className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-colors border ${isSelected ? `bg-${activeColorClass}-50/50 border-${activeColorClass}-200` : 'bg-gray-50/50 hover:bg-gray-100 border-transparent'}`}>
                            <div className="flex items-center gap-3 min-w-0 pr-2">
                              <div className="w-3 h-3 rounded-full shadow-sm shrink-0" style={{ background: currentColors[idx % currentColors.length] }}></div>
                              <span className={`font-bold text-sm truncate ${isSelected ? `text-${activeColorClass}-700` : 'text-gray-700'}`}>{cat}</span>
                             </div>
                            <div className="flex flex-col items-end shrink-0 pl-2">
                              <div className="flex items-center gap-2">
                                 <span className="text-xs text-gray-400 font-bold w-10 text-right">{grandTotal > 0 ? ((amt/grandTotal)*100).toFixed(1) : 0}%</span>
                                 <span className={`font-black w-16 text-right ${isSelected ? `text-${activeColorClass}-700` : 'text-gray-800'}`}>${Math.round(amt).toLocaleString()}</span>
                              </div>
                              {showCompare && (diffP !== 0 || diffY !== 0) && (
                                 <div className="flex gap-1.5 justify-end mt-1 text-[9px] font-bold opacity-90">
                                    {diffP !== 0 && <span className={diffP > 0 ? clrUp : clrDn}>上期 {diffP > 0 ? '↑' : '↓'}{Math.abs(diffP).toLocaleString()}</span>}
                                    {diffY !== 0 && <span className={diffY > 0 ? clrUp : clrDn}>去年 {diffY > 0 ? '↑' : '↓'}{Math.abs(diffY).toLocaleString()}</span>}
                                 </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {selectedAnalysisLevel1 && (
                    <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 animate-in relative overflow-hidden">
                      <div className={`absolute top-0 left-0 w-full h-1.5 bg-${activeColorClass}-500`}></div>
                      <h4 className="font-black text-gray-800 mb-5 flex items-center gap-2 text-sm pt-2">「{selectedAnalysisLevel1}」子項目明細</h4>
                      <div className="space-y-4">
                        {(sortedLevel2 || []).map(([cat, amt]) => {
                           const pct = level1SelectedTotal > 0 ? (amt / level1SelectedTotal) * 100 : 0; const isL2Selected = selectedAnalysisLevel2 === cat; const diffP = amt - (prevLevel2Totals[cat] || 0); const diffY = amt - (yoyLevel2Totals[cat] || 0);
                           return (
                             <div key={cat}>
                                <div className="flex justify-between items-start text-xs font-bold mb-1.5 gap-2">
                                   <span className="text-gray-700 flex-1 min-w-0 flex items-center gap-1 mt-0.5"><span className="truncate">{cat}</span></span>
                                   <div className="flex flex-col items-end shrink-0">
                                      <div className="flex items-center gap-2">
                                          <span className="text-gray-500 tabular-nums">${Math.round(amt).toLocaleString()} <span className="text-[9px] text-gray-400 ml-1">({pct.toFixed(1)}%)</span></span>
                                          <button onClick={(e) => { e.stopPropagation(); setAnalysisDetailData({ title: `「${selectedAnalysisLevel1} - ${cat}」明細`, txs: analysisTxs.filter(t => { return getParentCat(t.category) === selectedAnalysisLevel1 && getChildCat(t.category) === cat; }) }); }} className="px-2 py-0.5 rounded-md text-[9px] font-black active:scale-95 transition-all bg-gray-100 text-gray-500 hover:bg-gray-200">明細</button>
                                      </div>
                                      {showCompare && (diffP !== 0 || diffY !== 0) && (
                                          <div className="flex gap-1.5 justify-end mt-1 text-[9px] font-bold opacity-90 pr-10">
                                             {diffP !== 0 && <span className={diffP > 0 ? clrUp : clrDn}>上期 {diffP > 0 ? '↑' : '↓'}{Math.abs(diffP).toLocaleString()}</span>}
                                             {diffY !== 0 && <span className={diffY > 0 ? clrUp : clrDn}>去年 {diffY > 0 ? '↑' : '↓'}{Math.abs(diffY).toLocaleString()}</span>}
                                          </div>
                                      )}
                                   </div>
                                </div>
                                <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner"><div className={`h-full bg-${activeColorClass}-400 rounded-full transition-all duration-1000 ease-out`} style={{ width: animTrigger ? `${pct}%` : '0%' }}></div></div>
                             </div>
                           )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === "add" && <AddTransactionForm loginUser={currentUser.name} onSubmit={handleAdd} />}

        {activeTab === "settings" && (
          <div className="space-y-4 animate-in text-left pb-20 text-gray-800">
            <div className="bg-white p-6 rounded-[2rem] border shadow-sm border-gray-100">
              <h3 className="font-black text-xs mb-4 uppercase flex items-center gap-2 text-gray-800 tracking-widest px-1"><SvgIcon name="calendar" size={16} className="text-blue-500 shrink-0" /> 記帳週期設定</h3>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 focus-within:border-blue-200 transition-colors">
                <label className="text-[9px] font-black text-gray-400 uppercase block mb-2 leading-none tracking-widest">起始日 (如信用卡結帳日)</label>
                <div className="flex items-center gap-2">
                  <select value={billingStartDay} onChange={(e) => { const newDay = Number(e.target.value); setBillingStartDay(newDay); localStorage.setItem(LS.billingStartDay, String(newDay)); }} className="flex-1 bg-transparent font-black border-none outline-none text-blue-600 text-sm min-w-0">{[...Array(28)].map((_, i) => <option key={i+1} value={i+1}>每月 {i+1} 號</option>)}</select>
                </div>
                <div className="mt-3 text-[10px] text-gray-500 font-bold bg-white p-2 rounded-xl border border-gray-100 leading-relaxed">設定後，歷史清單與圖表的「本期/上期」將以此為基準。<br/>👉 目前本期範圍：<span className="text-blue-600 ml-1">{formatDateOnly(currentCycleRange.start)} ~ {formatDateOnly(currentCycleRange.end)}</span></div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border shadow-sm border-gray-100">
              <h3 className="font-black text-xs mb-4 uppercase flex items-center gap-2 text-gray-800 tracking-widest px-1"><SvgIcon name="edit" size={16} className="text-blue-500 shrink-0" /> 介面自訂</h3>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 focus-within:border-blue-200 transition-colors">
                <label className="text-[9px] font-black text-gray-400 uppercase block mb-2 leading-none tracking-widest">首頁副標題問候語 (支援 {"{name}"} 變數)</label>
                <div className="flex items-center gap-2">
                  <input type="text" className="flex-1 bg-transparent font-bold border-none outline-none text-gray-800 placeholder:text-gray-300 text-sm min-w-0" placeholder="例如：{name}，你好！" value={customSubtitle || ""} onChange={(e) => setCustomSubtitle(e.target.value)} />
                  <button onClick={handleSaveGreeting} disabled={isSyncing} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black shadow-sm active:scale-95 disabled:opacity-50 shrink-0">儲存</button>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border shadow-sm border-gray-100">
              <h3 className="font-black text-xs mb-5 uppercase flex items-center gap-2 text-gray-800 tracking-widest px-1"><SvgIcon name="info" size={16} className="text-blue-500 shrink-0" /> 安全與帳戶管理</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 gap-2">
                  <div className="min-w-0"><p className="text-gray-400 text-[10px] font-black uppercase mb-1 leading-none truncate">使用身份</p><p className="font-black text-gray-800 text-base leading-none mt-1 truncate">{currentUser.name}</p></div>
                  <button onClick={() => setShowChangePinModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all shrink-0">更換密碼</button>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 gap-2">
                  <div className="min-w-0"><p className="text-gray-400 text-[10px] font-black uppercase mb-1 leading-none truncate">生物辨識 / 裝置解鎖</p><p className="font-black text-gray-800 text-sm leading-none mt-1 truncate">{bioBound ? "設備已綁定" : "設備未綁定"}</p></div>
                  <button onClick={() => bioBound ? (setUnbindPin(""), setShowUnbindModal(true)) : bindDeviceBio()} className={`px-4 py-2 rounded-xl font-black text-xs active:scale-95 transition-all shrink-0 ${bioBound ? "bg-red-50 text-red-600 border border-red-100" : "bg-green-600 text-white shadow-lg"}`}>{bioBound ? "解除綁定" : "綁定設備"}</button>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 gap-2">
                    <div className="min-w-0"><p className="text-gray-400 text-[10px] font-black uppercase mb-1 leading-none truncate">系統深度清理</p><p className="font-black text-gray-800 text-sm leading-none mt-1 truncate">清空本地所有快取</p></div>
                    <button onClick={() => setShowClearCacheModal(true)} className="px-4 py-2 bg-red-600 text-white rounded-xl font-black text-xs active:scale-95 transition-all shadow-lg shadow-red-500/30 shrink-0">執行清理</button>
                </div>
              </div>
              <button onClick={() => { setCurrentUser(null); setSelectingUser(null); setPinInput(""); setActiveTab("dashboard"); }} className="w-full mt-6 py-4 bg-red-50 text-red-600 rounded-2xl font-black active:scale-95 transition-all flex items-center justify-center gap-2 border border-red-100"><SvgIcon name="logout" size={20} className="shrink-0" /> 登出 / 切換使用者</button>
              
              {syncQueue && syncQueue.length > 0 && (
                <div className="bg-red-50 p-4 rounded-2xl border border-red-100 mt-4 flex justify-between items-center gap-2">
                  <div className="min-w-0"><p className="text-red-400 text-[10px] font-black uppercase mb-1 leading-none truncate">異常排解</p><p className="font-black text-red-600 text-sm leading-none mt-1 truncate">有 {syncQueue.length} 筆資料卡住</p></div>
                  <button onClick={() => setShowClearQueueModal(true)} className="px-4 py-2 bg-red-600 text-white rounded-xl font-black text-xs active:scale-95 transition-all shadow-lg shadow-red-500/30 shrink-0">強制清除</button>
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-[2rem] border shadow-sm border-gray-100">
              <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsLogOpen(!isLogOpen)}>
                <h3 className="font-black text-xs uppercase flex items-center gap-2 text-gray-800 tracking-widest px-1"><SvgIcon name="chart" size={16} className="text-blue-500 shrink-0" /> 系統資訊 & 更新歷程</h3>
                <span className={`text-gray-400 text-[10px] transition-transform duration-300 ${isLogOpen ? 'rotate-180' : ''}`}>▼</span>
              </div>
              {isLogOpen && (
                <div className="mt-5 space-y-5 font-bold text-gray-600 animate-in border-t border-gray-100 pt-4">
                  <div className="border-l-2 border-blue-500 pl-3">
                    <p className="text-gray-800 text-xs mb-1 flex items-center gap-2">APP 前端 <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded text-[9px] font-mono">{APP_VERSION}</span></p>
                    <ul className="list-disc pl-4 text-[10px] space-y-1 text-gray-500">
                      <li>正式轉換為 Vite + React 多檔案專案架構，大幅提升開發與維護效率，徹底解決更新時程式碼被截斷的問題 (V128.VITE_REFACTOR)</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[92%] max-w-sm bg-white/90 backdrop-blur-md rounded-[2.5rem] p-2 flex justify-between items-center z-40 shadow-2xl border border-white/20 safe-bottom">
        <button onClick={() => setActiveTab("dashboard")} className={`flex-1 flex justify-center items-center py-4 rounded-3xl transition-all ${activeTab === "dashboard" ? "text-blue-600 bg-blue-50 shadow-inner" : "text-gray-400"}`}><SvgIcon name="home" className="shrink-0" /></button>
        <button onClick={() => setActiveTab("history")} className={`flex-1 flex justify-center items-center py-4 rounded-3xl transition-all ${activeTab === "history" ? "text-blue-600 bg-blue-50 shadow-inner" : "text-gray-400"}`}><SvgIcon name="history" className="shrink-0" /></button>
        <div className="px-1 shrink-0">
          <button onClick={() => setActiveTab(prev => prev === "add" ? "dashboard" : "add")} className={`w-14 h-14 flex items-center justify-center rounded-[1.5rem] shadow-xl active:scale-90 transition-all ${activeTab === "add" ? "bg-blue-700 text-white rotate-45 shadow-blue-200" : "bg-gray-900 text-white"}`}><SvgIcon name="plus" size={28} className="shrink-0" /></button>
        </div>
        <button onClick={() => setActiveTab("analysis")} className={`flex-1 flex justify-center items-center py-4 rounded-3xl transition-all ${activeTab === "analysis" ? "text-blue-600 bg-blue-50 shadow-inner" : "text-gray-400"}`}><SvgIcon name="pieChart" className="shrink-0" /></button>
        <button onClick={() => setActiveTab("settings")} className={`flex-1 flex justify-center items-center py-4 rounded-3xl transition-all ${activeTab === "settings" ? "text-blue-600 bg-blue-50 shadow-inner" : "text-gray-400"}`}><SvgIcon name="settings" className="shrink-0" /></button>
      </nav>

      {statusMsg.text && (
        <div className="fixed bottom-28 left-0 right-0 flex justify-center z-[1000] pointer-events-none px-4 text-center">
          <div className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in pointer-events-auto ${statusMsg.type === "success" ? "bg-green-600 text-white" : statusMsg.type === "error" ? "bg-red-600 text-white" : statusMsg.type === "info" ? "bg-gray-800 text-white border border-gray-600" : "bg-blue-600 text-white"}`}>
            <span className="text-sm font-bold tracking-tight text-center">{statusMsg.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;