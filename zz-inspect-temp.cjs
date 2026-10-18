const fs = require("fs");
for (const file of ["script.js", "medical-events.js"]) {
  const text = fs.readFileSync(file, "utf8");
  console.log(file, "crlf:", (text.match(/\r\n/g) || []).length, "lf:", (text.match(/\n/g) || []).length);
}
const lines = fs.readFileSync("script.js", "utf8").split(/\r?\n/);
for (let i = 2803; i <= 2811; i += 1) console.log(i + 1, JSON.stringify(lines[i]));
