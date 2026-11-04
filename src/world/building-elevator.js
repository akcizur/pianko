/** Smooth, deterministic multi-floor elevator motion with resumable state. */
/**
 * Test whether the player capsule has crossed the lift threshold and is
 * standing inside the cabin footprint. Depth is measured inward from the
 * landing-door plane, so mirrored shafts work identically.
 */
export function isPlayerInsideElevatorCab({
 playerX,playerZ,elevation,cabX,doorPlaneZ,side=1,floorY,
 halfWidth=.32,minDepth=.05,maxDepth=1.5,verticalTolerance=.72
}){
 const inwardDepth=(playerZ-doorPlaneZ)*(Math.sign(side)||1);
 return Number.isFinite(playerX)&&Number.isFinite(playerZ)&&Number.isFinite(elevation)&&
  Math.abs(playerX-cabX)<=halfWidth&&
  inwardDepth>=minDepth&&inwardDepth<=maxDepth&&
  Math.abs(elevation-floorY)<=verticalTolerance;
}
export function createBuildingElevator(floorHeights,{speed=2.8,doorSpeed=3.4}={}){
 if(!Array.isArray(floorHeights)||floorHeights.length<2||floorHeights.some(v=>!Number.isFinite(v)))throw new TypeError("Elevator requires at least two finite floor heights.");
 const heights=[...floorHeights],clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 let currentFloor=0,targetFloor=0,y=heights[0],doorOpen=1,phase="idle",rider=false;
 const snapshot=()=>({currentFloor,targetFloor,y,doorOpen,phase,rider});
 return {
  get y(){return y;},get currentFloor(){return currentFloor;},get targetFloor(){return targetFloor;},
  get doorOpen(){return doorOpen;},get moving(){return phase==="moving";},get phase(){return phase;},
  get rider(){return rider;},set rider(value){rider=Boolean(value);},
  get floorCount(){return heights.length;},
  serialize(){return snapshot();},
  restore(saved){
   if(!saved||typeof saved!=="object")return false;
   const validFloor=value=>Number.isInteger(value)&&value>=0&&value<heights.length;
   if(!validFloor(saved.currentFloor)||!validFloor(saved.targetFloor)||!Number.isFinite(saved.y))return false;
   currentFloor=saved.currentFloor;targetFloor=saved.targetFloor;
   y=clamp(saved.y,heights[0],heights[heights.length-1]);
   doorOpen=clamp(Number(saved.doorOpen)||0,0,1);
   phase=["idle","closing","moving","opening"].includes(saved.phase)?saved.phase:"idle";
   rider=Boolean(saved.rider);
   if(phase==="moving"||phase==="closing")doorOpen=0;
   if(phase==="idle"&&currentFloor!==targetFloor)phase="moving";
   return true;
  },
  requestFloor(index){
   if(!Number.isInteger(index)||index<0||index>=heights.length)return false;
   targetFloor=index;
   if(targetFloor===currentFloor&&Math.abs(y-heights[index])<1e-4){
    if(doorOpen<1)phase="opening";
    return true;
   }
   if(doorOpen>0)phase="closing";
   else phase="moving";
   return true;
  },
  step(deltaTime){
   const dt=clamp(Number(deltaTime)||0,0,.05);
   if(phase==="closing"){
    doorOpen=Math.max(0,doorOpen-doorSpeed*dt);
    if(doorOpen<=0)phase=targetFloor===currentFloor?"opening":"moving";
   }else if(phase==="moving"){
    const destination=heights[targetFloor],distance=destination-y,step=speed*dt;
    if(Math.abs(distance)<=step+.0001){
     y=destination;currentFloor=targetFloor;phase="opening";
    }else y+=Math.sign(distance)*step;
   }else if(phase==="opening"){
    doorOpen=Math.min(1,doorOpen+doorSpeed*dt);
    if(doorOpen>=1)phase="idle";
   }
   return {...snapshot(),moving:phase==="moving"};
  }
 };
}
