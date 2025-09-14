// ================== MAP ==================
let map = L.map('map').setView([20.5937, 78.9629], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

let userMarker, sourceMarker, destMarker, currentRoute = null, currentPointer = null;
let sourceCoords = null, destCoords = null;

// ================== SPEECH ==================
let language = 'en-US';
function speak(text) {
  let msg = new SpeechSynthesisUtterance(text);
  msg.lang = language;
  window.speechSynthesis.speak(msg);
}

// ================== GEOLOCATION ==================
function updateUserLocation(lat, lng) {
  if (!userMarker) {
    userMarker = L.marker([lat, lng]).addTo(map).bindPopup("📍 You are here").openPopup();
    map.setView([lat, lng], 15);
    if (!sourceCoords) sourceCoords = [lat, lng];
  } else {
    userMarker.setLatLng([lat, lng]);
  }
  updateCurrentPointer(lat, lng);
  updateWeather(lat, lng);
}

// Update weather every 60 seconds automatically
setInterval(() => {
  if (userMarker) {
    const { lat, lng } = userMarker.getLatLng();
    updateWeather(lat, lng);
  }
}, 60000);

if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    pos => {
      let lat = pos.coords.latitude, lng = pos.coords.longitude;
      updateUserLocation(lat, lng);
    },
    err => {
      console.error("Geolocation error:", err);
      alert("Unable to fetch GPS location. Please enable location services.");
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

document.getElementById("locateBtn").onclick = () => {
  if (userMarker) map.setView(userMarker.getLatLng(), 15);
};

// ================== CURRENT POINTER ==================
function updateCurrentPointer(lat, lng) {
  if (!currentPointer) {
    currentPointer = L.marker([lat, lng], {
      icon: L.icon({
        iconUrl: 'https://maps.google.com/mapfiles/ms/icons/arrow.png',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      })
    }).addTo(map);
  } else {
    currentPointer.setLatLng([lat, lng]);
  }
}

// ================== WEATHER ==================
const WEATHER_API_KEY = "babf7185d1e84dcc939204740251409";

async function updateWeather(lat, lon) {
  try {
    const resp = await fetch(`https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${lat},${lon}`);
    if (!resp.ok) throw new Error("Failed to fetch weather");
    const data = await resp.json();

    document.getElementById("weatherInfo").innerHTML = `
      ${data.current.temp_c}°C, ${data.current.condition.text}
      <img src="https:${data.current.condition.icon}" alt="weather">
    `;
  } catch (e) {
    console.error(e);
    document.getElementById("weatherInfo").innerText = "Unable to fetch weather";
  }
}

// ================== AUTOCOMPLETE ==================
function setupAutocomplete(inputId, suggestionsId, isSource) {
  const input = document.getElementById(inputId),
        box = document.getElementById(suggestionsId);

  input.addEventListener("input", () => {
    let query = input.value.trim();
    if (query.length < 3) { box.style.display = 'none'; return; }

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=5`)
      .then(r => r.json())
      .then(data => {
        box.innerHTML = '';
        data.forEach(place => {
          const div = document.createElement("div");
          div.className = "suggestion-item";
          div.textContent = place.display_name;
          div.onclick = () => {
            input.value = place.display_name;
            box.style.display = 'none';
            const coords = [+place.lat, +place.lon];
            if (isSource) {
              sourceCoords = coords;
              if (sourceMarker) map.removeLayer(sourceMarker);
              sourceMarker = L.marker(coords, {
                icon: L.icon({
                  iconUrl: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
                  iconSize: [32, 32],
                  iconAnchor: [16, 32]
                })
              }).addTo(map);
            } else {
              destCoords = coords;
              if (destMarker) map.removeLayer(destMarker);
              destMarker = L.marker(coords, {
                icon: L.icon({
                  iconUrl: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                  iconSize: [32, 32],
                  iconAnchor: [16, 32]
                })
              }).addTo(map);
            }
          };
          box.appendChild(div);
        });
        box.style.display = 'block';
      });
  });
}

setupAutocomplete("source", "sourceSuggestions", true);
setupAutocomplete("destination", "destinationSuggestions", false);

// ================== SET SOURCE/DEST TO MY LOCATION ==================
document.getElementById("setSourceBtn").onclick = () => {
  if (!userMarker) { alert("Location not available yet"); return; }
  const { lat, lng } = userMarker.getLatLng();
  sourceCoords = [lat, lng];
  document.getElementById("source").value = "My Location";
  if (sourceMarker) map.removeLayer(sourceMarker);
  sourceMarker = L.marker([lat, lng], {
    icon: L.icon({
      iconUrl: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    })
  }).addTo(map).bindPopup("Source: My Location").openPopup();
};

document.getElementById("setDestBtn").onclick = () => {
  if (!userMarker) { alert("Location not available yet"); return; }
  const { lat, lng } = userMarker.getLatLng();
  destCoords = [lat, lng];
  document.getElementById("destination").value = "My Location";
  if (destMarker) map.removeLayer(destMarker);
  destMarker = L.marker([lat, lng], {
    icon: L.icon({
      iconUrl: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    })
  }).addTo(map).bindPopup("Destination: My Location").openPopup();
};

// ================== ROUTING ==================
async function showRoute(traffic = false) {
  if (!sourceCoords || !destCoords) { alert("Select source and destination"); return; }
  if (currentRoute) map.removeControl(currentRoute);

  if (traffic) {
    const apiKey = "YOUR_OPENROUTESERVICE_API_KEY"; 
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${sourceCoords[1]},${sourceCoords[0]}&end=${destCoords[1]},${destCoords[0]}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.features) {
      const coords = data.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
      const dist = (data.features[0].properties.summary.distance / 1000).toFixed(2);
      const time = (data.features[0].properties.summary.duration / 60).toFixed(1);
      L.polyline(coords, { color: "red" }).addTo(map);
      map.fitBounds(coords);
      document.getElementById("routeInfo").innerHTML = `Traffic Route: ${dist} km | ${time} mins`;
      speak(`Best route considering traffic is ${dist} kilometers, ${time} minutes`);
    }
  } else {
    currentRoute = L.Routing.control({
      waypoints: [L.latLng(sourceCoords), L.latLng(destCoords)],
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      lineOptions: { styles: [{ color: 'blue', weight: 5 }] },
      createMarker: () => null
    }).addTo(map);

    document.getElementById("infoPanel").style.display = 'block';

    currentRoute.on('routesfound', e => {
      let route = e.routes[0], summary = route.summary;
      let dist = (summary.totalDistance / 1000).toFixed(2),
          time = (summary.totalTime / 60).toFixed(1);
      document.getElementById("routeInfo").innerHTML = `Distance: ${dist} km | Time: ${time} mins`;
      let stepsHtml = "<ol>";
      route.instructions.forEach(instr => stepsHtml += `<li>${instr.text}</li>`);
      stepsHtml += "</ol>";
      document.getElementById("steps").innerHTML = stepsHtml;
      speak(`You need to go ${dist} kilometers, approximately ${time} minutes`);
    });
  }
}

document.getElementById("startNavBtn").onclick = () => showRoute(false);
document.getElementById("stopNavBtn").onclick = () => {
  if (currentRoute) {
    map.removeControl(currentRoute);
    currentRoute = null;
    document.getElementById("infoPanel").style.display = 'none';
    speak("Navigation stopped");
  }
};

// ================== EMERGENCY REAL-TIME ==================
let emergencyInterval = null;
async function fetchEmergencyPlaces(type, containerId) {
  if (!userMarker) {
    document.getElementById(containerId).innerHTML = "<p>Location not available</p>";
    return;
  }

  const { lat, lng } = userMarker.getLatLng();
  let query = `[out:json];(node["amenity"="${type}"](around:5000,${lat},${lng});); out center;`;

  try {
    const resp = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: query });
    const data = await resp.json();
    let container = document.getElementById(containerId);
    container.innerHTML = "";

    if (!data.elements || data.elements.length === 0) {
      container.innerHTML = `<p>No nearby ${type} found</p>`;
      return;
    }

    data.elements.slice(0, 5).forEach(el => {
      let name = el.tags.name || type;
      let coords = el.type === "node" ? [el.lat, el.lon] : [el.center.lat, el.center.lon];
      let div = document.createElement("div");
      div.className = "place";
      div.textContent = name;
      div.onclick = () => {
        map.setView(coords, 16);
        L.marker(coords).addTo(map).bindPopup(name).openPopup();
      };
      container.appendChild(div);
    });

  } catch (e) {
    document.getElementById(containerId).innerHTML = `<p>Error fetching ${type}</p>`;
    console.error(e);
  }
}

document.getElementById("emergencyBtn").onclick = () => {
  const tab = document.getElementById("emergencyTab");
  if (tab.style.display === "block") {
    tab.style.display = "none";
    if (emergencyInterval) clearInterval(emergencyInterval);
  } else {
    tab.style.display = "block";
    document.getElementById("hospitalList").innerHTML = "Loading...";
    document.getElementById("policeList").innerHTML = "Loading...";
    fetchEmergencyPlaces("hospital", "hospitalList");
    fetchEmergencyPlaces("police", "policeList");

    emergencyInterval = setInterval(() => {
      fetchEmergencyPlaces("hospital", "hospitalList");
      fetchEmergencyPlaces("police", "policeList");
    }, 10000);
  }
};

document.getElementById("closeEmergencyBtn").onclick = () => {
  document.getElementById("emergencyTab").style.display = "none";
  if (emergencyInterval) clearInterval(emergencyInterval);
};

// ================== VOICE COMMANDS ==================
let recognizing = false;
let recognition;

if ('webkitSpeechRecognition' in window) {
  recognition = new webkitSpeechRecognition();
  recognition.lang = language;
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onstart = () => {
    recognizing = true;
    const btn = document.getElementById("voiceCmdBtn");
    btn.classList.remove("off");
    btn.textContent = "🎤 Jack ON";
    speak("Jack is ON");
  };

  recognition.onend = () => {
    recognizing = false;
    const btn = document.getElementById("voiceCmdBtn");
    btn.classList.add("off");
    btn.textContent = "🎤 Jack OFF";
    speak("Jack Turned OFF");
  };

  recognition.onresult = e => {
    let transcript = e.results[e.results.length - 1][0].transcript.trim();
    console.log("Voice:", transcript);
    let cmd = parseCommand(transcript);
    if (cmd) handleVoiceCommand(cmd);
  };
}

document.getElementById("voiceCmdBtn").onclick = () => {
  if (!recognition) {
    alert("Speech recognition not supported");
    return;
  }
  if (recognizing) recognition.stop();
  else recognition.start();
};

async function handleVoiceCommand(cmd) {
  switch (cmd.intent) {
    case "start": showRoute(false); break;
    case "stop":
      if (currentRoute) {
        map.removeControl(currentRoute);
        currentRoute = null;
        document.getElementById("infoPanel").style.display = 'none';
        speak("Navigation stopped");
      }
      break;
    case "set_source": document.getElementById("setSourceBtn").click(); break;
    case "set_destination": document.getElementById("setDestBtn").click(); break;
    case "reroute": showRoute(false); break;
    case "emergency": document.getElementById("emergencyBtn").click(); break;
    case "find":
      fetchEmergencyPlaces(cmd.type, cmd.type === "hospital" ? "hospitalList" : "policeList");
      document.getElementById("emergencyTab").style.display = "block";
      break;
    case "traffic": showRoute(true); break;
    default: speak("Sorry, I did not understand");
  }
}

// ================== SOS FEATURE (UNIFIED) ==================
const sosChannel = new BroadcastChannel('sos_channel');

document.getElementById("sosBtn").addEventListener("click", async () => {
  if (!navigator.geolocation) { alert("Geolocation not supported"); return; }

  navigator.geolocation.getCurrentPosition((pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const timestamp = new Date().toISOString();

    const msg = `🚨 SOS ALERT 🚨
I need urgent help!
📍 Location: https://maps.google.com/?q=${lat},${lng}
Time: ${new Date(timestamp).toLocaleString()}`;

    // 1️⃣ WhatsApp alert
    const relatives = ["919342991366"];
    relatives.forEach((number, index) => {
      setTimeout(() => {
        window.open(`https://wa.me/${number}?text=${encodeURIComponent(msg)}`, "_blank");
      }, index * 1000);
    });

    // 2️⃣ Save to localStorage
    const sosLogs = JSON.parse(localStorage.getItem("sosLogs") || "[]");
    sosLogs.push({ lat, lng, timestamp });
    localStorage.setItem("sosLogs", JSON.stringify(sosLogs));

    // 3️⃣ Broadcast to police.html
    sosChannel.postMessage({ lat, lng, timestamp });

    alert("SOS alert sent!");
  }, (err) => {
    console.error("SOS error:", err);
    alert("Unable to fetch location.");
  }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
});

