import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

export let db = null;

// 這個函式負責接收從 GAS 傳來的機密鑰匙，然後瞬間組裝 Firebase
export const initFirebase = (firebaseConfig) => {
  if (!firebaseConfig || !firebaseConfig.projectId) {
    throw new Error("❌ 無效的 Firebase 設定檔，請確認 GAS 回傳資料");
  }
  
  try {
    let app;
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    db = getFirestore(app);
    return db;
  } catch (error) {
    console.error("🔥 Firebase 組裝失敗:", error);
    throw error;
  }
};