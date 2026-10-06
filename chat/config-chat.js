// ==========================================
// FILE: chat/config-chat.js
// FUNGSI: Otentikasi Proyek Chatting Eksternal (RTDB)
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const firebaseConfigChat = {
  apiKey: "AIzaSyArsaabjy6lr1lzYCBS__1IsjOnhntnzvE",
  authDomain: "chatting-88040.firebaseapp.com",
  databaseURL: "https://chatting-88040-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chatting-88040",
  storageBucket: "chatting-88040.firebasestorage.app",
  messagingSenderId: "252383215816",
  appId: "1:252383215816:web:e029860517ce1ec77ea5fd"
};

// Menginisialisasi Firebase sekunder dengan namespace khusus obrolan
const chatApp = initializeApp(firebaseConfigChat, "komunikasiEksternal");
export const dbChat = getDatabase(chatApp);
