'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
function load(file=path.join(ROOT,'.env')){
 if(!fs.existsSync(file))return;
 for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
  const m=line.match(/^(?:export\s+)?([A-Z_0-9]+)\s*=\s*(.*)$/);if(!m||process.env[m[1]])continue;
  let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);
  process.env[m[1]]=v;
 }
}
module.exports={ROOT,load};
