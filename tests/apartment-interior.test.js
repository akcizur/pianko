import test from "node:test";import assert from "node:assert/strict";
import {calculateApartmentLayout} from "../src/world/apartment-interior.js";
test("panel flat keeps two full-size rooms and a separate service core",()=>{const p=calculateApartmentLayout({unitMinX:-4.4,unitMaxX:4.4});assert.equal(p.unitWidth,8.8);assert.ok(p.livingWidth>=4.3);assert.ok(p.bedroomWidth>=4.3);assert.ok(p.livingArea>=19);assert.ok(p.bedroomArea>=19);assert.ok(p.bathroomArea>=3.5&&p.bathroomArea<=3.8);});
test("interior passage widths remain usable at the measured building width",()=>{const p=calculateApartmentLayout({unitMinX:-4.4,unitMaxX:4.4});assert.equal(p.bathroomDoorWidth,.72);assert.equal(p.roomDoorWidth,.88);assert.ok(p.bathroomWidth>=1.8);assert.ok(p.bathroomDepth>=1.9);});
