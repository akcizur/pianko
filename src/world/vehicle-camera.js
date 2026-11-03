/** Stable chase and driver camera poses for the local -Z vehicle forward axis. */
function rotateLocal(vehicle,local){
  const yaw=Number.isFinite(vehicle.yaw)?vehicle.yaw:0;
  const cosine=Math.cos(yaw),sine=Math.sin(yaw);
  const x=Number(vehicle.x)||0,z=Number(vehicle.z)||0,altitude=Number(vehicle.altitude)||0;
  return {
    x:x+local.x*cosine+local.z*sine,
    y:altitude+local.y,
    z:z-local.x*sine+local.z*cosine
  };
}
export function calculateVehicleCameraPose(vehicle={}){
  const speed=Math.max(0,Number(vehicle.horizontalSpeed)||Math.hypot(Number(vehicle.vx)||0,Number(vehicle.vz)||0));
  if(vehicle.firstPerson){
    return {
      mode:"driver",
      position:rotateLocal(vehicle,{x:-.43,y:1.78,z:-.42}),
      target:rotateLocal(vehicle,{x:-.43,y:1.69,z:-12})
    };
  }
  const followDistance=8.2+Math.min(speed*.055,1.2);
  const followHeight=3.8+Math.min(speed*.018,.32);
  return {
    mode:"chase",
    position:rotateLocal(vehicle,{x:0,y:followHeight,z:followDistance}),
    target:rotateLocal(vehicle,{x:0,y:1.08,z:-1.9})
  };
}
