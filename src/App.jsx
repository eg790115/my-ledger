import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

import { APP_VERSION, STORE_NAME, LS, CHART_COLORS } from './utils/constants';
import { initIndexedDB, saveToIndexedDB, loadFromIndexedDB, getParentCat, getChildCat, getBenArray, getBenBadgeStyle, safeParse, safeArrayLS, safeStringLS, safeNumberLS, nowStr, displayDateClean, formatDateOnly, parseDateForSort, getSafeCycleRange } from './utils/helpers';
import { gasUrl, postGAS, getDeviceToken, deviceValid, setDeviceToken, clearDeviceToken, getBioKey, isDeviceBioBound, getBioFailCount, setBioFailCount, getBioLockedUntil, setBioLockedUntil, clearBioFail, verifyPinOnline, saveLocalPinHash, unlockWithPinLocal } from './utils/api';

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

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [familyConfig, setFamilyConfig] = useState(() => safeArrayLS(LS.members).length ? safeArrayLS(LS.members) : [{ name: "爸爸", color: "bg-blue-600" }, { name: "媽媽", color: "bg-pink-600" }]);
  const [customSubtitle, setCustomSubtitle] = useState("{name}，你好！");
  const [greetingsCache, setGreetingsCache] = useState(() => { try { return JSON.parse(localStorage.getItem(LS.greetingsCache)) || {}; } catch { return {}; } });
  const [billingStartDay, setBillingStartDay] = useState(() => safeNumberLS(LS.billingStartDay, 1));
  const [statusMsg, setStatusMsg] = useState({ type: "", text: "" });

  const [showClearCacheModal, setShowClearCacheModal] = useState(false);
  const [cacheClearPassword, setCacheClearPassword] = useState("");
  const [showLoginClearCacheModal, setShowLoginClearCacheModal] = useState(false);
  const [loginCachePassword, setLoginCachePassword] = useState("");

  const [showClearQueueModal, setShowClearQueueModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [loadingCard, setLoadingCard] = useState({ show: false, text: "" });
  const isLoading = loadingCard.show;
  const [lastSyncText, setLastSyncText] = useState(() => safeStringLS(LS.lastSync, "----/--/-- --:--"));

  const [txCache, setTxCache] = useState([]);
  const [trashCache, setTrashCache] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [snapshotsCache, setSnapshotsCache] = useState(() => { try { return JSON.parse(localStorage.getItem('snapshots_cache')) || {}; } catch { return {}; } });

  const [editingTx, setEditingTx] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [viewingHistoryItem, setViewingHistoryItem] = useState(null);
  const [analysisDetailData, setAnalysisDetailData] = useState(null);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [confirmHardDeleteId, setConfirmHardDeleteId] = useState(null);
  const [showConfirmEmptyTrash, setShowConfirmEmptyTrash] = useState(false);
  
  // 🌟 AI 語音專用狀態
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
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [unackedProxyTxs, setUnackedProxyTxs] = useState([]);

  const txCacheRef = useRef(txCache);
  const trashCacheRef = useRef(trashCache);
  useEffect(() => { txCacheRef.current = txCache; }, [txCache]);
  useEffect(() => { trashCacheRef.current = trashCache; }, [trashCache]);

  useEffect(() => {
    loadFromIndexedDB(STORE_NAME).then(data => { if (data && data.length > 0) setTxCache(data); });
    loadFromIndexedDB("trash_store").then(data => { if (data && data.length > 0) setTrashCache(data); });
    loadFromIndexedDB("audit_logs").then(data => { if (data) setAuditLogs(data); });
  }, []);

  const showStatus = useCallback((type, text) => {
    if (type === "success") triggerVibration([20, 50, 20]);
    else if (type === "error") triggerVibration([50, 50, 50, 50, 50]);
    else if (type === "info") triggerVibration(15);
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg({ type: "", text: "" }), 3000);
  }, []);

  const {
    currentUser, setCurrentUser, selectingUser, setSelectingUser,
    pinInput, setPinInput, fallbackToPin, setFallbackToPin, biometricAvailable,
    showBootstrapModal, setShowBootstrapModal, bootstrapSecret, setBootstrapSecret,
    showUnbindModal, setShowUnbindModal, unbindPin, setUnbindPin,
    showChangePinModal, setShowChangePinModal, forceReloginForToken,
    handleBioLoginLocal, handleUserClick, bindDeviceBio, unbindDeviceBio, bioBound
  } = useAuth({ isOnline, showStatus, setLoadingCard, triggerVibration });

  const applyCloudData = useCallback((data, isDelta = false) => {
    let formatted = (data.transactions || []).map((t, i) => {
      const rawDate = t.date || t["日期時間"] || t["日期"] || "";
      const cleanStr = String(rawDate).replace(/上午|下午|AM|PM/gi, "").trim().replace(/-/g, "/").replace("T", " ");
      const ts = new Date(cleanStr).getTime() || 0;
      const fallbackId = `${ts}_${String(t.member || t["成員"] || "未知").trim()}_${Math.random().toString(36).substring(2, 7)}`;
      return {
        id: String(t.id || t[""] || t["ID"] || fallbackId), amount: parseFloat(t.amount !== undefined ? t.amount : t["金額"]) || 0,
        category: String(t.category || t["類別"] || "其他"), date: rawDate, timestamp: ts, member: String(t.member || t["成員"] || "未知").trim(),
        recorder: String(t.recorder || t["記錄者"] || "系統").trim(), desc: String(t.desc || t["備註"] || ""), type: String(t.type || t["類型"] || "expense"),
        groupId: String(t.groupId || t["GroupID"] || ""), parentDesc: String(t.parentDesc || t["ParentDesc"] || ""),
        beneficiary: String(t.beneficiary || t["Beneficiary"] || t.member || t["成員"] || "未知").trim(), lastModified: Number(t.lastModified || t["LastModified"]) || 0
      };
    }).filter(t => t && t.id && t.id !== "undefined");

    let formattedTrash = (data.trash || []).map((t, i) => {
      const rawDate = t.date || t["日期時間"] || t["日期"] || "";
      const cleanStr = String(rawDate).replace(/上午|下午|AM|PM/gi, "").trim().replace(/-/g, "/").replace("T", " ");
      const ts = new Date(cleanStr).getTime() || 0;
      const fallbackId = `${ts}_${String(t.member || t["成員"] || "未知").trim()}_trash_${Math.random().toString(36).substring(2, 7)}`;
      return {
        id: String(t.id || t[""] || t["ID"] || fallbackId), amount: parseFloat(t.amount !== undefined ? t.amount : t["金額"]) || 0,
        category: String(t.category || t["類別"] || "其他"), date: rawDate, timestamp: ts, member: String(t.member || t["成員"] || "未知").trim(),
        recorder: String(t.recorder || t["記錄者"] || "系统").trim(), desc: String(t.desc || t["備註"] || ""), type: String(t.type || t["類型"] || "expense"),
        groupId: String(t.groupId || t["GroupID"] || ""), parentDesc: String(t.parentDesc || t["ParentDesc"] || ""),
        beneficiary: String(t.beneficiary || t["Beneficiary"] || t.member || t["成員"] || "未知").trim(), lastModified: Number(t.lastModified || t["LastModified"]) || 0
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
    if (oldTrashStr !== newTrashStr) { setTrashCache(newTrashCache); saveToIndexedDB("trash_store", newTrashCache); changed = true; }

    if (data.auditLogs) { setAuditLogs(data.auditLogs); saveToIndexedDB("audit_logs", data.auditLogs); }
    if (data.serverTime) { localStorage.setItem('last_server_time_v1', data.serverTime); }
    setLastSyncText(nowStr());

    if (data.greetings) setGreetingsCache(data.greetings);
    if (data.snapshots) { setSnapshotsCache(data.snapshots); localStorage.setItem('snapshots_cache', JSON.stringify(data.snapshots)); }

    // 🌟 核心修復：廣播雲端資料給 AI 大腦接收 (包含 B6 的 aiData)
    window.dispatchEvent(new CustomEvent('cloud_data_synced', { detail: data }));

    return changed;
  }, []);

  const { syncQueue, setSyncQueue, isSyncing, lastServerTime, setLastServerTime, requestSync, appendToQueueAndSync } = useSyncEngine({
    currentUser, isOnline, txCacheRef, trashCacheRef, setTxCache, setTrashCache, applyCloudData, showStatus, forceReloginForToken
  });

  const { pendingMap, visibleTransactions, visibleTrash, myTransactions, handleAdd, handleUpdateTx, handleUpdateGroupParent, handleDeleteTx, handleRestoreTrash, handleHardDeleteTrash, handleEmptyTrash } = useTransactions({
    currentUser, txCache, trashCache, syncQueue, appendToQueueAndSync, triggerVibration, showStatus, setActiveTab, setEditingTx, setEditingGroup, setConfirmHardDeleteId, setShowConfirmEmptyTrash, setShowTrashModal
  });

  const { aiEvalData, sysConfig, setSysConfig, isAIEvaluating, handleForceAIEval, processVoiceText } = useAI({ currentUser, isOnline, txCache, showStatus });

  // 🌟 AI 語音停止後，交接給 App.jsx 處理
  const handleVoiceRecordStop = async (text) => {
    setLoadingCard({ show: true, text: "🤖 正在呼叫 AI 大腦解析中..." });
    try {
      const parsedTxs = await processVoiceText(text, currentUser.name);
      if (parsedTxs && parsedTxs.length > 0) {
        setVoiceReviewTxs(parsedTxs); // 解析成功，打開確認視窗
      }
    } catch (e) {
      showStatus("error", e.message);
    } finally {
      setLoadingCard({ show: false, text: "" }); // 關閉等待視窗
    }
  };

  // 🌟 確認並寫入語音資料
  const handleConfirmVoice = () => {
    triggerVibration([20, 40, 20]);
    const baseTimestamp = Date.now();
    const groupMap = {}; 
    const randomSuffix = () => Math.random().toString(36).substring(2, 8);

    const completeTxs = voiceReviewTxs.map((tx, idx) => {
      let gId = "";
      let pDesc = "";
      if (tx.isGroup && tx.parentTitle) {
         if (!groupMap[tx.parentTitle]) {
           groupMap[tx.parentTitle] = `G_${baseTimestamp}_${currentUser.name}_${randomSuffix()}`;
         }
         gId = groupMap[tx.parentTitle];
         pDesc = tx.parentTitle;
      }

      return {
         id: `${baseTimestamp + idx}_${currentUser.name}_${randomSuffix()}`,
         date: nowStr(),
         type: tx.type || "expense", // 🌟 支援 AI 判定的收入/支出
         category: tx.category || "其他/雜項",
         amount: Number(tx.amount) || 0,
         desc: tx.desc || "",
         member: currentUser.name,
         recorder: currentUser.name,
         beneficiary: tx.beneficiary || currentUser.name,
         groupId: gId,
         parentDesc: pDesc,
         isOffline: !navigator.onLine,
         action: "ADD"
      };
    });

    setActiveTab("dashboard");
    appendToQueueAndSync(completeTxs);
    setVoiceReviewTxs(null); 
    showStatus("success", "✅ AI 帳單已加入同步排程！");
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

  useEffect(() => localStorage.setItem(LS.members, JSON.stringify(familyConfig || [])), [familyConfig]);
  useEffect(() => localStorage.setItem(LS.lastSync, lastSyncText), [lastSyncText]);
  useEffect(() => localStorage.setItem(LS.greetingsCache, JSON.stringify(greetingsCache || {})), [greetingsCache]);

  useEffect(() => { if (currentUser && greetingsCache && greetingsCache[currentUser.name]) setCustomSubtitle(String(greetingsCache[currentUser.name])); else if (currentUser) setCustomSubtitle("{name}，你好！"); }, [currentUser, greetingsCache]);
  useEffect(() => { const timer = setTimeout(() => { setDebouncedHistorySearch(historySearch); setDebouncedHistoryExcludeSearch(historyExcludeSearch); }, 350); return () => clearTimeout(timer); }, [historySearch, historyExcludeSearch]);
  useEffect(() => { if (activeTab !== "analysis") { setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null); setAnalysisType("expense"); } }, [activeTab]);
  useEffect(() => { setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null); }, [analysisType, analysisDateFilter, analysisCustomStart, analysisCustomEnd]);
  useEffect(() => { setSelectedAnalysisLevel2(null); }, [selectedAnalysisLevel1]);
  useEffect(() => { (async () => { try { const res = await fetch(gasUrl); const data = await res.json(); if (data.members && data.members.length) setFamilyConfig(data.members); } catch {} })(); }, []);

  useEffect(() => {
    if (!currentUser || txCache.length === 0) return;
    const acked = safeParse(localStorage.getItem(LS.ackProxyTxs), []);
    const unacked = txCache.filter(tx => String(tx.member).trim() === String(currentUser.name).trim() && tx.recorder && String(tx.recorder).trim() !== String(currentUser.name).trim() && String(tx.recorder).trim() !== '系統' && !acked.includes(tx.id));
    const currentUnackedIds = unackedProxyTxs.map(t => t.id).sort().join(',');
    const newUnackedIds = unacked.map(t => t.id).sort().join(',');
    if (currentUnackedIds !== newUnackedIds) setUnackedProxyTxs(unacked);
  }, [currentUser, txCache, unackedProxyTxs]);

  const handleSyncClick = () => { triggerVibration(15); requestSync(false, true); };
  const refreshDeviceToken = async () => { const data = await postGAS({ action: "DEVICE_REFRESH", deviceToken: getDeviceToken() });
    if (data.result !== "success") throw new Error(data.message || "憑證已過期"); setDeviceToken(data.deviceToken, data.deviceExp); return data; };
  const bootstrapDevice = async () => { if (!bootstrapSecret) throw new Error("請輸入雲端密碼");
    const data = await postGAS({ action: "DEVICE_BOOTSTRAP", appSecret: bootstrapSecret }); if (data.result !== "success") throw new Error(data.message || "綁定失敗");
    setDeviceToken(data.deviceToken, data.deviceExp); return data; };

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
    try {
      const safeSearchTxt = String(debouncedHistorySearch || "").trim().toLowerCase();
      const safeExcludeTxt = String(debouncedHistoryExcludeSearch || "").trim().toLowerCase();

      let list = (allGroupedAndSorted || []).filter(item => String(item.member || "").trim() === String(currentUser.name || "").trim());
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

      const dateRangeRegex = /^(\d{4}\/\d{1,2}\/\d{1,2})\s*-\s*(\d{4}\/\d{1,2}\/\d{1,2})$/;
      const match = String(debouncedHistorySearch || "").trim().match(dateRangeRegex);

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
              filteredList.push({ ...item, children: validChildren, amount: newAmount, date: validChildren[0]?.date || item.date });
            }
          } else {
            const txTime = parseDateForSort(item);
            if (txTime >= startTime && txTime <= endTime) filteredList.push(item);
          }
        }
        list = filteredList;
      }

      const isMatch = (targetStr, keyword) => String(targetStr || "").toLowerCase().includes(keyword);

      if (safeSearchTxt && !match) {
        list = list.filter(item => {
          if (item.isGroup) {
            const groupMatch = isMatch(item.parentTitle, safeSearchTxt) || isMatch(item.parentDesc, safeSearchTxt) || isMatch(item.amount, safeSearchTxt) || isMatch(item.date, safeSearchTxt);
            const childMatch = (item.children || []).some(tx => isMatch(getParentCat(tx.category), safeSearchTxt) || isMatch(getChildCat(tx.category), safeSearchTxt) || isMatch(tx.desc, safeSearchTxt) || isMatch(tx.amount, safeSearchTxt) || isMatch(tx.beneficiary, safeSearchTxt));
            return groupMatch || childMatch;
          } else {
            return isMatch(getParentCat(item.category), safeSearchTxt) || isMatch(getChildCat(item.category), safeSearchTxt) || isMatch(item.desc, safeSearchTxt) || isMatch(item.amount, safeSearchTxt) || isMatch(item.date, safeSearchTxt) || isMatch(item.beneficiary, safeSearchTxt);
          }
        });
      }

      if (safeExcludeTxt) {
        list = list.filter(item => {
          if (item.isGroup) {
            const groupMatch = isMatch(item.parentTitle, safeExcludeTxt) || isMatch(item.parentDesc, safeExcludeTxt) || isMatch(item.amount, safeExcludeTxt) || isMatch(item.date, safeExcludeTxt);
            const childMatch = (item.children || []).some(tx => isMatch(getParentCat(tx.category), safeExcludeTxt) || isMatch(getChildCat(tx.category), safeExcludeTxt) || isMatch(tx.desc, safeExcludeTxt) || isMatch(tx.amount, safeExcludeTxt) || isMatch(tx.beneficiary, safeExcludeTxt));
            return !(groupMatch || childMatch);
          } else {
            return !(isMatch(getParentCat(item.category), safeExcludeTxt) || isMatch(getChildCat(item.category), safeExcludeTxt) || isMatch(item.desc, safeExcludeTxt) || isMatch(item.amount, safeExcludeTxt) || isMatch(item.date, safeExcludeTxt) || isMatch(item.beneficiary, safeExcludeTxt));
          }
        });
      }

      return list;

    } catch (error) { return []; }
  }, [allGroupedAndSorted, currentUser, historyTypeFilter, historyDateFilter, debouncedHistorySearch, debouncedHistoryExcludeSearch, pendingMap, billingStartDay]);

  const historyFilteredStats = useMemo(() => {
    let inc = 0; let exp = 0;
    (filteredHistoryGroups || []).forEach(item => {
      if (item.isGroup) {
        (item.children || []).forEach(c => { if (pendingMap[c.id] === 'DELETE_TX' || pendingMap[c.id] === 'HARD_DELETE_TX') return; if (c.type === "income") inc += (Number(c.amount) || 0); if (c.type === "expense") exp += (Number(c.amount) || 0); });
      } else {
        if (pendingMap[item.id] === 'DELETE_TX' || pendingMap[item.id] === 'HARD_DELETE_TX') return; if (item.type === "income") inc += (Number(item.amount) || 0);
        if (item.type === "expense") exp += (Number(item.amount) || 0);
      }
    });
    return { income: inc, expense: exp, balance: inc - exp };
  }, [filteredHistoryGroups, pendingMap]);

  function toggleGroup(gId) { triggerVibration(10); setExpandedGroups(p => ({ ...p, [gId]: !p[gId] })); }

  function renderStandaloneCard(tx, allowEdit = true) {
    const benArray = getBenArray(tx.beneficiary, tx.member);
    const pAction = pendingMap[tx.id];
    const hasEditRecord = auditLogs.some(log => String(log.txId) === String(tx.id));

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
                {hasEditRecord && (
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
  }

  function renderGroupCard(group, allowEdit = true) {
    const isExp = !!expandedGroups[group.groupId];
    const allBens = new Set();
    (group.children || []).forEach(c => { if(c.beneficiary) String(c.beneficiary).split(",").filter(Boolean).forEach(b => allBens.add(b.trim())); });
    const parentBenArray = getBenArray(Array.from(allBens).join(","), group.member);
    const gAction = pendingMap[group.groupId];
    const hasChildAction = (group.children || []).some(c => pendingMap[c.id]);
    const isPendingDeleteGroup = (group.children || []).every(c => pendingMap[c.id] === 'DELETE_TX' || pendingMap[c.id] === 'HARD_DELETE_TX');
    const hasEditRecord = auditLogs.some(log => String(log.txId) === String(group.groupId));

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
                  {hasEditRecord && (
                    <button onClick={(e) => { triggerVibration(10); e.stopPropagation(); setViewingHistoryItem(group); }} className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-md text-[9px] font-black border border-amber-200 active:scale-95 transition-transform whitespace-nowrap shrink-0">✏️ 已編輯</button>
                  )}
                </div>
                {group.parentDesc && <div className="text-[11px] text-gray-600 font-bold bg-gray-50 px-2.5 py-1.5 rounded-lg break-words w-full border border-gray-100 shadow-sm leading-relaxed">{group.parentDesc}</div>}
              </div>
            </div>
            <div className="flex flex-col items-end justify-center shrink-0 pl-1 z-10 mt-1 sm:mt-0">
              <div className={`font-black tabular-nums text-lg leading-none ${group.type==="income" ? "text-green-600" : "text-red-600"}`}>${Number(group.amount||0).toLocaleString()}</div>
              {group.recorder && group.recorder !== group.member && ( <div className={`mt-2 text-[9px] font-black px-1.5 py-0.5 rounded-md border shadow-sm ${group.recorder === "爸爸" ? "bg-blue-50 text-blue-600 border-blue-200" : group.recorder === "妈妈" ? "bg-pink-50 text-pink-600 border-pink-200" : "bg-gray-50 text-gray-500 border-gray-200"} whitespace-nowrap shrink-0`}>✍️ {group.recorder}代記</div> )}
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
  }

  function renderItemOrGroup(item, allowEdit) {
    if (item.isGroup) return renderGroupCard(item, allowEdit);
    return renderStandaloneCard(item, allowEdit);
  }

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
          triggerVibration={triggerVibration} 
          setShowClearCacheModal={setShowLoginClearCacheModal} 
          fallbackToPin={fallbackToPin} setFallbackToPin={setFallbackToPin} 
          handleBioLoginLocal={handleBioLoginLocal} showStatus={showStatus} 
          setCurrentUser={setCurrentUser} pinInput={pinInput} setPinInput={setPinInput} 
        />

        {showLoginClearCacheModal && (
          <div className="fixed inset-0 z-[800] bg-gray-900/90 backdrop-blur-md flex items-center justify-center p-8 animate-in text-white" onClick={(e) => { if(e.target === e.currentTarget && !isLoading) {setShowLoginClearCacheModal(false); 
          setLoginCachePassword("");} }}>
            <div className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 text-gray-900 relative text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><SvgIcon name="refresh" size={32} /></div>
              <h3 className="font-black text-lg mb-2 text-red-600">深度清理 (清空快取)</h3>
              <p className="text-xs text-gray-500 mb-5 font-bold leading-relaxed">這將刪除手機內所有歷史紀錄與暫存，並重新從雲端下載。請輸入「雲端密碼」以確認執行：</p>
              <input value={loginCachePassword} onChange={(e)=>setLoginCachePassword(e.target.value)} type="password" placeholder="請輸入雲端密碼" className="w-full bg-gray-100 rounded-2xl px-4 py-3 font-black outline-none mb-6 text-center tracking-widest" disabled={isLoading} />
              <div className="flex gap-3">
                <button onClick={() => {setShowLoginClearCacheModal(false); setLoginCachePassword("");}} disabled={isLoading} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black active:scale-95 disabled:opacity-50">取消</button>
                <button onClick={async () => {
                  if (!loginCachePassword) { showStatus("error", "請輸入雲端密碼"); return; }
                  if (!navigator.onLine) { showStatus("error", "需連線才能驗證雲端密碼"); return; }
                  try {
                    setLoadingCard({ show: true, text: "正在驗證密碼並清理快取..." });
                    const res = await postGAS({ action: "DEVICE_BOOTSTRAP", appSecret: loginCachePassword });
                    if (res.result !== "success") throw new Error("雲端密碼錯誤");
                    setTxCache([]); setSyncQueue([]); setLastServerTime(0); localStorage.clear(); localStorage.setItem('last_server_time_v1', '0');
                    const db = await initIndexedDB(); const tx = db.transaction(STORE_NAME, "readwrite"); tx.objectStore(STORE_NAME).clear();
                    if ('serviceWorker' in navigator) { const registrations = await navigator.serviceWorker.getRegistrations(); for (let r of registrations) await r.unregister(); }
                    if ('caches' in window) { const cacheNames = await caches.keys(); for (let c of cacheNames) await caches.delete(c); }
                    setShowLoginClearCacheModal(false); setLoginCachePassword(""); showStatus("success", "✅ 快取已清空，正在重新下載...");
                    setTimeout(() => { window.location.reload(true); }, 1500);
                  } catch(e) { showStatus("error", e.message || "驗證失敗"); }
                  finally { setLoadingCard({ show: false, text: "" }); }
                }} disabled={isLoading} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black active:scale-95 shadow-md shadow-red-500/30 disabled:opacity-50">確認清空</button>
              </div>
            </div>
          </div>
        )}

        {showBootstrapModal && (
          <div className="fixed inset-0 z-[600] bg-gray-900/90 backdrop-blur-md flex items-center justify-center p-8 animate-in">
            <div className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 text-gray-900 relative">
              <h3 className="font-black text-lg mb-2">首次綁定雲端</h3>
              <p className="text-[11px] text-gray-500 mb-5">請輸入雲端密碼（爸爸手機號碼）。</p>
              <input value={bootstrapSecret} onChange={(e)=>setBootstrapSecret(e.target.value)} placeholder="輸入爸爸手機號碼" className="w-full bg-gray-100 rounded-2xl px-4 py-3 font-black outline-none mb-5" />
              <button onClick={async () => { try { setLoadingCard({ show:true, text:"正在綁定雲端..." }); await bootstrapDevice(); setShowBootstrapModal(false); setBootstrapSecret(""); showStatus("success","✅ 雲端已綁定"); 
              } catch (e) { showStatus("error", e.message || "雲端密碼錯誤"); } finally { setLoadingCard({ show:false, text:"" }); 
              } }} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black active:scale-95 disabled:opacity-40">確認</button>
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
                <button onClick={() => { triggerVibration([30, 50, 30]); setSyncQueue([]); localStorage.removeItem(LS.pending); setShowClearQueueModal(false); showStatus("success", "✅ 已清空卡死的暫存資料"); 
                }} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black active:scale-95 shadow-md shadow-red-500/30">確認清除</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div translate="no" className="min-h-screen bg-gray-50 text-gray-900 pb-24 max-w-md mx-auto relative flex flex-col overflow-x-hidden w-full text-left font-black">
      
      <ProxyNotification transactions={unackedProxyTxs} onAck={() => { triggerVibration(15); const acked = safeParse(localStorage.getItem(LS.ackProxyTxs), []); const newAcked = [...new Set([...acked, ...unackedProxyTxs.map(t => t.id)])]; 
      localStorage.setItem(LS.ackProxyTxs, JSON.stringify(newAcked)); setUnackedProxyTxs([]); }} />

{/* 🌟 修正：將 AI 運算等待視窗拉到全域顯示 */}
      {isLoading && (
        <div className="fixed inset-0 z-[9999] bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-5 animate-in slide-in-from-bottom-4">
            <SvgIcon name="spinner" size={40} className="animate-spin text-blue-600" />
            <p className="font-black text-gray-800 text-sm tracking-widest">{loadingCard.text || "處理中..."}</p>
          </div>
        </div>
      )}
{/* 🌟 語音解析確認清單彈窗 (歷史清單同款高級圖卡 + 真實編輯頁面) */}
      {voiceReviewTxs && (() => {
        // 檢查是否有一筆紀錄正在被點擊編輯
        const editingIdx = voiceReviewTxs.findIndex(t => t.isEditing);
        
        // 如果有，直接呼叫系統標準的 EditTransactionModal (與歷史清單完全共用)
        if (editingIdx !== -1) {
          return (
            <EditTransactionModal 
              tx={voiceReviewTxs[editingIdx]} 
              loginUser={currentUser.name} 
              onSave={(updatedTx) => {
                const newTxs = [...voiceReviewTxs];
                delete updatedTx.isEditing;
                newTxs[editingIdx] = updatedTx;
                setVoiceReviewTxs(newTxs);
              }} 
              onDelete={() => {
                setVoiceReviewTxs(prev => prev.filter((_, i) => i !== editingIdx));
              }} 
              onCancel={() => { 
                triggerVibration(10); 
                const newTxs = [...voiceReviewTxs];
                delete newTxs[editingIdx].isEditing;
                setVoiceReviewTxs(newTxs);
              }} 
            />
          );
        }

        // 如果沒有在編輯，就顯示確認清單列表
        return (
          <div className="fixed inset-0 z-[1100] bg-gray-900/80 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 animate-in">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-5 sm:p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
              <h3 className="font-black text-xl mb-2 text-gray-800 flex items-center gap-2">
                <SvgIcon name="sparkles" size={24} className="text-blue-500" /> AI 解析結果確認
              </h3>
              <p className="text-[10px] text-gray-500 font-bold mb-4 bg-gray-50 p-2 rounded-lg">請確認自動生成的帳單，點擊右下角編輯圖示即可進入修改明細。</p>

              <div className="flex-1 overflow-y-auto pr-1 scrollbar-hide mb-4">
                {voiceReviewTxs.length === 0 ? (
                  <div className="text-center text-gray-400 py-10 text-sm font-bold bg-gray-50 rounded-3xl border border-gray-100">已清空所有紀錄</div>
                ) : (
                  voiceReviewTxs.map((tx, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-3xl border border-gray-100 flex items-start gap-3 shadow-sm relative overflow-hidden transition-colors mb-3">
                      
                      <div className="relative shrink-0 mt-1">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-[17px] leading-none ${tx.type==="income" ? "bg-green-600 text-white shadow-sm shadow-green-500/30" : "bg-red-600 text-white shadow-sm shadow-red-500/30"}`}>{tx.type==="income" ? "收入" : "支出"}</div>
                      </div>
                      
                      <div className="flex-1 min-w-0 pl-1 pt-1 pb-4">
                        <div className="font-bold text-[14px] leading-tight text-gray-800 flex items-center gap-1.5 flex-wrap">
                          <span className="truncate flex-shrink">{tx.category}</span>
                          <div className="flex gap-1 flex-wrap shrink-0">
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md border font-black bg-blue-50 text-blue-600 border-blue-200">{tx.beneficiary}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 mt-1.5 w-full items-start">
                          {tx.isGroup && tx.parentTitle && (
                            <span className="text-[9px] font-black text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 self-start">🏷️ 準備群組: {tx.parentTitle}</span>
                          )}
                          {tx.desc && <div className="text-[11px] text-gray-600 font-bold bg-gray-50 px-2.5 py-1.5 rounded-lg break-words w-full border border-gray-100 shadow-sm leading-relaxed">{tx.desc}</div>}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end justify-start shrink-0 pl-1 z-10 mt-1">
                        <div className={`font-black tabular-nums text-[17px] leading-none ${tx.type==="income" ? "text-green-600" : "text-red-600"}`}>${Number(tx.amount||0).toLocaleString()}</div>
                      </div>
                      
                      {/* 編輯按鈕：點擊後掛載 isEditing 標籤，喚叫系統編輯視窗 */}
                      <button onClick={() => {
                        triggerVibration(10);
                        const newTxs = [...voiceReviewTxs];
                        newTxs[idx].isEditing = true;
                        // 暫時給予隨機 ID 與日期以防 EditModal 錯誤
                        if (!newTxs[idx].id) newTxs[idx].id = "temp_" + Date.now();
                        if (!newTxs[idx].date) {
                           const now = new Date();
                           now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                           newTxs[idx].date = now.toISOString().slice(0, 16);
                        }
                        setVoiceReviewTxs(newTxs);
                      }} className="absolute bottom-2 right-10 p-1.5 text-gray-300 hover:text-blue-500 active:scale-90 transition-all">
                        <SvgIcon name="edit" size={15} />
                      </button>
                      
                      <button onClick={() => setVoiceReviewTxs(prev => prev.filter((_, i) => i !== idx))} className="absolute bottom-2 right-2 p-1.5 text-gray-300 hover:text-red-500 active:scale-90 transition-all">
                        <SvgIcon name="trash" size={15} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2 pt-1 border-t border-gray-100 mt-1">
                <button onClick={() => setVoiceReviewTxs(null)} className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-2xl font-black text-[13px] active:scale-95 transition-all">取消退出</button>
                <button 
                  onClick={handleConfirmVoice} 
                  disabled={voiceReviewTxs.length === 0}
                  className="flex-[2] py-3.5 bg-blue-600 text-white rounded-2xl font-black text-[15px] active:scale-95 transition-all shadow-xl shadow-blue-500/30 disabled:opacity-50"
                >
                  確認並寫入 ({voiceReviewTxs.length}筆)
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {editingTx && <EditTransactionModal tx={editingTx} loginUser={currentUser.name} onSave={handleUpdateTx} onDelete={handleDeleteTx} onCancel={() => { triggerVibration(10); setEditingTx(null); }} />}
      {editingGroup && <EditGroupParentModal group={editingGroup} onSave={handleUpdateGroupParent} onCancel={() => { triggerVibration(10); setEditingGroup(null); }} />}
      {showChangePinModal && <ChangePinModal currentUser={currentUser} onCancel={() => setShowChangePinModal(false)} onSuccess={() => {setShowChangePinModal(false); setCurrentUser(null); setSelectingUser(null); setPinInput(""); showStatus("success", "✅ 密碼已更新，請重新登入");}} forceReloginForToken={forceReloginForToken} />}

      {showTrashModal && (
        <div className="fixed inset-0 z-[600] bg-gray-900/90 backdrop-blur-sm overflow-y-auto flex flex-col items-center justify-center p-4 sm:p-6 animate-in font-black" onClick={(e) => { if(e.target === e.currentTarget) setShowTrashModal(false); 
        }}>
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
                    {(tx.desc || tx.parentDesc) && <div className="text-[10px] text-gray-500 truncate bg-white px-2 py-1 rounded-lg border border-gray-100 mt-1">{tx.parentTitle ? 
                    tx.parentTitle + ' - ' : ''}{tx.desc || tx.parentDesc}</div>}
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
        <div className="fixed inset-0 z-[700] bg-gray-900/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 animate-in font-black" onClick={(e) => { if(e.target === e.currentTarget) setViewingHistoryItem(null); 
        }}>
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl relative flex flex-col max-h-[85vh]">
            <button onClick={() => setViewingHistoryItem(null)} className="absolute top-6 right-6 text-gray-400 active:scale-90 transition-transform"><SvgIcon name="close" size={24}/></button>
            <h3 className="font-black text-lg mb-1 text-gray-800 pr-8 leading-tight flex items-center gap-2">✏️ 編輯歷程</h3>
            <p className="text-[10px] text-gray-500 font-bold mb-4 bg-gray-100 px-2 py-1 rounded-md self-start">{viewingHistoryItem.isGroup ? viewingHistoryItem.parentTitle : `${getParentCat(viewingHistoryItem.category)} - ${getChildCat(viewingHistoryItem.category)}`}</p>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
              {(() => {
                const logs = auditLogs
                  .filter(l => String(l.txId) === String(viewingHistoryItem.id) || String(l.id) === String(viewingHistoryItem.id) || String(l.txId) === String(viewingHistoryItem.groupId))
                  .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));

                if (logs.length === 0) return <div className="text-gray-400 text-sm text-center py-4">無編輯紀錄</div>;

                return logs.map((h, i) => (
                  <div key={i} className="bg-white p-4 rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-400"></div>
                    <div className="flex justify-between items-center mb-2 pl-2 border-b border-gray-50 pb-2">
                      <span className="font-black text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">{h.action || "編輯紀錄"}</span>
                      <span className="text-[9px] text-gray-400 font-bold">{h.time}</span>
                    </div>
                    <div className="pl-1 mt-1 text-[10px] text-gray-500 bg-gray-50 p-2 rounded-xl border border-gray-100 whitespace-pre-wrap break-words">
                      {h.content || h.oldContent || '已更新內容'}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {analysisDetailData && (
        <div className="fixed inset-0 z-[600] bg-gray-900/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 animate-in text-left font-black" onClick={(e) => { if(e.target === e.currentTarget) setAnalysisDetailData(null); 
        }}>
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

      {showClearCacheModal && (
        <div className="fixed inset-0 z-[800] bg-gray-900/90 backdrop-blur-md flex items-center justify-center p-8 animate-in text-white" onClick={(e) => { if(e.target === e.currentTarget && !isLoading) {setShowClearCacheModal(false); 
        setCacheClearPassword("");} }}>
          <div className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 text-gray-900 relative text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><SvgIcon name="refresh" size={32} /></div>
            <h3 className="font-black text-lg mb-2 text-red-600">深度清理 (清空快取)</h3>
            <p className="text-xs text-gray-500 mb-5 font-bold leading-relaxed">這將刪除手機內所有歷史紀錄與暫存，並重新從雲端下載。請輸入「雲端密碼」以確認執行：</p>
            <input value={cacheClearPassword} onChange={(e)=>setCacheClearPassword(e.target.value)} type="password" placeholder="請輸入雲端密碼" className="w-full bg-gray-100 rounded-2xl px-4 py-3 font-black outline-none mb-6 text-center tracking-widest" disabled={isLoading} />
            <div className="flex gap-3">
              <button onClick={() => {setShowClearCacheModal(false); setCacheClearPassword("");}} disabled={isLoading} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black active:scale-95 disabled:opacity-50">取消</button>
              <button onClick={async () => {
                if (!cacheClearPassword) { showStatus("error", "請輸入雲端密碼"); return; }
                if (!navigator.onLine) { showStatus("error", "需連線才能驗證雲端密碼"); return; }
                try {
                  setLoadingCard({ show: true, text: "正在驗證密碼並清理快取..." });
                  const res = await postGAS({ action: "DEVICE_BOOTSTRAP", appSecret: cacheClearPassword });
                  if (res.result !== "success") throw new Error("雲端密碼錯誤");
                  setTxCache([]); setSyncQueue([]); setLastServerTime(0); localStorage.clear(); localStorage.setItem('last_server_time_v1', '0');
                  const db = await initIndexedDB(); const tx = db.transaction(STORE_NAME, "readwrite"); tx.objectStore(STORE_NAME).clear();
                  if ('serviceWorker' in navigator) { const registrations = await navigator.serviceWorker.getRegistrations(); for (let r of registrations) await r.unregister(); }
                  if ('caches' in window) { const cacheNames = await caches.keys(); for (let c of cacheNames) await caches.delete(c); }
                  setShowClearCacheModal(false); setCacheClearPassword(""); showStatus("success", "✅ 快取已清空，正在重新下載...");
                  setTimeout(() => { window.location.reload(true); }, 1500);
                } catch(e) { showStatus("error", e.message || "驗證失敗"); }
                finally { setLoadingCard({ show: false, text: "" }); }
              }} disabled={isLoading} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black active:scale-95 shadow-md shadow-red-500/30 disabled:opacity-50">確認清空</button>
            </div>
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
            snapshotsCache={snapshotsCache}
          />
        )}

        {activeTab === "add" && <AddTransactionForm loginUser={currentUser.name} onSubmit={handleAdd} onClose={() => setActiveTab('dashboard')} />}

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
        onQuickAdd={handleAdd}
        loginUser={currentUser?.name}
        onVoiceRecordStop={handleVoiceRecordStop} 
      />

      {statusMsg.text && (
        <div className="fixed bottom-24 left-0 right-0 flex justify-center z-[1000] pointer-events-none px-4 text-center">
          <div className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in pointer-events-auto ${statusMsg.type === "success" ? 
          "bg-green-600 text-white" : statusMsg.type === "error" ? "bg-red-600 text-white" : statusMsg.type === "info" ? 
          "bg-gray-800 text-white border border-gray-600" : "bg-blue-600 text-white"}`}>
            <span className="text-sm font-bold tracking-tight text-center">{statusMsg.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;