import test from "node:test";import assert from "node:assert/strict";
import {calculateApartmentLayout,APARTMENT_FLOOR_LAYERS,calculateApartmentFurnitureLayout,calculateApartmentDepthMapping,calculateRoomPartitionSegments} from "../src/world/apartment-interior.js";
import {calculateFloorSegmentsWithOpening} from "../src/world/building-geometry.js";
test("panel flat keeps two full-size rooms and a separate service core",()=>{const p=calculateApartmentLayout({unitMinX:-4.4,unitMaxX:4.4});assert.equal(p.unitWidth,8.8);assert.ok(p.livingWidth>=4.3);assert.ok(p.bedroomWidth>=4.3);assert.ok(p.livingArea>=19);assert.ok(p.bedroomArea>=19);assert.ok(p.bathroomArea>=3.5&&p.bathroomArea<=3.8);});
test("interior passage widths remain usable at the measured building width",()=>{const p=calculateApartmentLayout({unitMinX:-4.4,unitMaxX:4.4});assert.equal(p.bathroomDoorWidth,.72);assert.equal(p.roomDoorWidth,.88);assert.ok(p.bathroomWidth>=1.8);assert.ok(p.bathroomDepth>=1.9);});

test("bathroom tile replaces rather than overlays the wood floor",()=>{
 const x=0,z=3.84,width=9,depth=4.56,opening={x:-2.8,z:2.58,width:1.9,depth:2.04};
 const parts=calculateFloorSegmentsWithOpening({x,z,width,depth,opening});
 const covered=parts.reduce((sum,p)=>sum+p.width*p.depth,0);
 assert.ok(Math.abs(covered-(width*depth-opening.width*opening.depth))<1e-8);
});
test("wood and tile share one walkable top surface",()=>{
 const floorTop=APARTMENT_FLOOR_LAYERS.floorBottom+APARTMENT_FLOOR_LAYERS.woodThickness;
 const tileTop=APARTMENT_FLOOR_LAYERS.floorBottom+APARTMENT_FLOOR_LAYERS.tileThickness;
 assert.ok(Math.abs(floorTop-tileTop)<1e-10);
 assert.ok(floorTop<.02);
 assert.ok(APARTMENT_FLOOR_LAYERS.rugThickness<.02);
});

test("large furniture stays within each room zone and does not reuse the bathroom footprint",()=>{
 const f=calculateApartmentFurnitureLayout({unitMinX:-18.27,unitMaxX:-9.97,dividerX:-14.12,bathroomMaxX:-16.25,z:-6,sideZ:-1});
 assert.ok(f.televisionX>-16.25,"TV is placed on the room side of the bathroom wall");
 assert.ok(f.livingX>-16.25&&f.bedroomX>-14.12);
 assert.ok(f.deskX+.625<=furnitureBounds.maxX);
 const sofaDepth=(f.sofaZ+6)*-1,tableDepth=(f.coffeeTableZ+6)*-1;
 assert.ok(tableDepth<sofaDepth-.45,"coffee table stays on the corridor-facing side of the sofa");
});
const furnitureBounds={maxX:-9.97};

test("living room furniture clears the sofa, and the refrigerator joins the kitchen run",()=>{
 for(const sideZ of [-1,1]){
  const f=calculateApartmentFurnitureLayout({unitMinX:-18.27,unitMaxX:-9.97,dividerX:-14.12,bathroomMaxX:-16.25,z:-6,sideZ});
  const kitchenLength=Math.max(1.8,(-14.12-(-18.27))-2.05);
  const kitchenNearEdge=f.livingX-kitchenLength/2;
  assert.ok(Math.abs(f.fridgeX-.31-kitchenNearEdge)<1e-8);
  assert.ok(f.fridgeX-.31>=-16.25&&f.fridgeX+.31<=-14.12,"fridge stays within the living room and kitchen side");
  assert.ok(Math.abs(f.televisionX-f.livingX)<1e-9);
  assert.ok(Math.abs(f.televisionZ-f.sofaZ)-(.9/2+.76/2)>.1,"TV stays in front of the sofa, not inside its footprint");
  const bed={minX:f.bedroomX-.81,maxX:f.bedroomX+.81,minZ:f.bedZ-1.02,maxZ:f.bedZ+1.02};
  const desk={minX:f.deskX-.625,maxX:f.deskX+.625,minZ:f.deskZ-.275,maxZ:f.deskZ+.275};
  const overlapX=bed.minX<desk.maxX&&bed.maxX>desk.minX;
  const overlapZ=bed.minZ<desk.maxZ&&bed.maxZ>desk.minZ;
  assert.ok(!overlapX||!overlapZ,"desk and bed footprints must not intersect");
 }
});

test("widening the corridor keeps apartment floors and furniture inside the reduced room envelope",()=>{
 for(const sideZ of [-1,1]){
  const depth=calculateApartmentDepthMapping({hallHalf:1.72,depth:13});
  assert.ok(Math.abs(depth.start-1.86)<1e-10);
  assert.ok(Math.abs(depth.end-6.12)<1e-10);
  assert.ok(Math.abs(depth.map(1.56)-depth.start)<1e-10);
  assert.ok(Math.abs(depth.map(6.12)-depth.end)<1e-10);
  const f=calculateApartmentFurnitureLayout({
   unitMinX:-18.27,unitMaxX:-9.97,dividerX:-14.12,bathroomMaxX:-16.25,
   z:-6,sideZ,depthOffset:depth.offset,depthScale:depth.scale
  });
  const toDepth=value=>(value+6)/sideZ;
  for(const position of [f.wardrobeZ,f.televisionZ,f.coffeeTableZ,f.sofaZ,f.diningZ,f.bedZ,f.deskZ,f.kitchenZ,f.radiatorZ]){
   const d=toDepth(position);
   assert.ok(d>=depth.start-.001&&d<=depth.end+.001,"furniture depth remains inside the apartment, not the corridor or rear wall");
  }
 }
});

test("apartment depth mapping preserves the rear wall clearance in wide and narrow buildings",()=>{
 const standard=calculateApartmentDepthMapping({hallHalf:1.72,depth:13});
 const shop=calculateApartmentDepthMapping({hallHalf:1.72,depth:15});
 assert.ok(standard.end>standard.start);
 assert.ok(shop.end>shop.start);
 assert.ok(Math.abs(standard.map(1.56)-standard.start)<1e-10);
 assert.ok(Math.abs(standard.map(6.12)-standard.end)<1e-10);
 assert.ok(Math.abs(shop.map(1.56)-shop.start)<1e-10);
 assert.ok(Math.abs(shop.map(6.12)-shop.end)<1e-10);
 assert.throws(()=>calculateApartmentDepthMapping({hallHalf:4,depth:5}),RangeError);
});

test("room divider wall lengths and door gaps stay aligned after corridor widening",()=>{
 const depth=calculateApartmentDepthMapping({hallHalf:1.72,depth:13});
 const segments=calculateRoomPartitionSegments({depthScale:depth.scale});
 const wallLength=segments.reduce((sum,segment)=>sum+segment.length,0);
 assert.equal(segments.length,3);
 assert.ok(Math.abs(wallLength+2*.88-(6.12-2.5)*depth.scale)<1e-8);
 assert.ok(segments.every(segment=>segment.length>.02));
 assert.throws(()=>calculateRoomPartitionSegments({doorCenters:[3,3.2],depthScale:1}),RangeError);
});
