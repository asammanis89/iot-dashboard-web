import { db, ref, onValue, set, push, query, limitToLast } from "./firebase-config.js";

// === PATH DATABASE ===
const pathSuhu = ref(db, 'Dapur/Suhu');
const pathHum = ref(db, 'Dapur/Kelembapan');
const pathGas = ref(db, 'Dapur/Gas');
const pathDevice = ref(db, 'Dapur/Status');
const pathLogs = ref(db, 'logs');

// === CHART SETUP ===
const ctx = document.getElementById('myChart').getContext('2d');
const myChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            { label: 'Suhu (°C)', data: [], borderColor: '#4C7CF6', tension: 0.4 },
            { label: 'Gas (PPM)', data: [], borderColor: '#dc3545', tension: 0.4 }
        ]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { x: { display: false } } }
});

let logDataExport = [];

// === FUNGSI UPDATE TAMPILAN KONEKSI & TOGGLE ===
function updateConnectionUI(isConnected, isDeviceOn) {
    const iconBg = document.getElementById('status-icon-bg');
    const icon = document.getElementById('status-icon');
    const textStatus = document.getElementById('connection-text');
    const toggleBtn = document.getElementById('btn-toggle');
    const ledText = document.getElementById('led-txt');

    if (isConnected) {
        // JIKA ONLINE
        iconBg.className = "rounded-circle bg-success bg-opacity-10 p-3 me-3 text-success";
        icon.className = "bi bi-wifi fs-2";
        textStatus.innerText = "Sistem Online";
        textStatus.className = "fw-bold mb-0 text-success";
        
        toggleBtn.disabled = false; // Aktifkan tombol

        // Update Teks ON/OFF
        if (isDeviceOn) {
            ledText.innerText = "NYALA";
            ledText.className = "fw-bold me-3 text-success";
        } else {
            ledText.innerText = "MATI";
            ledText.className = "fw-bold me-3 text-muted";
        }

    } else {
        // JIKA OFFLINE (Simulasi awal)
        iconBg.className = "rounded-circle bg-secondary bg-opacity-10 p-3 me-3 text-secondary";
        icon.className = "bi bi-wifi-off fs-2";
        textStatus.innerText = "Terputus...";
        textStatus.className = "fw-bold mb-0 text-muted";
        
        toggleBtn.disabled = true; // Matikan tombol agar ga bisa dipencet
        ledText.innerText = "-";
    }
}

// === 1. MONITORING ===
onValue(pathSuhu, (snap) => {
    const t = snap.val() || 0;
    document.getElementById('val-suhu').innerText = t;
    updateChart(t, null);
    
    // Asumsi: Kalau data suhu masuk, berarti Online
    // Kita cek status tombol saat ini untuk update UI
    const currentToggleState = document.getElementById('btn-toggle').checked;
    updateConnectionUI(true, currentToggleState);
});

onValue(pathHum, (snap) => {
    document.getElementById('val-hum').innerText = snap.val() || 0;
});

onValue(pathGas, (snap) => {
    const g = snap.val() || 0;
    document.getElementById('val-gas').innerText = g;
    updateChart(null, g);
});

function updateChart(t, g) {
    const now = new Date().toLocaleTimeString();
    if (myChart.data.labels.length > 20) {
        myChart.data.labels.shift();
        myChart.data.datasets[0].data.shift();
        myChart.data.datasets[1].data.shift();
    }
    if(t !== null) {
        myChart.data.labels.push(now);
        myChart.data.datasets[0].data.push(t);
        if(myChart.data.datasets[1].data.length < myChart.data.datasets[0].data.length)
             myChart.data.datasets[1].data.push(myChart.data.datasets[1].data.at(-1));
    }
    if(g !== null) {
        if(myChart.data.datasets[1].data.length > 0)
            myChart.data.datasets[1].data[myChart.data.datasets[1].data.length-1] = g;
        else 
            myChart.data.datasets[1].data.push(g);
    }
    myChart.update();
}

// === 2. KONTROL (ON/OFF) ===
onValue(pathDevice, (snap) => {
    const isOn = snap.val() === true;
    document.getElementById('btn-toggle').checked = isOn;
    
    // Update UI (Status Online + Status Nyala/Mati)
    updateConnectionUI(true, isOn);
});

document.getElementById('btn-toggle').addEventListener('change', function() {
    set(pathDevice, this.checked);
    logToFirebase(this.checked ? "LED Dinyalakan" : "LED Dimatikan", "Kontrol");
    
    // Update UI Langsung agar responsif
    updateConnectionUI(true, this.checked);
});

// === 3. LOGS & REKAP ===
onValue(query(pathLogs, limitToLast(50)), (snap) => {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = "";
    logDataExport = [];
    let maxTempToday = 0;
    let gasAlertCount = 0;
    let dataCount = 0;
    const todayStr = new Date().toLocaleDateString('en-US'); 

    if (snap.exists()) {
        const data = Object.values(snap.val()).reverse();
        data.forEach(item => {
            logDataExport.push(item);
            if (item.timestamp && item.timestamp.includes(todayStr)) {
                dataCount++;
                let tempVal = parseFloat(item.suhu);
                if (!isNaN(tempVal) && tempVal > maxTempToday) maxTempToday = tempVal;
                if (item.action !== "Kontrol" && item.desc.includes("Gas")) {
                    let gasVal = parseInt(item.desc.split(": ")[1]);
                    if (gasVal > 400) gasAlertCount++;
                }
            }
            if (logDataExport.length <= 20) {
                let badge = item.action === "Kontrol" ? '<span class="badge bg-primary">Kontrol</span>' : '<span class="badge bg-secondary">Log</span>';
                if (item.desc && item.desc.includes("Gas") && parseInt(item.desc.split(": ")[1]) > 400) badge = '<span class="badge bg-danger">Bahaya</span>';
                tbody.innerHTML += `<tr><td>${item.timestamp}</td><td>${item.suhu || '-'}°C</td><td>${item.kelembapan || '-'}%</td><td>${item.desc || '-'}</td><td>${badge}</td></tr>`;
            }
        });
        document.getElementById('log-max-temp').innerText = maxTempToday;
        document.getElementById('log-gas-alert').innerText = gasAlertCount;
        document.getElementById('log-count').innerText = dataCount;
    } else {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Belum ada data.</td></tr>';
    }
});

function logToFirebase(action, type) {
    const d = new Date();
    const ts = d.toLocaleDateString('en-US') + ", " + d.toLocaleTimeString(); 
    push(pathLogs, {
        timestamp: ts, action: type, suhu: document.getElementById('val-suhu').innerText, kelembapan: document.getElementById('val-hum').innerText,
        desc: action + ` | Gas: ${document.getElementById('val-gas').innerText}`
    });
}

document.getElementById('btn-export').addEventListener('click', function() {
    let csv = "Timestamp,Suhu,Hum,Deskripsi,Tipe\n";
    logDataExport.forEach(row => { csv += `${row.timestamp},${row.suhu},${row.kelembapan},${row.desc},${row.action}\n`; });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Data_Log_Dapur.csv'; a.click();
});