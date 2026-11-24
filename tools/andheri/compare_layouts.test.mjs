import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compareDesks,changeClusters} from '../../engine/seat-diff.js';
const read=name=>JSON.parse(fs.readFileSync('media/flipkart-andheri/cad/comparisons/'+name+'.json','utf8'));
const p=read('privilon'),s=read('723-avenue');
for(const [a,b,added]of [[0,1,20],[1,2,21],[0,2,41]]){
 const base=p.variants[a].plans[0].desks,target=p.variants[b].plans[0].desks,diff=compareDesks(base,target);assert.equal(diff.added.length,added);assert.equal(diff.removed.length,0);assert.equal(diff.unchanged.length,base.length);assert.equal(diff.net,added);assert.equal(changeClusters(diff.added).reduce((n,g)=>n+g.length,0),added);
 const reverse=compareDesks(target,base);assert.equal(reverse.removed.length,added);assert.equal(reverse.added.length,0);
}
for(const [a,b,added]of [[0,1,34],[1,2,16],[0,2,50]]){
 assert.equal(compareDesks(s.variants[a].plans[0].desks,s.variants[b].plans[0].desks).net,0);
 const diff=compareDesks(s.variants[a].plans[1].desks,s.variants[b].plans[1].desks);assert.equal(diff.added.length,added);assert.equal(diff.removed.length,0);
}
// IDs are not identity: matching remains correct after order and handle reassignment.
const desks=p.variants[0].plans[0].desks;assert.equal(compareDesks(desks,desks.toReversed().map(d=>({...d,handle:'reallocated'}))).unchanged.length,260);
const shifted=desks.map(d=>({...d,center:[d.center[0]+.03,d.center[1]],polygon:d.polygon.map(q=>[q[0]+.03,q[1]])}));assert.equal(compareDesks(desks,shifted).unchanged.length,0);
console.log('PASS: exact seat additions, reverse removals, structural-frame desk matching and change clusters.');
