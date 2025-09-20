document.addEventListener("DOMContentLoaded", () => {

    // ================== SOS MANAGEMENT ==================
    function generateSOSId() {
        let lastId = parseInt(localStorage.getItem("lastSOSId") || "0");
        lastId++;
        localStorage.setItem("lastSOSId", lastId);
        return lastId;
    }

    function createSOS(lat, lng, policeStationName = "Unknown") {
        if (typeof lat !== "number" || typeof lng !== "number") {
            console.error("Invalid coordinates for SOS!");
            return;
        }
        let sosLogs = getSOS();
        const newSOS = {
            id: generateSOSId(),
            lat: lat,
            lng: lng,
            timestamp: new Date().toISOString(),
            status: "Pending",
            policeStation: policeStationName
        };
        sosLogs.push(newSOS);
        saveSOS(sosLogs);
        lastSOSCount = sosLogs.length;
        window.dispatchEvent(new Event('storage'));
    }

    // ================== LOCAL STORAGE HELPERS ==================
    function getSOS() { return JSON.parse(localStorage.getItem("sosLogs") || "[]"); }
    function saveSOS(data) { localStorage.setItem("sosLogs", JSON.stringify(data)); }
    function getHistory() { return JSON.parse(localStorage.getItem("sosHistory") || "[]"); }
    function saveHistory(data) { localStorage.setItem("sosHistory", JSON.stringify(data)); }
    function addToHistory(log, action) {
        let history = getHistory();
        history.push({ id: log.id, ...log, action, actionTime: new Date().toLocaleString() });
        saveHistory(history);
    }

    // ================== MAP & UI ==================
    const sosContainer = document.getElementById("sosContainer");
    const map = L.map('map').setView([20.5937, 78.9629], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const siren = document.getElementById("siren");
    const enableBtn = document.getElementById("enableSirenBtn");
    let markers = [];
    let statusChart;
    let lastSOSCount = getSOS().length;
    let sirenEnabled = false;
    let sirenInterval = null;

    // ================== ENABLE SIREN BUTTON ==================
    enableBtn.addEventListener("click", () => {
        sirenEnabled = true;
        siren.play().catch(() => console.log("Siren blocked until user interacts"));
        alert("Alerts enabled. Siren will repeat every 30s while pending.");
        enableBtn.style.display = "none";
        startSirenLoop();
    });

    function startSirenLoop() {
        if (sirenInterval) return;
        sirenInterval = setInterval(() => {
            let sosLogs = getSOS();
            if (sirenEnabled && sosLogs.some(s => s.status === "Pending")) {
                siren.play().catch(() => console.log("Siren blocked until user interacts"));
            } else {
                stopSirenLoop();
            }
        }, 30000);
    }

    function stopSirenLoop() {
        if (sirenInterval) {
            clearInterval(sirenInterval);
            sirenInterval = null;
        }
    }

    // ================== LOAD SOS ==================
    async function loadSOS() {
        sosContainer.innerHTML = "<h2>📋 Active SOS Alerts</h2>";

        // Remove old markers
        markers.forEach(m => map.removeLayer(m));
        markers = [];

        let sosLogs = getSOS();
        sosLogs = sosLogs.map(log => ({ ...log, id: log.id || generateSOSId() }));
        saveSOS(sosLogs);

        if (sosLogs.length === 0) {
            sosContainer.innerHTML += "<p>No SOS alerts yet.</p>";
            updateChart();
            stopSirenLoop();
            return;
        }

        // Play siren immediately on new SOS
        if (sirenEnabled && sosLogs.length > lastSOSCount) {
            siren.play().catch(() => console.log("Siren blocked until user interacts"));
        }
        lastSOSCount = sosLogs.length;

        for (const log of sosLogs) {
            if (!log.status) log.status = "Pending";

            let item = document.getElementById("sosItem_" + log.id);
            if (!item) {
                // Create DOM
                item = document.createElement("div");
                item.id = "sosItem_" + log.id;
                item.className = "sosItem";
                item.innerHTML = `
                    <div>
                        🆔 ID: <b>${log.id}</b><br>
                        🚨 <a href="https://maps.google.com/?q=${log.lat},${log.lng}" target="_blank">
                        Location: (${log.lat.toFixed(5)}, ${log.lng.toFixed(5)})</a><br>
                        ⏰ ${new Date(log.timestamp).toLocaleString()}<br>
                        📌 Status: <b>${log.status}</b><br>
                        🏢 Nearest Police Station: <span class="policeStationName" style="font-style:italic;color:#ffffff;font-weight:bold;">
                            ${log.policeStation || "Fetching..."}
                        </span>
                    </div>
                    <div>
                        <button class="statusBtn pending">Pending</button>
                        <button class="statusBtn progress">In Progress</button>
                        <button class="statusBtn resolved">Resolved</button><br>
                        <button class="deleteBtn">Delete</button>
                    </div>
                `;
                sosContainer.appendChild(item);

                // Buttons
                item.querySelector(".pending").onclick = () => updateStatus(log.id, "Pending");
                item.querySelector(".progress").onclick = () => updateStatus(log.id, "In Progress");
                item.querySelector(".resolved").onclick = () => updateStatus(log.id, "Resolved");
                item.querySelector(".deleteBtn").onclick = () => deleteSOS(log.id);

                // Map marker
                const marker = L.marker([log.lat, log.lng]).addTo(map)
                    .bindPopup(`<b>🚨 SOS Alert</b><br>Status: ${log.status}<br>${new Date(log.timestamp).toLocaleString()}`);
                markers.push(marker);

                // Immediately fetch police station for new SOS
                (async () => {
                    const span = item.querySelector(".policeStationName");
                    try {
                        const stationName = await getNearestPoliceStation(log.lat, log.lng);
                        log.policeStation = stationName;
                        span.innerText = stationName;
                        saveSOS(getSOS());
                    } catch {
                        span.innerText = "Unknown";
                    }
                })();
            }
        }

        if (markers.length > 0) {
            const group = new L.featureGroup(markers);
            map.fitBounds(group.getBounds().pad(0.5));
        }

        updateChart();

        if (sirenEnabled && sosLogs.some(s => s.status === "Pending")) startSirenLoop();
        else stopSirenLoop();
    }

    // ================== STATUS & DELETE ==================
    function updateStatus(id, status) {
        let sosLogs = getSOS();
        const sos = sosLogs.find(s => s.id === id);
        if (!sos) return;
        sos.status = status;
        saveSOS(sosLogs);
        addToHistory(sos, `Status set to ${status}`);
        loadSOS();
    }

    function deleteSOS(id) {
        let sosLogs = getSOS();
        const idx = sosLogs.findIndex(s => s.id === id);
        if (idx === -1) return;
        addToHistory(sosLogs[idx], "Deleted from active");
        sosLogs.splice(idx, 1);
        saveSOS(sosLogs);
        loadSOS();
    }

    // ================== CHART ==================
    function updateChart() {
        let sosLogs = getSOS();
        let counts = { "Pending": 0, "In Progress": 0, "Resolved": 0 };
        sosLogs.forEach(log => counts[log.status || "Pending"]++);
        const data = {
            labels: ["Pending", "In Progress", "Resolved"],
            datasets: [{
                label: "Active SOS Count",
                data: [counts["Pending"], counts["In Progress"], counts["Resolved"]],
                backgroundColor: ["#d32f2f", "#fbc02d", "#388e3c"]
            }]
        };
        if (statusChart) {
            statusChart.data.datasets[0].data = data.datasets[0].data;
            statusChart.update();
        } else {
            const ctx = document.getElementById("statusChart").getContext("2d");
            statusChart = new Chart(ctx, {
                type: "bar",
                data: data,
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                }
            });
        }
    }

    // ================== HISTORY ==================
    window.openHistory = function () { document.getElementById("historyModal").style.display = "flex"; loadHistory(); }
    window.closeHistory = function () { document.getElementById("historyModal").style.display = "none"; }

    function loadHistory() {
        const historyList = document.getElementById("historyList");
        let history = getHistory();
        if (history.length === 0) { historyList.innerHTML = "<p>No history available.</p>"; return; }
        historyList.innerHTML = "";
        history.forEach((h, idx) => {
            const div = document.createElement("div");
            div.className = "historyItem";
            div.innerHTML = `
                🆔 ID: <b>${h.id}</b><br>
                📍 (${h.lat.toFixed(5)},${h.lng.toFixed(5)})<br>
                🕒 Original: ${new Date(h.timestamp).toLocaleString()}<br>
                🔔 Action: ${h.action}<br>
                ⏰ At: ${h.actionTime}<br>
                <button class="deleteHistoryBtn" onclick="deleteHistory(${idx})">🗑 Delete</button>
            `;
            historyList.appendChild(div);
        });
    }

    window.deleteHistory = function (idx) {
        let history = getHistory();
        history.splice(idx, 1);
        saveHistory(history);
        loadHistory();
    }

    window.downloadHistory = function () {
        let history = getHistory();
        if (history.length === 0) { alert("No history to download."); return; }
        let csv = "Latitude,Longitude,Original Time,Action,Action Time\n";
        history.forEach(h => {
            csv += `${h.lat},${h.lng},${new Date(h.timestamp).toLocaleString()},${h.action},${h.actionTime}\n`;
        });
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "sos_history.csv"; a.click();
    }

    // ================== REAL-TIME ==================
    window.addEventListener('storage', e => { if (e.key === "sosLogs") loadSOS(); });

    // ================== INITIAL LOAD ==================
    loadSOS();

    // ================== UPDATE POLICE STATION EVERY 3 MINS ==================
    setInterval(async () => {
        let sosLogs = getSOS();
        let changed = false;
        for (const log of sosLogs) {
            if (log.status !== "Pending") continue;
            const item = document.getElementById("sosItem_" + log.id);
            if (!item) continue;
            const span = item.querySelector(".policeStationName");
            if (!span) continue;

            try {
                const stationName = await getNearestPoliceStation(log.lat, log.lng);
                if (stationName !== log.policeStation) {
                    log.policeStation = stationName;
                    span.innerText = stationName;
                    changed = true;
                }
            } catch {
                span.innerText = log.policeStation || "Unknown";
            }
        }
        if (changed) saveSOS(sosLogs);
    }, 180000); // every 3 minutes

});

// ================== FETCH NEAREST POLICE STATION ==================
async function getNearestPoliceStation(lat, lng) {
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&amenity=police&limit=1&viewbox=${lng - 0.05},${lat + 0.05},${lng + 0.05},${lat - 0.05}&bounded=1`;
        const response = await fetch(url);
        const data = await response.json();
        if (data && data.length > 0) {
            const fullName = data[0].display_name;
            const shortName = fullName.split(',')[0];
            return shortName.trim();
        }
        return "Unknown Police Station";
    } catch (err) {
        console.error("Error fetching police station:", err);
        return "Error fetching police station";
    }
}
