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
  window.speechSynthesis.cancel(); // cancel any ongoing speech
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

// Update weather every 60 seconds
setInterval(() => {
  if (userMarker) {
    const { lat, lng } = userMarker.getLatLng();
    updateWeather(lat, lng);
  }
}, 60000);

if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    pos => updateUserLocation(pos.coords.latitude, pos.coords.longitude),
    err => { console.error("Geolocation error:", err); alert("Unable to fetch GPS location. Enable location services."); },
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
      icon: L.icon({ iconUrl: 'https://maps.google.com/mapfiles/ms/icons/arrow.png', iconSize: [32,32], iconAnchor:[16,16] })
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
  } catch(e) {
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
    if (query.length < 3) { box.style.display='none'; return; }

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=5`)
      .then(r => r.json())
      .then(data => {
        box.innerHTML='';
        data.forEach(place => {
          const div = document.createElement("div");
          div.className="suggestion-item";
          div.textContent = place.display_name;
          div.onclick = () => {
            input.value = place.display_name;
            box.style.display='none';
            const coords=[+place.lat,+place.lon];
            if(isSource) {
              sourceCoords=coords;
              if(sourceMarker) map.removeLayer(sourceMarker);
              sourceMarker=L.marker(coords,{icon:L.icon({iconUrl:'https://maps.google.com/mapfiles/ms/icons/green-dot.png',iconSize:[32,32],iconAnchor:[16,32]})}).addTo(map);
            } else {
              destCoords=coords;
              if(destMarker) map.removeLayer(destMarker);
              destMarker=L.marker(coords,{icon:L.icon({iconUrl:'https://maps.google.com/mapfiles/ms/icons/red-dot.png',iconSize:[32,32],iconAnchor:[16,32]})}).addTo(map);
            }
          };
          box.appendChild(div);
        });
        box.style.display='block';
      });
  });
}

setupAutocomplete("source","sourceSuggestions",true);
setupAutocomplete("destination","destinationSuggestions",false);

// ================== SET SOURCE/DEST TO MY LOCATION ==================
document.getElementById("setSourceBtn").onclick = () => {
  if(!userMarker) { alert("Location not available yet"); return; }
  const {lat,lng}=userMarker.getLatLng();
  sourceCoords=[lat,lng];
  document.getElementById("source").value="My Location";
  if(sourceMarker) map.removeLayer(sourceMarker);
  sourceMarker=L.marker([lat,lng],{icon:L.icon({iconUrl:'https://maps.google.com/mapfiles/ms/icons/green-dot.png',iconSize:[32,32],iconAnchor:[16,32]})}).addTo(map).bindPopup("Source: My Location").openPopup();
};

document.getElementById("setDestBtn").onclick = () => {
  if(!userMarker) { alert("Location not available yet"); return; }
  const {lat,lng}=userMarker.getLatLng();
  destCoords=[lat,lng];
  document.getElementById("destination").value="My Location";
  if(destMarker) map.removeLayer(destMarker);
  destMarker=L.marker([lat,lng],{icon:L.icon({iconUrl:'https://maps.google.com/mapfiles/ms/icons/red-dot.png',iconSize:[32,32],iconAnchor:[16,32]})}).addTo(map).bindPopup("Destination: My Location").openPopup();
};

// ================== ROUTING ==================
async function showRoute(traffic=false){
  if(!sourceCoords||!destCoords){ alert("Select source and destination"); return; }
  if(currentRoute) map.removeControl(currentRoute);

  if(traffic){
    const apiKey="YOUR_OPENROUTESERVICE_API_KEY";
    const url=`https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${sourceCoords[1]},${sourceCoords[0]}&end=${destCoords[1]},${destCoords[0]}`;
    const res=await fetch(url);
    const data=await res.json();
    if(data && data.features){
      const coords=data.features[0].geometry.coordinates.map(c=>[c[1],c[0]]);
      const dist=(data.features[0].properties.summary.distance/1000).toFixed(2);
      const time=(data.features[0].properties.summary.duration/60).toFixed(1);
      L.polyline(coords,{color:"red"}).addTo(map);
      map.fitBounds(coords);
      document.getElementById("routeInfo").innerHTML=`Traffic Route: ${dist} km | ${time} mins`;
      speak(`Best route considering traffic is ${dist} kilometers, ${time} minutes`);
    }
  } else {
    currentRoute=L.Routing.control({
      waypoints:[L.latLng(sourceCoords),L.latLng(destCoords)],
      routeWhileDragging:false,addWaypoints:false,draggableWaypoints:false,
      lineOptions:{styles:[{color:'blue',weight:5}]},
      createMarker:()=>null
    }).addTo(map);
    document.getElementById("infoPanel").style.display='block';
    currentRoute.on('routesfound', e=>{
      let route=e.routes[0],summary=route.summary;
      let dist=(summary.totalDistance/1000).toFixed(2),
          time=(summary.totalTime/60).toFixed(1);
      document.getElementById("routeInfo").innerHTML=`Distance: ${dist} km | Time: ${time} mins`;
      let stepsHtml="<ol>";
      route.instructions.forEach(instr=>stepsHtml+=`<li>${instr.text}</li>`);
      stepsHtml+="</ol>";
      document.getElementById("steps").innerHTML=stepsHtml;
      speak(`You need to go ${dist} kilometers, approximately ${time} minutes`);
    });
  }
}

document.getElementById("startNavBtn").onclick=()=>showRoute(false);
document.getElementById("stopNavBtn").onclick=()=>{
  if(currentRoute){
    map.removeControl(currentRoute);
    currentRoute=null;
    document.getElementById("infoPanel").style.display='none';
    speak("Navigation stopped");
  }
};

// ================== EMERGENCY & SOS ==================
let emergencyInterval=null;
async function fetchEmergencyPlaces(type,containerId){
  if(!userMarker){ document.getElementById(containerId).innerHTML="<p>Location not available</p>"; return; }
  const {lat,lng}=userMarker.getLatLng();
  let query=`[out:json];(node["amenity"="${type}"](around:5000,${lat},${lng});); out center;`;
  try{
    const resp=await fetch("https://overpass-api.de/api/interpreter",{method:"POST",body:query});
    const data=await resp.json();
    let container=document.getElementById(containerId);
    container.innerHTML="";
    if(!data.elements || data.elements.length===0){ container.innerHTML=`<p>No nearby ${type} found</p>`; return; }
    data.elements.slice(0,5).forEach(el=>{
      let name=el.tags.name||type;
      let coords=el.type==="node"?[el.lat,el.lon]:[el.center.lat,el.center.lon];
      let div=document.createElement("div");
      div.className="place";
      div.textContent=name;
      div.onclick=()=>{ map.setView(coords,16); L.marker(coords).addTo(map).bindPopup(name).openPopup(); };
      container.appendChild(div);
    });
  } catch(e){ console.error(e); document.getElementById(containerId).innerHTML=`<p>Error fetching ${type}</p>`; }
}

document.getElementById("emergencyBtn").onclick=()=>{
  const tab=document.getElementById("emergencyTab");
  if(tab.style.display==="block"){ tab.style.display="none"; if(emergencyInterval) clearInterval(emergencyInterval); }
  else{
    tab.style.display="block";
    document.getElementById("hospitalList").innerHTML="Loading...";
    document.getElementById("policeList").innerHTML="Loading...";
    fetchEmergencyPlaces("hospital","hospitalList");
    fetchEmergencyPlaces("police","policeList");
    emergencyInterval=setInterval(()=>{ fetchEmergencyPlaces("hospital","hospitalList"); fetchEmergencyPlaces("police","policeList"); },10000);
  }
};

document.getElementById("closeEmergencyBtn").onclick=()=>{ document.getElementById("emergencyTab").style.display="none"; if(emergencyInterval) clearInterval(emergencyInterval); };

// ================== SOS FEATURE ==================
const sosChannel=new BroadcastChannel('sos_channel');
document.getElementById("sosBtn").addEventListener("click",()=>{
  if(!navigator.geolocation){ alert("Geolocation not supported"); return; }
  navigator.geolocation.getCurrentPosition(pos=>{
    const lat=pos.coords.latitude,lng=pos.coords.longitude,timestamp=new Date().toISOString();
    const msg=`🚨 SOS ALERT 🚨
I need urgent help!
📍 Location: https://maps.google.com/?q=${lat},${lng}
Time: ${new Date(timestamp).toLocaleString()}`;

    const relatives=["919342991366"];
    relatives.forEach((number,index)=>{ setTimeout(()=>{ window.open(`https://wa.me/${number}?text=${encodeURIComponent(msg)}`,"_blank"); }, index*1000); });

    const sosLogs=JSON.parse(localStorage.getItem("sosLogs")||"[]");
    sosLogs.push({lat,lng,timestamp});
    localStorage.setItem("sosLogs",JSON.stringify(sosLogs));
    sosChannel.postMessage({lat,lng,timestamp});
    alert("SOS alert sent!");
  }, err=>{ console.error("SOS error:",err); alert("Unable to fetch location."); }, {enableHighAccuracy:true, timeout:10000, maximumAge:0});
});

