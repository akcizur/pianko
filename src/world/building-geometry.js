/** Geometry helpers for panel-block shells and stairwell floor cut-outs. */
export function calculateBuildingEndWallCenters(z,depth,wall=.32){
  const halfDepth=Math.max(0,depth/2-wall/2);
  return [z-halfDepth,z+halfDepth];
}
export function calculateFloorSlabSegments({
 x,z,width,depth,stairX,landingX,storyIndex=0,
 stairEndMargin=.16,landingEndMargin=.48,openingHalfDepth=1.39,
 elevatorOpening=null,perimeterInset=0
}){
 const inset=Math.max(0,Number(perimeterInset)||0);
 const slabWidth=width-inset*2,slabDepth=depth-inset*2;
 if(slabWidth<=.02||slabDepth<=.02)return [];
 const bounds={minX:x-slabWidth/2,maxX:x+slabWidth/2,minZ:z-slabDepth/2,maxZ:z+slabDepth/2};
 const openings=[];
 if(storyIndex>0){
  const stairIsMin=stairX<landingX;
  const cutMinX=Math.max(bounds.minX,Math.min(stairX,landingX)-(stairIsMin?stairEndMargin:landingEndMargin));
  const cutMaxX=Math.min(bounds.maxX,Math.max(stairX,landingX)+(stairIsMin?landingEndMargin:stairEndMargin));
  const cutMinZ=Math.max(bounds.minZ,z-openingHalfDepth);
  const cutMaxZ=Math.min(bounds.maxZ,z+openingHalfDepth);
  if(cutMaxX-cutMinX>.1&&cutMaxZ-cutMinZ>.1){
   openings.push({x:(cutMinX+cutMaxX)/2,z:(cutMinZ+cutMaxZ)/2,width:cutMaxX-cutMinX,depth:cutMaxZ-cutMinZ});
  }
 }
 if(elevatorOpening)openings.push(elevatorOpening);
 let segments=[{x,z,width:slabWidth,depth:slabDepth}];
 for(const opening of openings){
  segments=segments.flatMap(segment=>calculateFloorSegmentsWithOpening({...segment,opening}));
 }
 return segments;
}

/**
 * Canonical walkable panel-block layout. "inward" is retained as the
 * historical name for the outward-facing facade normal (+/- X).
 */
export function calculatePanelakLayout({
 x,z,width,depth,inward,wall=.32,hallHalf=1.42,
 flightLength=1.92,stairRearClearance=2.5,doorHalfWidth=.48
}){
 const frontX=x+inward*width/2;
 const frontWallX=frontX-inward*wall/2;
 const backX=x-inward*(width/2-wall/2);
 const insideFront=frontX-inward*(wall+.05);
 const insideBack=backX+inward*(wall+.05);
 const minHallX=Math.min(insideFront,insideBack);
 const maxHallX=Math.max(insideFront,insideBack);
 // Keep the stairwell at the rear end so the apartment entrance is not
 // embedded in a stair flight or landing.
 const stairX=insideBack+inward*stairRearClearance;
 const landingX=stairX-inward*flightLength;
 const stairIsMin=stairX<landingX;
 const stairwellMinX=Math.min(stairX,landingX)-(stairIsMin?.16:.48);
 const stairwellMaxX=Math.max(stairX,landingX)+(stairIsMin?.48:.16);
 const apartmentDoorMinX=x-doorHalfWidth;
 const apartmentDoorMaxX=x+doorHalfWidth;
 const corridorClearance=Math.max(
   apartmentDoorMinX-stairwellMaxX,
   stairwellMinX-apartmentDoorMaxX
 );
 const endWallCenters=calculateBuildingEndWallCenters(z,depth,wall);
 return {
  frontX,frontWallX,backX,insideFront,insideBack,minHallX,maxHallX,
  stairX,landingX,flightLength,hallHalf,
  hallWallZs:[z-hallHalf,z+hallHalf],
  endWallCenters,stairwellMinX,stairwellMaxX,
  apartmentDoorMinX,apartmentDoorMaxX,corridorClearance
 };
}

/** Subtract one rectangular opening from a horizontal floor rectangle. */
export function calculateFloorSegmentsWithOpening({x,z,width,depth,opening}){
 const minX=x-width/2,maxX=x+width/2,minZ=z-depth/2,maxZ=z+depth/2;
 if(!opening)return [{x,z,width,depth}];
 const cutMinX=Math.max(minX,opening.x-opening.width/2);
 const cutMaxX=Math.min(maxX,opening.x+opening.width/2);
 const cutMinZ=Math.max(minZ,opening.z-opening.depth/2);
 const cutMaxZ=Math.min(maxZ,opening.z+opening.depth/2);
 if(cutMaxX-cutMinX<=.02||cutMaxZ-cutMinZ<=.02)return [{x,z,width,depth}];
 const cutWidth=cutMaxX-cutMinX;
 return [
  {x:(minX+cutMinX)/2,z,width:cutMinX-minX,depth},
  {x:(cutMaxX+maxX)/2,z,width:maxX-cutMaxX,depth},
  {x:(cutMinX+cutMaxX)/2,z:(minZ+cutMinZ)/2,width:cutWidth,depth:cutMinZ-minZ},
  {x:(cutMinX+cutMaxX)/2,z:(cutMaxZ+maxZ)/2,width:cutWidth,depth:maxZ-cutMaxZ}
 ].filter(part=>part.width>.02&&part.depth>.02);
}

