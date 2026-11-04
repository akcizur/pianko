/** Frame-rate independent hinge animation shared by entrance, flat and roof doors. */
export function stepDoorAnimation({amount=0,target=0,openAngle=0},deltaTime,speed=9){
 const dt=Math.max(0,Math.min(Number(deltaTime)||0,.05));
 const alpha=1-Math.exp(-Math.max(.1,speed)*dt);
 let next=amount+(target-amount)*alpha;
 if(Math.abs(target-next)<.001)next=target;
 const eased=next*next*(3-2*next);
 return {amount:next,angle:openAngle*eased,colliderEnabled:next<.96,settled:next===target};
}