// ================== MAP COORDS DISPLAY ==================
function updateCoords(lat,lng){ document.getElementById('coords').textContent=`Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`; }
map.on('move',()=>{ const center=map.getCenter(); updateCoords(center.lat,center.lng); });
if(navigator.geolocation){ navigator.geolocation.watchPosition(pos=>updateCoords(pos.coords.latitude,pos.coords.longitude)); }

// Toggle menu
document.getElementById("mainBtn").addEventListener("click",()=>{ const menu=document.getElementById("menuBtns"); menu.style.display=menu.style.display==='flex'?'none':'flex'; });

// Close results panel
function closePanel(){ document.getElementById("resultsPanel").classList.remove("active"); }

// Haversine distance
function getDistance(lat1,lon1,lat2,lon2){ const R=6371; const dLat=(lat2-lat1)*Math.PI/180; const dLon=(lon2-lon1)*Math.PI/180; const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2; const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)); return R*c; }

// ================== POI SEARCH ==================
document.querySelectorAll(".poiBtn").forEach(btn=>{
  btn.addEventListener("click",()=>{
    let type=btn.dataset.type;
    if(!window.userMarker){ alert("User location not found!"); return; }
    let userLatLng=window.userMarker.getLatLng();
    let query=`[out:json]; node(around:10000, ${userLatLng.lat}, ${userLatLng.lng})[amenity=${type}]; out;`;

    fetch("https://overpass-api.de/api/interpreter",{method:"POST",body:query})
      .then(res=>res.json())
      .then(data=>{
        let count=data.elements.length;
        let msg=`I found ${count} ${type}s within 10 kilometers.`;
        speak(msg);

        let resultsList=document.getElementById("resultsList");
        resultsList.innerHTML="";
        data.elements.forEach(el=>{
          let name=el.tags && el.tags.name ? el.tags.name : `${type} (unknown name)`;
          let dist=getDistance(userLatLng.lat,userLatLng.lng,el.lat,el.lon).toFixed(2);
          let li=document.createElement("li");
          li.textContent=`${name} - ${dist} km away`;
          li.addEventListener("click",()=>{
            if(window.routingControl) map.removeControl(window.routingControl);
            window.routingControl=L.Routing.control({waypoints:[L.latLng(userLatLng.lat,userLatLng.lng),L.latLng(el.lat,el.lon)],routeWhileDragging:true}).addTo(map);
            closePanel();
          });
          resultsList.appendChild(li);
        });
        document.getElementById("resultsTitle").textContent=`Nearby ${type}s`;
        document.getElementById("resultsPanel").classList.add("active");
      });
  });
});

