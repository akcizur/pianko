/** Vehicle chase rig with local -Z forward axis and a damped, speed-aware follow. */
function rotateLocal(vehicle,local){
  const yaw=Number.isFinite(vehicle.yaw)?vehicle.yaw:0;
  const cosine=Math.cos(yaw),sine=Math.sin(yaw);
  const x=Number(vehicle.x)||0,z=Number(vehicle.z)||0,altitude=Number(vehicle.altitude)||0;
  return {x:x+local.x*cosine+local.z*sine,y:altitude+local.y,z:z-local.x*sine+local.z*cosine};
}
export function calculateVehicleCameraPose(vehicle={}){
  const speed=Math.max(0,Number(vehicle.horizontalSpeed)||Math.hypot(Number(vehicle.vx)||0,Number(vehicle.vz)||0));
  if(vehicle.firstPerson){
    return {
      mode:"driver",
      position:rotateLocal(vehicle,{x:-.43,y:1.78,z:-.42}),
      target:rotateLocal(vehicle,{x:-.43,y:.42,z:-13})
    };
  }
  const followDistance=8.5+Math.min(speed*.05,1.1);
  const followHeight=4.25+Math.min(speed*.018,.34)+Math.max(0,Number(vehicle.altitude)||0)*.18;
  return {
    mode:"chase",
    position:rotateLocal(vehicle,{x:0,y:followHeight,z:followDistance}),
    target:rotateLocal(vehicle,{x:0,y:1.16,z:-2.1})
  };
}

/** Stateful follow rig. The chase camera has short, damped lag instead of drifting away. */
export function createVehicleCameraRig(){
  let position=null,target=null,mode=null;
  const copy=value=>({x:value.x,y:value.y,z:value.z});
  const lerp=(from,to,alpha)=>({
    x:from.x+(to.x-from.x)*alpha,
    y:from.y+(to.y-from.y)*alpha,
    z:from.z+(to.z-from.z)*alpha
  });
  return {
    reset(){position=null;target=null;mode=null;},
    update(vehicle,deltaTime=1/60,snap=false){
      const desired=calculateVehicleCameraPose(vehicle);
      const dt=Math.max(0,Math.min(Number(deltaTime)||0,.05));
      const speed=Math.max(0,Number(vehicle.horizontalSpeed)||Math.hypot(Number(vehicle.vx)||0,Number(vehicle.vz)||0));
      if(snap||!position||mode!==desired.mode){
        position=copy(desired.position);
        target=copy(desired.target);
        mode=desired.mode;
      }else if(desired.mode==="driver"){
        // Driver view is rigidly attached to the cabin, never left trailing behind it.
        position=copy(desired.position);
        target=copy(desired.target);
      }else{
        const followRate=14+Math.min(speed*.28,5.5);
        const lookRate=18+Math.min(speed*.18,3.5);
        position=lerp(position,desired.position,1-Math.exp(-followRate*dt));
        target=lerp(target,desired.target,1-Math.exp(-lookRate*dt));
      }
      return {mode,position:copy(position),target:copy(target)};
    }
  };
}
