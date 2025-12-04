import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set, push, query, limitToLast } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// SUDAH DIISI SESUAI PERMINTAAN
const firebaseConfig = {
    apiKey: "AIzaSyAK302-h3aOMZuK-8Gpbpj8yN3CkDyB-30",
    authDomain: "monitorapps-arfobhekel2.firebaseapp.com",
    databaseURL: "https://monitorapps-arfobhekel2-default-rtdb.firebaseio.com",
    projectId: "monitorapps-arfobhekel2",
    storageBucket: "monitorapps-arfobhekel2.firebasestorage.app",
    messagingSenderId: "473717940748",
    appId: "1:473717940748:web:542f9cad4406ffc4fac429",
    measurementId: "G-FZ2M1QMTX7"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, onValue, set, push, query, limitToLast };