import test from "node:test";
import assert from "node:assert/strict";
import {APARTMENT_FLOOR_LAYERS} from "../src/world/apartment-interior.js";
test("wood, tile and carpet are mounted on separate height levels",()=>{
 const woodTop=APARTMENT_FLOOR_LAYERS.woodBottom+APARTMENT_FLOOR_LAYERS.woodThickness;
 const tileBottom=woodTop+APARTMENT_FLOOR_LAYERS.surfaceGap;
 const rugBottom=tileBottom+APARTMENT_FLOOR_LAYERS.surfaceGap;
 assert.ok(tileBottom>woodTop);
 assert.ok(rugBottom>woodTop);
 assert.ok(APARTMENT_FLOOR_LAYERS.tileThickness>0);
 assert.ok(APARTMENT_FLOOR_LAYERS.rugThickness>0);
});
