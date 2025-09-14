// Simple AI intent parser for Jack
function parseCommand(text) {
  text = text.toLowerCase().trim();
  if (!text.includes("jack")) return null;

  const cmd = text.replace("jack", "").trim();

  if (cmd.includes("start navigation")) return { intent: "start" };
  if (cmd.includes("stop navigation")) return { intent: "stop" };

  let m = cmd.match(/source(?: is| set to)? (.+)/);
  if (m) return { intent: "set_source", place: m[1] };

  m = cmd.match(/destination(?: is| set to)? (.+)/);
  if (m) return { intent: "set_destination", place: m[1] };

  if (cmd.includes("reroute") || cmd.includes("change route"))
    return { intent: "reroute" };

  if (cmd.includes("emergency")) return { intent: "emergency" };
  if (cmd.includes("nearest hospital")) return { intent: "find", type: "hospital" };
  if (cmd.includes("nearest police")) return { intent: "find", type: "police" };

  if (cmd.includes("traffic")) return { intent: "traffic" };

  if (cmd.includes("ar mode")) return { intent: "toggle_ar" };

  return { intent: "unknown", text: cmd };
}
