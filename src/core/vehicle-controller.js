const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const approach=(value,target,amount)=>value<target?Math.min(target,value+amount):Math.max(target,value-amount);
const wrapAngle=value=>Math.atan2(Math.sin(value),Math.cos(value));

export const VEHICLE_TUNING=Object.freeze({
 halfWidth:1.08,halfLength:2.12,bodyHeight:2.35,hoverThreshold:.8,maxAltitude:42,
 ground:Object.freeze({acceleration:7.8,reverseAcceleration:4.2,braking:11.5,rollingResistance:.72,aerodynamicDrag:.012,maxSpeed:18.5,maxReverseSpeed:7,wheelbase:2.62,maxSteerAngle:.49,maxYawRate:1.42,steeringResponse:9,lateralGrip:8.5,gripFade:.018}),
 hover:Object.freeze({acceleration:7.4,reverseAcceleration:5.2,braking:8.2,drag:.19,maxSpeed:24,maxReverseSpeed:10,yawRate:1.9,yawResponse:6.5,lateralGrip:.28,liftAcceleration:8.1,maxVerticalSpeed:5,verticalDamping:2.15,batteryDrain:.36,speedDrain:.025,liftDrain:.42,rechargeRate:1.4})
});
function initialiseVehicle(v){
 if(!Number.isFinite(v.yaw))v.yaw=0;
 if(!Number.isFinite(v.speed))v.speed=0;
 if(!Number.isFinite(v.vx)||!Number.isFinite(v.vz)){v.vx=-Math.sin(v.yaw)*v.speed;v.vz=-Math.cos(v.yaw)*v.speed;}
 if(!Number.isFinite(v.yawRate))v.yawRate=0;
 if(!Number.isFinite(v.altitude))v.altitude=0;
 if(!Number.isFinite(v.verticalSpeed))v.verticalSpeed=0;
 if(!Number.isFinite(v.battery))v.battery=100;
}

