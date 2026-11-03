import test from "node:test";
import assert from "node:assert/strict";
import {stepVehicleDynamics} from "../src/core/vehicle-controller.js";
import {calculateVehicleCameraPose} from "../src/world/vehicle-camera.js";
test("vehicle camera remains behind after a controlled acceleration run",()=>{
 const vehicle={x:2.5,z:10.5,yaw:0,speed:0,vx:0,vz:0,altitude:0,verticalSpeed:0,battery:100};
 for(let frame=0;frame<90;frame++)stepVehicleDynamics(vehicle,{throttle:1},1/60);
 const pose=calculateVehicleCameraPose(vehicle);
 assert.ok(vehicle.horizontalSpeed>5);
 assert.ok(pose.position.z>vehicle.z+8);
});
