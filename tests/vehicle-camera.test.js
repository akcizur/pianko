import test from "node:test";
import assert from "node:assert/strict";
import {calculateVehicleCameraPose,createVehicleCameraRig} from "../src/world/vehicle-camera.js";
import {stepVehicleDynamics} from "../src/core/vehicle-controller.js";

function localBehind(vehicle,point){
 const dx=point.x-vehicle.x,dz=point.z-vehicle.z;
 return dx*Math.sin(vehicle.yaw)+dz*Math.cos(vehicle.yaw);
}

test("driver camera is inside the cabin and pitched toward the road",()=>{
 const vehicle={x:2.5,z:10.5,yaw:0,altitude:0,firstPerson:true};
 const pose=calculateVehicleCameraPose(vehicle);
 assert.equal(pose.mode,"driver");
 assert.ok(pose.position.y>1.7&&pose.position.y<1.9);
 assert.ok(pose.target.z<pose.position.z-10);
 const horizontal=Math.hypot(pose.target.x-pose.position.x,pose.target.z-pose.position.z);
 const downwardPitch=Math.atan2(pose.position.y-pose.target.y,horizontal);
 assert.ok(downwardPitch>.09,"driver view must show the road, not only the sky");
});

test("chase camera remains behind the car at every cardinal heading",()=>{
 for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  const vehicle={x:7,z:-12,yaw,altitude:0,horizontalSpeed:14,firstPerson:false};
  const pose=calculateVehicleCameraPose(vehicle);
  assert.ok(localBehind(vehicle,pose.position)>8);
  assert.ok(pose.target.y<pose.position.y);
 }
});

test("camera rig stays attached to the car and follows turns smoothly",()=>{
 const rig=createVehicleCameraRig();
 const vehicle={x:2.5,z:10.5,yaw:0,speed:0,vx:0,vz:0,altitude:0,verticalSpeed:0,battery:100,firstPerson:false};
 const dt=1/60;
 let pose=rig.update(vehicle,dt,true);
 for(let frame=0;frame<600;frame++){
  const steer=frame>=100&&frame<310?.34:frame>=310&&frame<440?-.3:0;
  stepDynamics(vehicle,steer,dt,frame);
  vehicle.x+=vehicle.vx*dt;
  vehicle.z+=vehicle.vz*dt;
  pose=rig.update(vehicle,dt,false);
  if(frame>35){
   assert.ok(localBehind(vehicle,pose.position)>5.5,"camera must stay behind the current car heading");
   assert.ok(Math.hypot(pose.position.x-vehicle.x,pose.position.z-vehicle.z)<12.5,"camera must remain close enough to follow the car");
  }
 }
 assert.ok(Math.hypot(pose.target.x-vehicle.x,pose.target.z-vehicle.z)<4);
});

function stepDynamics(vehicle,steer,dt,frame){
 return stepVehicleDynamics(vehicle,{throttle:frame<500?1:0,steer},dt);
}
