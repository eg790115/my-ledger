import { initializeApp } from "firebase/app";
// 🚀 引入離線快取模組：enableIndexedDbPersistence
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

let app;
export let db;

export const initFirebase = (config) => {
  if (!app) {
    app = initializeApp(config);
    db = getFirestore(app);

    // 🚀 啟動超強的離線模式！
    // 即使在沒有網路的地下室，APP 也能開啟、讀取舊帳單，並且允許你新增/刪除帳項。
    // 等到網路一恢復，Firestore 就會自動在背景把所有操作同步上雲端。
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code == 'failed-precondition') {
        console.warn("離線快取啟動失敗：可能開啟了多個分頁");
      } else if (err.code == 'unimplemented') {
        console.warn("這個瀏覽器不支援離線快取");
      }
    });
  }
};