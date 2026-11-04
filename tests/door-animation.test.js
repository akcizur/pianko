import test from "node:test";
import assert from "node:assert/strict";
import {stepDoorAnimation} from "../src/world/door-animation.js";

test("door opens smoothly without snapping and releases its collider when clear",()=>{
 const door={amount:0,target:1,openAngle:Math.PI/2};
 const first=stepDoorAnimation(door,1/60,10);
 assert.ok(first.amount>0&&first.amount<1);
 assert.ok(first.angle>0&&first.angle<Math.PI/2);
 assert.equal(first.colliderEnabled,true);
 let state=first;
 for(let frame=0;frame<120;frame++)state=stepDoorAnimation({...door,amount:state.amount},1/60,10);
 assert.equal(state.amount,1);
 assert.equal(state.angle,Math.PI/2);
 assert.equal(state.colliderEnabled,false);
});

test("door reverses smoothly when the target changes mid-animation",()=>{
 const door={amount:.42,target:0,openAngle:-Math.PI/2};
 const next=stepDoorAnimation(door,1/60,10);
 assert.ok(next.amount<.42&&next.amount>0);
 assert.equal(next.colliderEnabled,true);
});

test("door animation clamps frame time and keeps a closed door collidable",()=>{
 const state=stepDoorAnimation({amount:0,target:0,openAngle:Math.PI/2},10,10);
 assert.equal(state.amount,0);
 assert.equal(state.angle,0);
 assert.equal(state.colliderEnabled,true);
});
