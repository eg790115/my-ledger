import { create } from 'zustand';

// 🌟 純函式掛載，脫離狀態依賴
const triggerVibrationUtil = (pattern) => {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    try { window.navigator.vibrate(pattern); } catch (e) {}
  }
};

export const useAppStore = create((set, get) => ({
  // 1. 導覽列狀態
  activeTab: "dashboard",
  setActiveTab: (updater) => set((state) => ({
    activeTab: typeof updater === 'function' ? updater(state.activeTab) : updater
  })),

  // 2. 網路狀態
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  setIsOnline: (updater) => set((state) => ({
    isOnline: typeof updater === 'function' ? updater(state.isOnline) : updater
  })),

  // 3. 全域讀取/等待卡片
  loadingCard: { show: false, text: "" },
  setLoadingCard: (updater) => set((state) => ({
    loadingCard: typeof updater === 'function' ? updater(state.loadingCard) : updater
  })),

  // 4. 全域震動工具
  triggerVibration: triggerVibrationUtil,

  // 5. 全域提示訊息機制 (🌟 終極強化版)
  statusMsg: { type: "", text: "" },
  toastTimer: null, // 在 Store 內部嚴格控管計時器
  
  showStatus: (type, text) => {
    if (type === "success") triggerVibrationUtil([20, 50, 20]);
    else if (type === "error") triggerVibrationUtil([50, 50, 50, 50, 50]);
    else if (type === "info") triggerVibrationUtil(15);

    // 🛑 核心修復：精準攔截並清除上一個計時器，絕不讓提示框被異常關閉
    const currentTimer = get().toastTimer;
    if (currentTimer) clearTimeout(currentTimer);

    // 立即渲染新訊息
    set({ statusMsg: { type: type || "info", text: text || "" } });

    // 只有在真的有文字時，才啟動 3 秒倒數關閉
    if (text) {
      const newTimer = setTimeout(() => {
        set({ statusMsg: { type: "", text: "" }, toastTimer: null });
      }, 3000);
      set({ toastTimer: newTimer });
    }
  }
}));