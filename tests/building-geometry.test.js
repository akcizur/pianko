import test from "node:test";
import assert from "node:assert/strict";
import {calculateBuildingEndWallCenters,calculateFloorSlabSegments,calculatePanelakLayout,calculateFloorSegmentsWithOpening} from "../src/world/building-geometry.js";
test("end walls are symmetric and have the correct separation",()=>{
 for(const z of [11,-6,-23,-40,-57,-74]){
  const [a,b]=calculateBuildingEndWallCenters(z,13,.32);
  assert.ok(Math.abs((a+b)/2-z)<1e-10);
  assert.ok(Math.abs((b-a)-(13-.32))<1e-10);
 }
});
test("upper slab is split around the stair opening while ground slab stays solid",()=>{
 const input={x:-14.2,z:-6,width:10,depth:13,stairX:-13.85,landingX:-15.77};
 const ground=calculateFloorSlabSegments({...input,storyIndex:0});
 const upper=calculateFloorSlabSegments({...input,storyIndex:1});
 assert.equal(ground.length,1);
 assert.equal(upper.length,4);
 const area=upper.reduce((sum,p)=>sum+p.width*p.depth,0);
 const holeWidth=Math.abs(input.stairX-input.landingX)+.64;
 const holeDepth=2.78;
 assert.ok(Math.abs(area-(input.width*input.depth-holeWidth*holeDepth))<1e-8);
 assert.ok(upper.every(p=>p.width>0&&p.depth>0));
});
test("opening remains inside a narrow footprint",()=>{
 const parts=calculateFloorSlabSegments({x:0,z:-40,width:9.2,depth:13,stairX:-.5,landingX:-2.42,storyIndex:2});
 assert.ok(parts.every(p=>p.width>0&&p.depth>0));
 assert.ok(parts.reduce((area,p)=>area+p.width*p.depth,0)<9.2*13);
});

test("rear stairwell does not occupy the apartment doorway approach",()=>{
 for(const side of [-1,1])for(const z of [11,-6,-23,-40,-57,-74]){
  const layout=calculatePanelakLayout({x:side*14.2,z,width:9.2,depth:13,inward:-side});
  assert.ok(layout.corridorClearance>=.55,"clear corridor between apartment door and stairwell");
  assert.ok(layout.stairwellMinX>=layout.minHallX-.001);
  assert.ok(layout.stairwellMaxX<=layout.maxHallX+.001);
 }
});
test("stairwell placement is symmetric in both facade orientations",()=>{
 const west=calculatePanelakLayout({x:-14.2,z:-6,width:10,depth:13,inward:1});
 const east=calculatePanelakLayout({x:14.2,z:-6,width:10,depth:13,inward:-1});
 assert.ok(Math.abs(west.corridorClearance-east.corridorClearance)<1e-9);
 assert.ok(west.stairwellMinX<west.stairwellMaxX);
 assert.ok(east.stairwellMinX<east.stairwellMaxX);
});
