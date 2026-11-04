import test from "node:test";import assert from "node:assert/strict";
import {calculateApartmentLayout,APARTMENT_FLOOR_LAYERS,calculateApartmentFurnitureLayout} from "../src/world/apartment-interior.js";
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
