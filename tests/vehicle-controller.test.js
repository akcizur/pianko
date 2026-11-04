import test from "node:test";
import assert from "node:assert/strict";
import {moveVehicleWithCollisions,stepVehicleDynamics,vehicleAabb,vehicleOverlapsCollider,VEHICLE_TUNING} from "../src/core/vehicle-controller.js";
const makeVehicle=(options={})=>({x:0,z:0,yaw:0,yawRate:0,speed:0,vx:0,vz:0,altitude:0,verticalSpeed:0,battery:100,...options});
const run=(v,input,seconds,step=1/60)=>{for(let t=0;t<seconds-1e-9;t+=step)stepVehicleDynamics(v,input,Math.min(step,seconds-t));};
test("ground car accelerates smoothly and remains speed limited",()=>{const c=makeVehicle();run(c,{throttle:1},8);assert.ok(c.speed>16&&c.speed<=18.5);assert.ok(c.vz<0);});
test("right steering turns toward world +X",()=>{const c=makeVehicle();run(c,{throttle:1,steer:1},2.2);assert.ok(c.yaw<0);assert.ok(c.vx>0);assert.ok(c.speed>0);});
test("left steering mirrors right steering",()=>{const c=makeVehicle();run(c,{throttle:1,steer:-1},2.2);assert.ok(c.yaw>0);assert.ok(c.vx<0);});
test("reverse steering rotates the nose opposite the forward turn",()=>{const c=makeVehicle({speed:-4,vz:4});run(c,{steer:1},.5);assert.ok(c.yaw>0);});
test("opposite throttle brakes before allowing reverse",()=>{const c=makeVehicle({speed:8,vz:-8});stepVehicleDynamics(c,{throttle:-1},.2);assert.ok(c.speed>=0);run(c,{throttle:-1},1.3);assert.ok(c.speed<0);});
test("released throttle rolls to a stop without reversing",()=>{const c=makeVehicle({speed:9,vz:-9});run(c,{},8);assert.ok(c.speed>=0&&c.speed<.35);});
test("tyre grip reduces lateral slip",()=>{const c=makeVehicle({vx:5,vz:-8});run(c,{},.7);assert.ok(Math.abs(c.vx)<5);});
test("hover craft yaws independently and preserves inertial flight",()=>{const c=makeVehicle({altitude:5});run(c,{throttle:1,steer:1},1.2);assert.ok(c.yaw<0);assert.ok(c.vx>0);const speed=Math.hypot(c.vx,c.vz);run(c,{steer:-1},.25);assert.ok(Math.hypot(c.vx,c.vz)>speed*.65);});
test("hover lift, battery drain and altitude ceiling work",()=>{const c=makeVehicle({altitude:4});run(c,{lift:1},1.5);assert.ok(c.altitude>4&&c.altitude<=42);const b=c.battery;run(c,{},2);assert.ok(c.battery<b);c.altitude=41.99;c.verticalSpeed=5;stepVehicleDynamics(c,{lift:1},.05);assert.equal(c.altitude,42);assert.equal(c.verticalSpeed,0);});
test("low battery starts emergency descent",()=>{const c=makeVehicle({altitude:5,battery:11});run(c,{},1);assert.ok(c.verticalSpeed<0);});
test("rotated vehicle bounds expand correctly",()=>{const a=vehicleAabb(0,0,0),b=vehicleAabb(0,0,Math.PI/2);assert.ok(a.maxZ-a.minZ>a.maxX-a.minX);assert.ok(b.maxX-b.minX>b.maxZ-b.minZ);});
test("vehicle collision respects height",()=>{const b=vehicleAabb(0,0,0);assert.equal(vehicleOverlapsCollider(b,{minX:-2,maxX:2,minZ:-3,maxZ:3,minY:4,maxY:5},0),false);assert.equal(vehicleOverlapsCollider(b,{minX:-2,maxX:2,minZ:-3,maxZ:3},0),true);});
test("wall collision removes inward velocity without reversal",()=>{const c=makeVehicle({speed:12,vz:-12});const w={minX:-2,maxX:2,minZ:-3,maxZ:-2,minY:0,maxY:3,enabled:true};const r=moveVehicleWithCollisions(c,0,-8,[w],{bounds:{minX:-12,maxX:12,minZ:-12,maxZ:12}});assert.equal(r.blockedZ,true);assert.ok(c.z>-1);assert.equal(c.vz,0);assert.equal(c.speed,0);});
test("wall collision keeps tangential sliding",()=>{const c=makeVehicle({vx:3,vz:1});const w={minX:1.2,maxX:2,minZ:-3,maxZ:3,minY:0,maxY:3,enabled:true};const r=moveVehicleWithCollisions(c,3,1,[w],{bounds:{minX:-12,maxX:12,minZ:-12,maxZ:12}});assert.equal(r.blockedX,true);assert.ok(r.movedZ);assert.ok(c.z>0);assert.equal(c.vx,0);});

test("hover W accelerates forward and S directly applies reverse thrust",()=>{
 const forward=makeVehicle({altitude:5}),reverse=makeVehicle({altitude:5});
 run(forward,{throttle:1},1.8);run(reverse,{throttle:-1},1.8);
 assert.ok(forward.vz<0&&forward.speed>0,"W moves along the nose");
 assert.ok(reverse.vz>0&&reverse.speed<0,"S directly applies reverse thrust");
});
test("hover reverse thrust smoothly carries forward velocity through zero",()=>{
 const craft=makeVehicle({altitude:5,speed:8,vz:-8});
 run(craft,{throttle:-1},2.4);
 assert.ok(craft.speed<0,"reverse thrust eventually moves the craft backwards");
 assert.ok(Number.isFinite(craft.vx)&&Number.isFinite(craft.vz));
});
test("hover coasts with smooth inertial drag after releasing W",()=>{
 const craft=makeVehicle({altitude:5});run(craft,{throttle:1},1.5);
 const before=Math.hypot(craft.vx,craft.vz);run(craft,{},.35);
 const after=Math.hypot(craft.vx,craft.vz);
 assert.ok(after<before&&after>before*.8);
});

test("default vehicle collision and steering dimensions match the Favorit hatchback",()=>{
 assert.ok(Math.abs(VEHICLE_TUNING.halfWidth-.9)<1e-10);
 assert.ok(Math.abs(VEHICLE_TUNING.halfLength-1.94)<1e-10);
 assert.ok(Math.abs(VEHICLE_TUNING.bodyHeight-1.48)<1e-10);
 assert.ok(Math.abs(VEHICLE_TUNING.ground.wheelbase-2.45)<1e-10);
});
