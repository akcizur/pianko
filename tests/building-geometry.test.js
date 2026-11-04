import test from "node:test";
import assert from "node:assert/strict";
import {calculateBuildingEndWallCenters,calculateFloorSlabSegments,calculatePanelakLayout,calculateFloorSegmentsWithOpening,calculateElevatorShaftLayout,calculateEntranceDoorLayout,calculateEntranceBellLayout,calculateApartmentDoorPlacement,calculateRoofGuardrailSegments} from "../src/world/building-geometry.js";
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

test("interior elevator sits at the rear of the corridor and clears the stair flight",()=>{
 for(const side of [-1,1])for(const z of [11,-6,-23,-40,-57,-74]){
  const width=z===-40&&side===1?13:9.2,inward=-side,x=side*14.2;
  const layout=calculatePanelakLayout({x,z,width,depth:13,inward,wall:.32});
  const shaft=calculateElevatorShaftLayout({backX:layout.backX,insideFront:layout.insideFront,inward,z,wall:.32});
  assert.ok(shaft.minX>-23.2&&shaft.maxX<23.2);
  assert.ok(Math.abs((layout.insideFront-shaft.centerX)*inward-1.8)<1e-9);
  assert.ok(Math.abs((shaft.centerX-shaft.doorPlaneX)*inward-(shaft.shaftWidth/2-.04))<1e-9);
  const stairNearX=inward>0?layout.stairwellMaxX:layout.stairwellMinX;
  const shaftRearEdge=shaft.centerX-inward*shaft.shaftWidth/2;
  assert.ok((stairNearX-shaftRearEdge)*(-inward)>2.5,"lift remains separated from the stairwell");
  assert.ok(shaft.maxZ-shaft.minZ<2);
 }
});
test("ground, intermediate and roof slabs leave a continuous lift-shaft opening",()=>{
 const input={x:-14.2,z:-6,width:9.2,depth:13,stairX:-15.77,landingX:-13.85};
 const elevatorOpening={x:-11.77,z:-6,width:1.48,depth:1.8};
 for(const storyIndex of [0,2,6]){
  const parts=calculateFloorSlabSegments({...input,storyIndex,elevatorOpening,perimeterInset:.045});
  assert.ok(parts.length>=4);
  for(const part of parts){
   const overlapX=Math.min(part.x+part.width/2,elevatorOpening.x+elevatorOpening.width/2)-Math.max(part.x-part.width/2,elevatorOpening.x-elevatorOpening.width/2);
   const overlapZ=Math.min(part.z+part.depth/2,elevatorOpening.z+elevatorOpening.depth/2)-Math.max(part.z-part.depth/2,elevatorOpening.z-elevatorOpening.depth/2);
   assert.ok(!(overlapX>.02&&overlapZ>.02),"no slab segment may cover the lift opening");
   assert.ok(part.x-part.width/2>=input.x-input.width/2+.045-1e-9);
   assert.ok(part.x+part.width/2<=input.x+input.width/2-.045+1e-9);
   assert.ok(part.z-part.depth/2>=input.z-input.depth/2+.045-1e-9);
   assert.ok(part.z+part.depth/2<=input.z+input.depth/2-.045+1e-9);
  }
 }
});
test("entrance bells form a vertical column clear of the door jamb",()=>{
 for(const inward of [-1,1]){
  const layout=calculateEntranceBellLayout({frontX:inward*9.6,inward,z:-6,doorWidth:1.34,floorOffset:.18,wall:.32});
  const {panel,buttons}=layout;
  const frameOuterEdge=1.34/2+.09+.075;
  assert.equal(buttons.length,6);
  assert.ok(panel.z-(-6)-panel.depth/2>frameOuterEdge);
  assert.ok(buttons.every(button=>Math.abs(button.z-panel.z)<1e-9));
  assert.ok(buttons.every((button,index)=>index===0||buttons[index-1].y>button.y));
  assert.ok(buttons.every(button=>button.y>=panel.y&&button.y+button.height<=panel.y+panel.height));
 }
});
test("door transforms put apartment prompts in the corridor and entrance collider on the leaf",()=>{
 const apartment=calculateApartmentDoorPlacement({doorX:-14.2,wallZ:-7.42,sideZ:-1,floorY:3.093});
 assert.ok(apartment.approachZ>-7.42);
 assert.ok(apartment.pivotX< -14.2);
 assert.ok(apartment.collider.minY>3);
 const entrance=calculateEntranceDoorLayout({frontX:-9.6,inward:1,z:-6,doorWidth:1.34,floorOffset:.18});
 assert.ok(entrance.interactX>-9.6);
 assert.ok(entrance.collider.minX<entrance.planeX&&entrance.collider.maxX>entrance.planeX);
});

test("roof guardrails cover all four roof edges with a safe inset",()=>{
 for(const [x,z,width,depth] of [[-14.2,-6,9.2,13],[14.2,-23,10,13],[-14.2,-40,13,13]]){
  const rails=calculateRoofGuardrailSegments({x,z,width,depth});
  assert.equal(rails.length,4);
  const xs=rails.map(r=>[r.start.x,r.end.x]),zs=rails.map(r=>[r.start.z,r.end.z]);
  assert.ok(Math.abs(Math.min(...xs.flat())-(x-width/2+.18))<1e-9);
  assert.ok(Math.abs(Math.max(...xs.flat())-(x+width/2-.18))<1e-9);
  assert.ok(Math.abs(Math.min(...zs.flat())-(z-depth/2+.18))<1e-9);
  assert.ok(Math.abs(Math.max(...zs.flat())-(z+depth/2-.18))<1e-9);
  assert.ok(rails.every(r=>Math.hypot(r.end.x-r.start.x,r.end.z-r.start.z)>1));
 }
});
test("door approach, hinge and collider are consistent on both sides of the street",()=>{
 for(const inward of [-1,1]){
  const frontX=inward*9.6;
  const door=calculateEntranceDoorLayout({frontX,inward,z:-6,doorWidth:1.34,floorOffset:.18});
  assert.ok((door.interactX-frontX)*inward>.5);
  assert.ok((door.planeX-frontX)*inward>0);
  assert.ok(door.collider.minX<door.planeX&&door.collider.maxX>door.planeX);
 }
 for(const sideZ of [-1,1]){
  const door=calculateApartmentDoorPlacement({doorX:14.2,wallZ:-6+sideZ*1.42,sideZ,floorY:3.093});
  assert.ok((door.approachZ-door.pivotZ)*sideZ<0);
  assert.ok(door.collider.minY===3.093);
 }
});
