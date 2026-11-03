import test from "node:test";
import assert from "node:assert/strict";
import {calculateVehicleCameraPose} from "../src/world/vehicle-camera.js";
test("driver camera looks forward",()=>{
 const v={x:2.5,z:10.5,yaw:0,altitude:0,firstPerson:true};
 const p=calculateVehicleCameraPose(v);
 assert.equal(p.mode,"driver");
 assert.ok(p.target.z<p.position.z);
});
test("chase camera stays behind at four headings",()=>{
 for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  const v={x:7,z:-12,yaw,altitude:0,horizontalSpeed:14};
  const p=calculateVehicleCameraPose(v);
  const local= (p.position.x-v.x)*Math.sin(yaw)+(p.position.z-v.z)*Math.cos(yaw);
  assert.ok(local>8);
 }
});
