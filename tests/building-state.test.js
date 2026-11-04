import test from "node:test";
import assert from "node:assert/strict";
import {restoreBuildingDoorStates,serializeBuildingDoorStates} from "../src/world/building-state.js";
import {createBuildingElevator} from "../src/world/building-elevator.js";

function makeDoor(id,openAngle){
 return {
  id,open:false,openAngle,roofOpen:false,roofOpenAngle:openAngle,
  roofDoor:{rotation:{y:0}},roofDoorCollider:{enabled:true},
  doorPivot:{rotation:{y:0}},doorCollider:{enabled:true},
  elevator:{motion:createBuildingElevator([.18,3.08,5.98,8.88])},
  apartmentDoors:[0,1,2].map(index=>({
   open:false,openAngle:openAngle*(index+1),
   doorPivot:{rotation:{y:0}},doorCollider:{enabled:true}
  }))
 };
}

test("all building door, roof and elevator states serialize by stable id",()=>{
 const entries=[makeDoor("WEST",1),makeDoor("EAST",-1)];
 entries[0].open=true;entries[0].apartmentDoors[1].open=true;entries[0].roofOpen=true;
 entries[0].elevator.motion.rider=true;entries[0].elevator.motion.requestFloor(2);
 for(let frame=0;frame<25;frame++)entries[0].elevator.motion.step(1/60);
 entries[1].apartmentDoors[2].open=true;
 const saved=serializeBuildingDoorStates(entries);
 assert.equal(saved[0].id,"WEST");
 assert.equal(saved[0].entranceOpen,true);
 assert.equal(saved[0].roofOpen,true);
 assert.deepEqual(saved[0].doors,[false,true,false]);
 assert.equal(saved[0].elevator.rider,true);
 assert.ok(saved[0].elevator.y>.18);
 assert.deepEqual(saved[1].doors,[false,false,true]);
});

test("saved entrance and apartment doors restore their visuals and collision flags",()=>{
 const entries=[makeDoor("WEST",1),makeDoor("EAST",-1)];
 const restored=restoreBuildingDoorStates(entries,[
  {id:"EAST",entranceOpen:true,doors:[true,false,true]},
  {id:"WEST",entranceOpen:false,doors:[false,true,false]}
 ]);
 assert.equal(restored,true);
 assert.equal(entries[0].doorPivot.rotation.y,0);
 assert.equal(entries[0].doorCollider.enabled,true);
 assert.equal(entries[0].apartmentDoors[1].doorPivot.rotation.y,2);
 assert.equal(entries[0].apartmentDoors[1].doorCollider.enabled,false);
 assert.equal(entries[1].doorPivot.rotation.y,-1);
 assert.equal(entries[1].doorCollider.enabled,false);
 assert.equal(entries[0].roofDoor.rotation.y,0);
 assert.equal(entries[0].roofDoorCollider.enabled,true);
 assert.equal(entries[1].roofDoor.rotation.y,0);
 assert.equal(entries[1].roofDoorCollider.enabled,true);
 assert.equal(entries[1].apartmentDoors[2].doorPivot.rotation.y,-3);
 assert.equal(entries[1].apartmentDoors[2].doorCollider.enabled,false);
});

test("lift motion and passenger restore at the saved height and phase",()=>{
 const source=makeDoor("LIFT",1),loaded=makeDoor("LIFT",1);
 source.elevator.motion.rider=true;
 source.elevator.motion.requestFloor(3);
 for(let frame=0;frame<32;frame++)source.elevator.motion.step(1/60);
 const saved=serializeBuildingDoorStates([source]);
 assert.equal(restoreBuildingDoorStates([loaded],saved),true);
 assert.deepEqual(loaded.elevator.motion.serialize(),saved[0].elevator);
});

test("roof exit state restores its visible door and collision state",()=>{
 const entries=[makeDoor("ROOF",1)];
 const changed=restoreBuildingDoorStates(entries,[{id:"ROOF",entranceOpen:false,roofOpen:true,doors:[]}]);
 assert.equal(changed,true);
 assert.equal(entries[0].roofOpen,true);
 assert.equal(entries[0].roofDoor.rotation.y,1);
 assert.equal(entries[0].roofDoorCollider.enabled,false);
});

test("missing building data keeps old save compatibility path available",()=>{
 assert.equal(restoreBuildingDoorStates([],null),false);
 assert.equal(restoreBuildingDoorStates([],{}),false);
});