/**
 * Put the elevator beside the stair flights, with its landing door opening
 * from the corridor wall. The shaft occupies a reserved bay in the adjacent
 * apartment shell, never the clear corridor.
 */
export function calculateElevatorShaftLayout({
 stairX,inward,z,elevatorSideZ=1,hallHalf=1.42,
 doorWidth=1.12,shaftWidth=1.4,shaftDepth=1.62,wall=.32,cabDoorOffset=.66
}){
 const side=Math.sign(elevatorSideZ)||1;
 const centerX=stairX+inward*.35;
 const doorPlaneZ=z+side*hallHalf;
 const centerZ=doorPlaneZ+side*shaftDepth/2;
 const cabCenterZ=doorPlaneZ+side*cabDoorOffset;
 const backWallZ=centerZ+side*(shaftDepth/2-wall/2);
 const sideWallOffset=shaftWidth/2-wall/2;
 return {
  centerX,centerZ,cabCenterZ,z:doorPlaneZ,
  inward,elevatorSideZ:side,doorWidth,shaftWidth,shaftDepth,doorPlaneZ,backWallZ,
  sideWallXs:[centerX-sideWallOffset,centerX+sideWallOffset],
  minX:centerX-shaftWidth/2,maxX:centerX+shaftWidth/2,
  minZ:centerZ-shaftDepth/2,maxZ:centerZ+shaftDepth/2,
  opening:{x:centerX,z:centerZ,width:shaftWidth+.04,depth:shaftDepth}
 };
}
/** Six entrance bells sit in one vertical column on the wall beside the door. */
export function calculateEntranceBellLayout({frontX,inward,z,doorWidth,floorOffset}){
 const panelZ=z+doorWidth/2+.28;
 return {
  panel:{x:frontX+inward*.04,y:floorOffset+1.02,z:panelZ,width:.08,height:.58,depth:.18},
  buttons:Array.from({length:6},(_,index)=>({
   x:frontX+inward*.085,
   y:floorOffset+1.50-index*.064,
   z:panelZ,width:.04,height:.035,depth:.045
  }))
 };
}
/** Entrance door placement is used by both visible leaf and collision bounds. */
export function calculateEntranceDoorLayout({frontX,inward,z,doorWidth,floorOffset}){
 const planeX=frontX+inward*.055;
 return {
  planeX,hingeZ:z-doorWidth/2,openAngle:-inward*Math.PI/2,
  interactX:frontX+inward*.56,
  collider:{minX:planeX-.07,maxX:planeX+.07,minZ:z-doorWidth/2,maxZ:z+doorWidth/2,minY:floorOffset,maxY:floorOffset+2.14}
 };
}
/** Apartment door pivots face the corridor; prompts are placed on the corridor side. */
export function calculateApartmentDoorPlacement({doorX,wallZ,sideZ,floorY,doorWidth=.86}){
 const planeZ=wallZ+sideZ*.06;
 return {
  pivotX:doorX-doorWidth/2,pivotZ:planeZ,
  approachX:doorX,approachZ:wallZ-sideZ*.52,
  openAngle:-sideZ*Math.PI/2,
  collider:{minX:doorX-doorWidth/2,maxX:doorX+doorWidth/2,minZ:planeZ-.055,maxZ:planeZ+.055,minY:floorY,maxY:floorY+2.08}
 };
}
/** Bathroom lies on the low-X side in both mirror apartment orientations. */
export function calculateBathroomDoorSwing(){return -1.12;}

/** Four continuous perimeter guardrail runs for an accessible flat roof. */
export function calculateRoofGuardrailSegments({x,z,width,depth,inset=.18}){
 const minX=x-width/2+inset,maxX=x+width/2-inset;
 const minZ=z-depth/2+inset,maxZ=z+depth/2-inset;
 return [
  {start:{x:minX,z:minZ},end:{x:maxX,z:minZ}},
  {start:{x:minX,z:maxZ},end:{x:maxX,z:maxZ}},
  {start:{x:minX,z:minZ},end:{x:minX,z:maxZ}},
  {start:{x:maxX,z:minZ},end:{x:maxX,z:maxZ}}
 ];
}
