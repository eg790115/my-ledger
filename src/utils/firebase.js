// src/utils/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

// 你的 Firebase 專屬配置
const firebaseConfig = {
  apiKey: "AIzaSyD1jvVCdVXgxXxDhwGfMuriERLacw77AIA",
  authDomain: "my-ledger-90bde.firebaseapp.com",
  projectId: "my-ledger-90bde",
  storageBucket: "my-ledger-90bde.firebasestorage.app",
  messagingSenderId: "180108630904",
  appId: "1:180108630904:web:1f36fb6d0b0f00a294068d"
};

// 初始化 Firebase 核心
const app = initializeApp(firebaseConfig);

// 初始化 Firestore 資料庫並匯出，讓整個 APP 都能使用
export const db = getFirestore(app);

// 🚀 啟動外掛：Firestore 內建的「離線持久化」神級功能
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn("⚠️ 多個分頁開啟，離線模式只能在單一分頁啟用");
  } else if (err.code === 'unimplemented') {
    console.warn("⚠️ 目前的瀏覽器不支援離線模式");
  }
});