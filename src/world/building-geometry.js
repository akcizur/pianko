/** Geometry helpers for panel-block shells and stairwell floor cut-outs. */
export function calculateBuildingEndWallCenters(z,depth,wall=.32){
  const halfDepth=Math.max(0,depth/2-wall/2);
  return [z-halfDepth,z+halfDepth];
}
export function calculateFloorSlabSegments({x,z,width,depth,stairX,landingX,storyIndex=0,openingEndMargin=.48,openingHalfDepth=1.39}){
  const full={x,z,width,depth};
  if(storyIndex<=0)return [full];
  const bounds={minX:x-width/2,maxX:x+width/2,minZ:z-depth/2,maxZ:z+depth/2};
  const cutMinX=Math.max(bounds.minX,Math.min(stairX,landingX)-openingEndMargin);
  const cutMaxX=Math.min(bounds.maxX,Math.max(stairX,landingX)+openingEndMargin);
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
