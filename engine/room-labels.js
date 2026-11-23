// Presentation labels keep the original CAD names available in tooltips.
export function roomSections(zones) {
  const groups=new Map();
  for(const zone of zones){
    const group=zone.group||'Other spaces';
    if(!groups.has(group))groups.set(group,[]);
    groups.get(group).push(zone);
  }
  const titles={'Meeting room':'Meeting rooms','Phone booth':'Phone booths'};
  return [...groups].map(([group,rooms])=>{
    rooms.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true})||a.label[0]-b.label[0]);
    return {title:titles[group]||group,rooms:rooms.map((zone,i)=>({zone,label:titles[group]?group+' '+(i+1):zone.name}))};
  });
}