/** Ground: front-wheel bicycle steering, tyre grip, drag, and inertial velocity. Hover: independent yaw, vector thrust and flight drift. */
export function stepVehicleDynamics(vehicle,input={},deltaTime=1/60){
 initialiseVehicle(vehicle);
 const dt=clamp(Number(deltaTime)||0,0,.05);
 if(!dt)return {airborne:vehicle.altitude>VEHICLE_TUNING.hoverThreshold,batteryLow:false,landed:false,batteryEmpty:false};
 const throttle=clamp(Number(input.throttle)||0,-1,1),steer=clamp(Number(input.steer)||0,-1,1),lift=clamp(Number(input.lift)||0,-1,1);
 const oldBattery=vehicle.battery,oldAltitude=vehicle.altitude,airborne=oldAltitude>VEHICLE_TUNING.hoverThreshold;
 const tune=airborne?VEHICLE_TUNING.hover:VEHICLE_TUNING.ground;
 const fx=-Math.sin(vehicle.yaw),fz=-Math.cos(vehicle.yaw),rx=Math.cos(vehicle.yaw),rz=-Math.sin(vehicle.yaw);
 const longitudinal=vehicle.vx*fx+vehicle.vz*fz,lateral=vehicle.vx*rx+vehicle.vz*rz;
 let acceleration=0;
 if(airborne){
  acceleration=Math.abs(throttle)>.001
   ? throttle*(throttle>0?tune.acceleration:tune.reverseAcceleration)
   : -longitudinal*tune.drag;
 }else if(Math.abs(throttle)>.001){
  if(Math.abs(longitudinal)>.12&&Math.sign(throttle)!==Math.sign(longitudinal)){
   const next=approach(longitudinal,0,tune.braking*Math.abs(throttle)*dt);
   acceleration=(next-longitudinal)/dt;
  }else acceleration=throttle*(throttle>0?tune.acceleration:tune.reverseAcceleration);
 }else{
  const resistance=tune.rollingResistance+tune.aerodynamicDrag*longitudinal*longitudinal;
  acceleration=-Math.sign(longitudinal)*Math.min(Math.abs(longitudinal),resistance*dt)/dt;
 }
 const grip=airborne?tune.lateralGrip:tune.lateralGrip/(1+Math.abs(longitudinal)*tune.gripFade);
 const sideAcceleration=-lateral*grip,drag=airborne?tune.drag:.035;
 vehicle.vx+=(fx*acceleration+rx*sideAcceleration-vehicle.vx*drag)*dt;
 vehicle.vz+=(fz*acceleration+rz*sideAcceleration-vehicle.vz*drag)*dt;
 if(airborne){
  const target=-steer*tune.yawRate,response=1-Math.exp(-tune.yawResponse*dt);
  vehicle.yawRate+=(target-vehicle.yawRate)*response;
 }else{
  const angle=steer*tune.maxSteerAngle;
  const target=clamp(-longitudinal/tune.wheelbase*Math.tan(angle),-tune.maxYawRate,tune.maxYawRate);
  const response=1-Math.exp(-tune.steeringResponse*dt);
  vehicle.yawRate+=(target-vehicle.yawRate)*response;
 }
 vehicle.yaw=wrapAngle(vehicle.yaw+vehicle.yawRate*dt);
 const newFx=-Math.sin(vehicle.yaw),newFz=-Math.cos(vehicle.yaw);
 vehicle.speed=vehicle.vx*newFx+vehicle.vz*newFz;
 const maxForward=airborne?tune.maxSpeed:VEHICLE_TUNING.ground.maxSpeed;
 const maxReverse=airborne?tune.maxReverseSpeed:VEHICLE_TUNING.ground.maxReverseSpeed;
 if(vehicle.speed>maxForward||vehicle.speed< -maxReverse){
  const target=clamp(vehicle.speed,-maxReverse,maxForward),correction=target-vehicle.speed;
  vehicle.vx+=newFx*correction;vehicle.vz+=newFz*correction;vehicle.speed=target;
 }
 const magnitude=Math.hypot(vehicle.vx,vehicle.vz),limit=airborne?tune.maxSpeed:VEHICLE_TUNING.ground.maxSpeed;
 if(magnitude>limit){const scale=limit/magnitude;vehicle.vx*=scale;vehicle.vz*=scale;vehicle.speed=vehicle.vx*newFx+vehicle.vz*newFz;}
 vehicle.horizontalSpeed=Math.hypot(vehicle.vx,vehicle.vz);
 const effectiveLift=vehicle.battery>=12||lift<=0?lift:0;
 if(vehicle.altitude<=0&&effectiveLift<=0){vehicle.altitude=0;vehicle.verticalSpeed=0;}
 else{
  const verticalAcceleration=effectiveLift*VEHICLE_TUNING.hover.liftAcceleration-vehicle.verticalSpeed*VEHICLE_TUNING.hover.verticalDamping;
  vehicle.verticalSpeed=clamp(vehicle.verticalSpeed+verticalAcceleration*dt,-VEHICLE_TUNING.hover.maxVerticalSpeed,VEHICLE_TUNING.hover.maxVerticalSpeed);
  if(vehicle.battery<12&&vehicle.altitude>.05)vehicle.verticalSpeed=approach(vehicle.verticalSpeed,-2.6,4.5*dt);
  vehicle.altitude=clamp(vehicle.altitude+vehicle.verticalSpeed*dt,0,VEHICLE_TUNING.maxAltitude);
  if(vehicle.altitude===0||vehicle.altitude===VEHICLE_TUNING.maxAltitude)vehicle.verticalSpeed=0;
 }
 if(vehicle.altitude>.55&&vehicle.battery>0)vehicle.battery=Math.max(0,vehicle.battery-dt*(tune.batteryDrain+vehicle.horizontalSpeed*tune.speedDrain+(effectiveLift>0?VEHICLE_TUNING.hover.liftDrain:0)));
 else if(vehicle.altitude<=.55)vehicle.battery=Math.min(100,vehicle.battery+dt*VEHICLE_TUNING.hover.rechargeRate);
 return {airborne:vehicle.altitude>VEHICLE_TUNING.hoverThreshold,batteryLow:oldBattery>12&&vehicle.battery<=12&&vehicle.altitude>.55,landed:oldAltitude>.55&&vehicle.altitude<=.55&&vehicle.battery<=0,batteryEmpty:oldBattery>0&&vehicle.battery<=0};
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
export function moveVehicleWithCollisions(vehicle,targetX,targetZ,colliders,options={}){
 const bounds=options.bounds??{minX:-7.2,maxX:7.2,minZ:-96,maxZ:29},altitude=vehicle.altitude??0,bodyHeight=options.bodyHeight??VEHICLE_TUNING.bodyHeight,maxStep=options.maxStep??.22;
 const collides=(x,z)=>{const box=vehicleAabb(x,z,vehicle.yaw);if(box.minX<bounds.minX||box.maxX>bounds.maxX||box.minZ<bounds.minZ||box.maxZ>bounds.maxZ)return true;return colliders.some(c=>c!==options.selfCollider&&vehicleOverlapsCollider(box,c,altitude,bodyHeight));};
 const dx=targetX-vehicle.x,dz=targetZ-vehicle.z,nX=Math.max(1,Math.ceil(Math.abs(dx)/maxStep));
 let blockedX=false,blockedZ=false,movedX=false,movedZ=false;
 for(let i=1;i<=nX;i++){const nx=vehicle.x+dx/nX;if(collides(nx,vehicle.z)){blockedX=true;break;}vehicle.x=nx;movedX=true;}
 const nZ=Math.max(1,Math.ceil(Math.abs(dz)/maxStep));
 for(let i=1;i<=nZ;i++){const nz=vehicle.z+dz/nZ;if(collides(vehicle.x,nz)){blockedZ=true;break;}vehicle.z=nz;movedZ=true;}
 if(blockedX&&Number.isFinite(vehicle.vx))vehicle.vx=0;
 if(blockedZ&&Number.isFinite(vehicle.vz))vehicle.vz=0;
 if(Number.isFinite(vehicle.vx)&&Number.isFinite(vehicle.vz)){const forwardSpeed=vehicle.vx*-Math.sin(vehicle.yaw)+vehicle.vz*-Math.cos(vehicle.yaw);vehicle.speed=Math.abs(forwardSpeed)<1e-9?0:forwardSpeed;vehicle.horizontalSpeed=Math.hypot(vehicle.vx,vehicle.vz);}
 return {movedX,movedZ,blockedX,blockedZ};
}