// ================== INITIAL USER LOCATION ==================
function success(position){
  const lat=position.coords.latitude,lng=position.coords.longitude;
  window.userMarker=L.marker([lat,lng]).addTo(map).bindPopup("You are here").openPopup();
  map.setView([lat,lng],14);
}
if(!navigator.geolocation) alert("Geolocation is not supported by your browser");
else navigator.geolocation.getCurrentPosition(success,()=>alert("Unable to retrieve your location"));

// ================== JACK VOICE ASSISTANT (OPTIMIZED) ==================
let recognition, jackActivated=false, jackListening=false;
let locationCache={};

if('webkitSpeechRecognition' in window){
  recognition=new webkitSpeechRecognition();
  recognition.lang=language;
  recognition.continuous=true;
  recognition.interimResults=false;

  recognition.onresult=function(event){
    if(!jackActivated) return;
    const transcript=event.results[event.results.length-1][0].transcript.toLowerCase().trim();
    console.log("Heard:", transcript);

    if(!jackListening){
      if(transcript.includes("jack")){
        jackListening=true;
        speak("Yes, I am listening.");
      }
      return;
    }

    const cmd=parseCommand(transcript);
    if(cmd){
      jackListening=false;
      handleVoiceCommand(cmd);
    }
  };

  recognition.onend = () => { if(jackActivated) recognition.start(); };
}

