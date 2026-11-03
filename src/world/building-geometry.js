/** Geometry helpers for panel-block shells and stairwell floor cut-outs. */
export function calculateBuildingEndWallCenters(z,depth,wall=.32){
  const halfDepth=Math.max(0,depth/2-wall/2);
  return [z-halfDepth,z+halfDepth];
}
export function calculateFloorSlabSegments({x,z,width,depth,stairX,landingX,storyIndex=0,stairEndMargin=.16,landingEndMargin=.48,openingHalfDepth=1.39}){
  const full={x,z,width,depth};
  if(storyIndex<=0)return [full];
  const bounds={minX:x-width/2,maxX:x+width/2,minZ:z-depth/2,maxZ:z+depth/2};
  const stairIsMin=stairX<landingX;
  const cutMinX=Math.max(bounds.minX,Math.min(stairX,landingX)-(stairIsMin?stairEndMargin:landingEndMargin));
  const cutMaxX=Math.min(bounds.maxX,Math.max(stairX,landingX)+(stairIsMin?landingEndMargin:stairEndMargin));
  const cutMinZ=Math.max(bounds.minZ,z-openingHalfDepth);
  const cutMaxZ=Math.min(bounds.maxZ,z+openingHalfDepth);
  if(cutMaxX-cutMinX<.1||cutMaxZ-cutMinZ<.1)return [full];
  const middleWidth=cutMaxX-cutMinX;
  return [
    {x:(bounds.minX+cutMinX)/2,z,width:cutMinX-bounds.minX,depth},
    {x:(cutMaxX+bounds.maxX)/2,z,width:bounds.maxX-cutMaxX,depth},
    {x:(cutMinX+cutMaxX)/2,z:(bounds.minZ+cutMinZ)/2,width:middleWidth,depth:cutMinZ-bounds.minZ},
    {x:(cutMinX+cutMaxX)/2,z:(cutMaxZ+bounds.maxZ)/2,width:middleWidth,depth:bounds.maxZ-cutMaxZ}
  ].filter(segment=>segment.width>.02&&segment.depth>.02);
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
