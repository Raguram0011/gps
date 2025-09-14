function addARMarkers(type, places){
  let arContainer=document.getElementById("arMarkers");
  arContainer.innerHTML="";
  places.forEach(el=>{
    let lat=el.lat || (el.center && el.center.lat);
    let lon=el.lon || (el.center && el.center.lon);
    let name=el.tags.name || type;
    let color=type==="hospital"?"red":"blue";

    let marker=document.createElement("a-text");
    marker.setAttribute("value", name);
    marker.setAttribute("look-at", "[gps-camera]");
    marker.setAttribute("gps-entity-place", `latitude: ${lat}; longitude: ${lon};`);
    marker.setAttribute("color", color);
    marker.setAttribute("scale", "2 2 2");
    arContainer.appendChild(marker);
  });
}
