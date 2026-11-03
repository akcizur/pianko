import test from "node:test";
import assert from "node:assert/strict";
import { restoreBuildingDoorStates, serializeBuildingDoorStates } from "../src/world/building-state.js";

function makeDoor(id, openAngle) {
  return {
    id, open:false, openAngle,
    doorPivot:{rotation:{y:0}},
    doorCollider:{enabled:true},
    apartmentDoors:[0,1,2].map(index=>({
      open:false,openAngle:openAngle*(index+1),
      doorPivot:{rotation:{y:0}},doorCollider:{enabled:true}
    }))
  };
}

test("all building entrance and flat-door states serialize by stable building id",()=>{
  const entries=[makeDoor("WEST",1),makeDoor("EAST",-1)];
  entries[0].open=true;entries[0].apartmentDoors[1].open=true;
  entries[1].apartmentDoors[2].open=true;
  assert.deepEqual(serializeBuildingDoorStates(entries),[
    {id:"WEST",entranceOpen:true,doors:[false,true,false]},
    {id:"EAST",entranceOpen:false,doors:[false,false,true]}
  ]);
});

test("saved entrance and apartment doors restore both visuals and collision flags",()=>{
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
  assert.equal(entries[1].apartmentDoors[2].doorPivot.rotation.y,-3);
  assert.equal(entries[1].apartmentDoors[2].doorCollider.enabled,false);
});

test("missing building data keeps old save compatibility path available",()=>{
  assert.equal(restoreBuildingDoorStates([],null),false);
  assert.equal(restoreBuildingDoorStates([],{}),false);
});
