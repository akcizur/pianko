import test from "node:test";
import assert from "node:assert/strict";
import {createBuildingElevator} from "../src/world/building-elevator.js";

test("elevator closes, travels and opens exactly at requested floor",()=>{
 const lift=createBuildingElevator([.18,3.08,5.98,8.88]);
 assert.equal(lift.y,.18);
 assert.equal(lift.doorOpen,1);
 assert.equal(lift.requestFloor(2),true);
 let state;
 for(let frame=0;frame<600;frame++)state=lift.step(1/60);
 assert.equal(state.currentFloor,2);
 assert.equal(state.targetFloor,2);
 assert.ok(Math.abs(state.y-5.98)<1e-8);
 assert.equal(state.doorOpen,1);
 assert.equal(state.moving,false);
});
test("lift reverses safely when a new floor is requested while moving",()=>{
 const lift=createBuildingElevator([.18,3.08,5.98,8.88]);
 lift.requestFloor(3);
 for(let frame=0;frame<25;frame++)lift.step(1/60);
 const before=lift.y;
 assert.ok(before>.18&&before<8.88);
 lift.requestFloor(1);
 for(let frame=0;frame<600;frame++)lift.step(1/60);
 assert.equal(lift.currentFloor,1);
 assert.ok(Math.abs(lift.y-3.08)<1e-8);
 assert.equal(lift.doorOpen,1);
});
test("elevator rejects impossible floor indices and clamps frame delta",()=>{
 const lift=createBuildingElevator([0,3,6]);
 assert.equal(lift.requestFloor(-1),false);
 assert.equal(lift.requestFloor(3),false);
 lift.requestFloor(2);
 lift.step(10);
 assert.ok(lift.y<=.18);
});
test("elevator motion and passenger state survive a save while travelling",()=>{
 const floors=[.18,3.08,5.98,8.88],source=createBuildingElevator(floors);
 source.rider=true;source.requestFloor(3);
 for(let frame=0;frame<28;frame++)source.step(1/60);
 const saved=source.serialize(),restored=createBuildingElevator(floors);
 assert.equal(restored.restore(saved),true);
 assert.deepEqual(restored.serialize(),saved);
 for(let frame=0;frame<600;frame++)restored.step(1/60);
 assert.equal(restored.currentFloor,3);
 assert.equal(restored.rider,true);
 assert.equal(restored.doorOpen,1);
});
test("invalid elevator snapshots are ignored",()=>{
 const lift=createBuildingElevator([0,3,6]);
 assert.equal(lift.restore({currentFloor:99,targetFloor:0,y:2}),false);
 assert.equal(lift.y,0);
});
