const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const damp=(v,rate,dt)=>v*Math.exp(-rate*dt);
export const VEHICLE_TUNING=Object.freeze({
 halfWidth:1.08,halfLength:2.12,bodyHeight:2.35,hoverThreshold:.8,maxAltitude:42,
 ground:Object.freeze({acceleration:7.2,reverseAcceleration:4.8,braking:14,rollingResistance:1.25,maxSpeed:16.5,maxReverseSpeed:5,maxSteerRate:.92,lowSpeedSteer:.16}),
 hover:Object.freeze({acceleration:5.8,reverseAcceleration:4.2,braking:7.5,drag:.48,maxSpeed:20,maxReverseSpeed:7,maxSteerRate:1.18,lowSpeedSteer:.2,liftAcceleration:8.2,maxVerticalSpeed:4.5,verticalDamping:2.8,batteryDrain:.42,speedDrain:.035,liftDrain:.45,rechargeRate:1.4})
});
/** Opposite throttle brakes first, then engages reverse after stopping. */
export function stepVehicleDynamics(vehicle,input={},deltaTime=1/60){
 const dt=clamp(Number(deltaTime)||0,0,.05);
 if(!dt)return {airborne:vehicle.altitude>VEHICLE_TUNING.hoverThreshold,batteryLow:false,landed:false};
 const throttle=clamp(Number(input.throttle)||0,-1,1),steer=clamp(Number(input.steer)||0,-1,1),lift=clamp(Number(input.lift)||0,-1,1);
 const tune=vehicle.altitude>VEHICLE_TUNING.hoverThreshold?VEHICLE_TUNING.hover:VEHICLE_TUNING.ground;
 const previousBattery=vehicle.battery,previousAltitude=vehicle.altitude;
 if(Math.abs(throttle)>.001){
  const opposing=Math.abs(vehicle.speed)>.12&&Math.sign(throttle)!==Math.sign(vehicle.speed);
  if(opposing)vehicle.speed=Math.sign(vehicle.speed)*Math.max(0,Math.abs(vehicle.speed)-tune.braking*Math.abs(throttle)*dt);
  else vehicle.speed+=throttle*(throttle>0?tune.acceleration:tune.reverseAcceleration)*dt;
 }else vehicle.speed=damp(vehicle.speed,tune.drag??tune.rollingResistance,dt);
 vehicle.speed=clamp(vehicle.speed,-tune.maxReverseSpeed,tune.maxSpeed);
 const steerFactor=tune.lowSpeedSteer+(1-tune.lowSpeedSteer)*Math.min(1,Math.abs(vehicle.speed)/6);
 if(Math.abs(vehicle.speed)>.06)vehicle.yaw+=steer*tune.maxSteerRate*steerFactor*Math.sign(vehicle.speed)*dt;
 const effectiveLift=(vehicle.battery>=12||lift<=0)?lift:0;
 vehicle.verticalSpeed=clamp(vehicle.verticalSpeed+effectiveLift*VEHICLE_TUNING.hover.liftAcceleration*dt,-VEHICLE_TUNING.hover.maxVerticalSpeed,VEHICLE_TUNING.hover.maxVerticalSpeed);
 if(Math.abs(effectiveLift)<.001)vehicle.verticalSpeed=damp(vehicle.verticalSpeed,VEHICLE_TUNING.hover.verticalDamping,dt);
 if(vehicle.battery<12&&vehicle.altitude>.05)vehicle.verticalSpeed=Math.min(vehicle.verticalSpeed,-2.6);
 vehicle.altitude=clamp(vehicle.altitude+vehicle.verticalSpeed*dt,0,VEHICLE_TUNING.maxAltitude);
 if(vehicle.altitude===0||vehicle.altitude===VEHICLE_TUNING.maxAltitude)vehicle.verticalSpeed=0;
 if(vehicle.altitude>.55&&vehicle.battery>0)vehicle.battery=Math.max(0,vehicle.battery-dt*(VEHICLE_TUNING.hover.batteryDrain+Math.abs(vehicle.speed)*VEHICLE_TUNING.hover.speedDrain+(effectiveLift>0?VEHICLE_TUNING.hover.liftDrain:0)));
 else if(vehicle.altitude<=.55)vehicle.battery=Math.min(100,vehicle.battery+dt*VEHICLE_TUNING.hover.rechargeRate);
 return {airborne:vehicle.altitude>VEHICLE_TUNING.hoverThreshold,batteryLow:previousBattery>12&&vehicle.battery<=12&&vehicle.altitude>.55,landed:previousAltitude>.55&&vehicle.altitude<=.55&&vehicle.battery<=0,batteryEmpty:previousBattery>0&&vehicle.battery<=0};
}
export function vehicleAabb(x,z,yaw,halfWidth=VEHICLE_TUNING.halfWidth,halfLength=VEHICLE_TUNING.halfLength){
 const c=Math.abs(Math.cos(yaw)),s=Math.abs(Math.sin(yaw)),ex=c*halfWidth+s*halfLength,ez=s*halfWidth+c*halfLength;
 return {minX:x-ex,maxX:x+ex,minZ:z-ez,maxZ:z+ez};
}
export function vehicleOverlapsCollider(bounds,collider,altitude=0,bodyHeight=VEHICLE_TUNING.bodyHeight){
 if(!collider||collider.enabled===false)return false;
 const minY=Number.isFinite(collider.minY)?collider.minY:0,maxY=Number.isFinite(collider.maxY)?collider.maxY:Infinity;
 if(minY>=altitude+bodyHeight||maxY<=altitude)return false;
 return bounds.maxX>collider.minX&&bounds.minX<collider.maxX&&bounds.maxZ>collider.minZ&&bounds.minZ<collider.maxZ;
}
/** Sub-stepped axis-separated movement prevents tunnelling and allows wall sliding. */
export function moveVehicleWithCollisions(vehicle,targetX,targetZ,colliders,options={}){
 const bounds=options.bounds??{minX:-7.2,maxX:7.2,minZ:-96,maxZ:29},altitude=vehicle.altitude??0,bodyHeight=options.bodyHeight??VEHICLE_TUNING.bodyHeight,maxStep=options.maxStep??.28;
 const collides=(x,z)=>{const box=vehicleAabb(x,z,vehicle.yaw);if(box.minX<bounds.minX||box.maxX>bounds.maxX||box.minZ<bounds.minZ||box.maxZ>bounds.maxZ)return true;return colliders.some(c=>c!==options.selfCollider&&vehicleOverlapsCollider(box,c,altitude,bodyHeight));};
 let movedX=false,movedZ=false;const dx=targetX-vehicle.x,dz=targetZ-vehicle.z;
 const nX=Math.max(1,Math.ceil(Math.abs(dx)/maxStep));
 for(let i=1;i<=nX;i++){const nx=vehicle.x+dx/nX;if(collides(nx,vehicle.z))break;vehicle.x=nx;movedX=true;}
 const nZ=Math.max(1,Math.ceil(Math.abs(dz)/maxStep));
 for(let i=1;i<=nZ;i++){const nz=vehicle.z+dz/nZ;if(collides(vehicle.x,nz))break;vehicle.z=nz;movedZ=true;}
 const blockedX=Math.abs(dx)>1e-4&&!movedX,blockedZ=Math.abs(dz)>1e-4&&!movedZ;
 if(blockedX&&blockedZ)vehicle.speed=0;else if(blockedX||blockedZ)vehicle.speed*=.22;
 return {movedX,movedZ,blockedX,blockedZ};
}