// ================== MAP COORDS DISPLAY ==================
function updateCoords(lat, lng) {
  document.getElementById('coords').textContent = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
}

map.on('move', () => {
  const center = map.getCenter();
  updateCoords(center.lat, center.lng);
});

if (navigator.geolocation) {
  navigator.geolocation.watchPosition((position) => {
    updateCoords(position.coords.latitude, position.coords.longitude);
  });
}


// Toggle menu
document.getElementById("mainBtn").addEventListener("click", () => {
  const menu = document.getElementById("menuBtns");
  menu.style.display = menu.style.display === "flex" ? "none" : "flex";
});

// Handle POI search
document.querySelectorAll(".poiBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    let type = btn.dataset.type;
    if (!window.userMarker) {
      alert("User location not found!");
      return;
    }

    let userLatLng = window.userMarker.getLatLng();
    let query = `[out:json];
      node(around:10000, ${userLatLng.lat}, ${userLatLng.lng})[amenity=${type}];
      out;`;

    fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query
    })
    .then(res => res.json())
    .then(data => {
      let count = data.elements.length;
      let msg = `There are ${count} ${type}s within 10 kilometers.`;
      alert(msg);

      // Voice output
      let speech = new SpeechSynthesisUtterance(msg);
      speechSynthesis.speak(speech);
    });
  });
}); 