// Parse voice command
function parseCommand(transcript){
  transcript=transcript.toLowerCase();
  let sourceMatch=transcript.match(/source (to )?(.*)/);
  let destMatch=transcript.match(/destination (to )?(.*)/);
  if(sourceMatch) return { intent:"set_source", location: sourceMatch[2].trim() };
  if(destMatch) return { intent:"set_destination", location: destMatch[2].trim() };
  if(transcript.includes("start")) return { intent:"start" };
  if(transcript.includes("stop")) return { intent:"stop" };
  if(transcript.includes("reroute")) return { intent:"reroute" };
  if(transcript.includes("emergency")) return { intent:"emergency" };
  if(transcript.includes("traffic")) return { intent:"traffic" };

  const pois=["fuel","hospital","restaurant","hotel","pharmacy","bank","school","park","supermarket","police"];
  for(let poi of pois) if(transcript.includes(poi)) return { intent:"poi_search", type:poi };
  return null;
}

// Voice button
document.getElementById("voiceCmdBtn").onclick=()=>{
  if(!recognition){ alert("Speech recognition not supported"); return; }
  const btn=document.getElementById("voiceCmdBtn");
  if(jackActivated){
    recognition.stop();
    jackActivated=false;
    jackListening=false;
    btn.classList.add("off");
    btn.textContent="🎤 Jack OFF";
    speak("Jack turned OFF");
  } else{
    recognition.start();
    jackActivated=true;
    jackListening=false;
    btn.classList.remove("off");
    btn.textContent="🎤 Jack ON";
    speak("Jack is ON");
  }
};

// Optimized fetch with caching
async function getCoords(place){
  if(locationCache[place]) return locationCache[place];
  const resp=await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${place}&limit=1`);
  const data=await resp.json();
  if(data[0]){
    locationCache[place]=[+data[0].lat,+data[0].lon];
    return locationCache[place];
  }
  return null;
}

// Handle Jack commands
async function handleVoiceCommand(cmd){
  switch(cmd.intent){
    case "start": showRoute(false); break;
    case "stop": if(currentRoute){ map.removeControl(currentRoute); currentRoute=null; document.getElementById("infoPanel").style.display='none'; speak("Navigation stopped"); } break;
    case "set_source":
      if(cmd.location){
        document.getElementById("source").value=cmd.location;
        const coords=await getCoords(cmd.location);
        if(coords){
          sourceCoords=coords;
          if(sourceMarker) map.removeLayer(sourceMarker);
          sourceMarker=L.marker(coords,{icon:L.icon({iconUrl:'https://maps.google.com/mapfiles/ms/icons/green-dot.png',iconSize:[32,32],iconAnchor:[16,32]})}).addTo(map).bindPopup("Source: "+cmd.location).openPopup();
        }
      } else document.getElementById("setSourceBtn").click();
      break;
    case "set_destination":
      if(cmd.location){
        document.getElementById("destination").value=cmd.location;
        const coords=await getCoords(cmd.location);
        if(coords){
          destCoords=coords;
          if(destMarker) map.removeLayer(destMarker);
          destMarker=L.marker(coords,{icon:L.icon({iconUrl:'https://maps.google.com/mapfiles/ms/icons/red-dot.png',iconSize:[32,32],iconAnchor:[16,32]})}).addTo(map).bindPopup("Destination: "+cmd.location).openPopup();
        }
      } else document.getElementById("setDestBtn").click();
      break;
    case "reroute": showRoute(false); break;
    case "emergency": document.getElementById("emergencyBtn").click(); break;
    case "traffic": showRoute(true); break;
    case "poi_search":
      speak(`Searching ${cmd.type}s within 10 kilometers.`);
      let btn=document.querySelector(`.poiBtn[data-type="${cmd.type}"]`);
      if(btn) btn.click();
      break;
    default: console.log("Command not recognized:", cmd);
  }
}
