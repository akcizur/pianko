import test from "node:test";
import assert from "node:assert/strict";
import {calculateBuildingEndWallCenters,calculateFloorSlabSegments} from "../src/world/building-geometry.js";

test("panelak end walls stay symmetric around the building centre",()=>{
  for(const z of [11,-6,-23,-40,-57,-74]){
    const [near,far]=calculateBuildingEndWallCenters(z,13,.32);
    assert.ok(Math.abs((near+far)/2-z)<1e-10);
    assert.ok(Math.abs((far-near)-(13-.32))<1e-10);
    assert.ok(near<z&&far>z);
  }
});

test("upper floor slab leaves a clean rectangular stairwell opening",()=>{
  const args={x:-14.2,z:-6,width:10,depth:13,stairX:-13.85,landingX:-15.77};
  const full=calculateFloorSlabSegments({...args,storyIndex:0});
  const upper=calculateFloorSlabSegments({...args,storyIndex:1});
  assert.equal(full.length,1);
  assert.equal(full[0].width,args.width);
  assert.equal(upper.length,4);
  assert.ok(upper.every(part=>part.width>0&&part.depth>0));
  const coveredArea=upper.reduce((sum,part)=>sum+part.width*part.depth,0);
  const openingWidth=Math.max(args.stairX,args.landingX)+.48-(Math.min(args.stairX,args.landingX)-.48);
  const openingDepth=2*1.46;
  assert.ok(Math.abs(coveredArea-(args.width*args.depth-openingWidth*openingDepth))<1e-8);
  const openingMinX=Math.min(args.stairX,args.landingX)-.48;
  const openingMaxX=Math.max(args.stairX,args.landingX)+.48;
  for(const part of upper){
    const pMinX=part.x-part.width/2,pMaxX=part.x+part.width/2;
    if(pMinX<openingMaxX&&pMaxX>openingMinX){
      assert.ok(part.z+part.depth/2<=args.z-1.46+1e-8||part.z-part.depth/2>=args.z+1.46-1e-8);
    }
  }
});

test("stairwell cut-out stays inside a narrow building footprint",()=>{
  const segments=calculateFloorSlabSegments({x:0,z:-40,width:9.2,depth:13,stairX:-.5,landingX:-2.42,storyIndex:2});
  assert.ok(segments.every(part=>part.width>0&&part.depth>0));
  assert.ok(segments.reduce((area,part)=>area+part.width*part.depth,0)<9.2*13);
});
