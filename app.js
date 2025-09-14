// ========== MAP ==========
let map=L.map('map').setView([20.5937,78.9629],5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap'}).addTo(map);
let userMarker,sourceMarker,destMarker,currentRoute=null;
let sourceCoords=null,destCoords=null;

// ========== SPEECH ==========
function speak(text){ let msg=new SpeechSynthesisUtterance(text); msg.lang=language||'en-US'; window.speechSynthesis.speak(msg); }

// ========== GEOLOCATION ==========
let language='en-US';
if(navigator.geolocation){
  navigator.geolocation.watchPosition(pos=>{
    let lat=pos.coords.latitude,lng=pos.coords.longitude;
    if(!userMarker){ map.setView([lat,lng],14); userMarker=L.marker([lat,lng]).addTo(map); if(!sourceCoords) sourceCoords=[lat,lng]; }
    else { userMarker.setLatLng([lat,lng]); }
  });
}
document.getElementById("locateBtn").onclick=()=>{ if(userMarker) map.setView(userMarker.getLatLng(),15); };

// ========== AUTOCOMPLETE ==========
function setupAutocomplete(inputId,suggestionsId,isSource){
  const input=document.getElementById(inputId),box=document.getElementById(suggestionsId);
  input.addEventListener("input",()=>{ 
    let query=input.value.trim(); 
    if(query.length<3){box.style.display='none';return;}
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=5`).then(r=>r.json()).then(data=>{
      box.innerHTML=''; data.forEach(place=>{
        const div=document.createElement("div"); div.className="suggestion-item"; div.textContent=place.display_name;
        div.onclick=()=>{ 
          input.value=place.display_name; box.style.display='none';
          const coords=[+place.lat,+place.lon];
          if(isSource){ sourceCoords=coords; if(sourceMarker) map.removeLayer(sourceMarker);
            sourceMarker=L.marker(coords).addTo(map);
          } else { destCoords=coords; if(destMarker) map.removeLayer(destMarker);
            destMarker=L.marker(coords).addTo(map);
          }
        }; box.appendChild(div);
      }); box.style.display='block';
    });
  });
}
setupAutocomplete("source","sourceSuggestions",true);
setupAutocomplete("destination","destinationSuggestions",false);

// ========== ROUTING ==========
function showRoute(){
  if(!sourceCoords||!destCoords){alert("Select source and destination"); return;}
  if(currentRoute) map.removeControl(currentRoute);
  currentRoute=L.Routing.control({
    waypoints:[L.latLng(sourceCoords),L.latLng(destCoords)],
    routeWhileDragging:false,addWaypoints:false,draggableWaypoints:false,
    lineOptions:{styles:[{color:'blue',weight:5}]},createMarker:()=>null
  }).addTo(map);
  document.getElementById("infoPanel").style.display='block';
  currentRoute.on('routesfound',e=>{
    let route=e.routes[0],summary=route.summary;
    let dist=(summary.totalDistance/1000).toFixed(2),time=(summary.totalTime/60).toFixed(1);
    document.getElementById("routeInfo").innerHTML=`Distance: ${dist} km | Time: ${time} mins`;
    speak(`You need to go ${dist} km, approx ${time} mins`);
  });
}
document.getElementById("startNavBtn").onclick=showRoute;
document.getElementById("stopNavBtn").onclick=()=>{ 
  if(currentRoute){ map.removeControl(currentRoute); currentRoute=null; document.getElementById("infoPanel").style.display='none'; speak("Navigation stopped"); } 
};

// ========== LANGUAGE ==========
document.getElementById("languageBtn").onclick=()=>{
  language=language==='en-US'?'ta-IN':'en-US';
  document.getElementById("languageBtn").textContent=language==='en-US'?'Language: EN':'Language: TA';
};

// ========== EMERGENCY ==========
async function fetchEmergencyPlaces(type, containerId){
  if(!userMarker){ document.getElementById(containerId).innerHTML="<p>Location not available</p>"; return; }
  const {lat,lng}=userMarker.getLatLng();
  let query=`[out:json];(node["amenity"="${type}"](around:5000,${lat},${lng});); out center;`;
  try{
    const resp=await fetch("https://overpass-api.de/api/interpreter",{method:"POST",body:query});
    const data=await resp.json();
    let container=document.getElementById(containerId);
    container.innerHTML="";
    if(!data.elements || data.elements.length===0){ container.innerHTML="<p>No nearby "+type+" found</p>"; return;}
    data.elements.slice(0,5).forEach(el=>{
      let name=el.tags.name||type;
      let coords=el.type==="node"?[el.lat,el.lon]:[el.center.lat,el.center.lon];
      let div=document.createElement("div"); div.className="place"; div.textContent=name;
      div.onclick=()=>{ map.setView(coords,16); L.marker(coords).addTo(map).bindPopup(name).openPopup(); };
      container.appendChild(div);
    });
    // Pass to AR
    addARMarkers(type,data.elements);
  }catch(e){ document.getElementById(containerId).innerHTML="<p>Error fetching "+type+"</p>"; console.error(e);}
}
document.getElementById("emergencyBtn").onclick=()=>{
  const tab=document.getElementById("emergencyTab");
  if(tab.style.display==="block"){ tab.style.display="none"; }
  else{
    tab.style.display="block";
    document.getElementById("hospitalList").innerHTML="Loading...";
    document.getElementById("policeList").innerHTML="Loading...";
    fetchEmergencyPlaces("hospital","hospitalList");
    fetchEmergencyPlaces("police","policeList");
  }
};
document.getElementById("closeEmergencyBtn").onclick=()=>document.getElementById("emergencyTab").style.display='none';

// ========== JACK VOICE ==========
let recognition=null,jackOn=false;
if('webkitSpeechRecognition' in window || 'SpeechRecognition' in window){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  recognition=new SR(); recognition.lang='en-US'; recognition.continuous=true;
  const btn=document.getElementById("voiceCmdBtn");
  btn.onclick=()=>{
    jackOn=!jackOn;
    if(jackOn){ btn.textContent="🎤 Jack ON"; btn.classList.remove("off"); speak("Jack active"); recognition.start(); }
    else { btn.textContent="🎤 Jack OFF"; btn.classList.add("off"); speak("Jack off"); recognition.stop(); }
  };
  recognition.onresult=e=>{
    if(!jackOn) return;
    const t=e.results[e.results.length-1][0].transcript.toLowerCase();
    if(!t.includes("jack")) return;
    const cmd=t.split("jack").pop().trim();
    if(cmd.includes("emergency")){ document.getElementById("emergencyTab").style.display='block'; speak("Emergency tab opened"); return; }
    if(cmd.includes("start navigation")) showRoute();
    else if(cmd.includes("stop navigation")) document.getElementById("stopNavBtn").click();
  };
  recognition.onend=()=>{if(jackOn) recognition.start();}
}

// ========== TOGGLE AR ==========
document.getElementById("toggleAR").onclick=()=>{
  let arContainer=document.getElementById("arContainer");
  if(arContainer.style.display==="none"){ arContainer.style.display="block"; speak("AR mode enabled"); }
  else { arContainer.style.display="none"; speak("AR mode disabled"); }
};
