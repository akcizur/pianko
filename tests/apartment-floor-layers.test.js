import test from "node:test";
import assert from "node:assert/strict";
import {APARTMENT_FLOOR_LAYERS} from "../src/world/apartment-interior.js";

test("wood and bathroom tile finish flush while the carpet floats above",()=>{
 const woodTop=APARTMENT_FLOOR_LAYERS.floorBottom+APARTMENT_FLOOR_LAYERS.woodThickness;
 const tileTop=APARTMENT_FLOOR_LAYERS.floorBottom+APARTMENT_FLOOR_LAYERS.tileThickness;
 const rugBottom=woodTop+APARTMENT_FLOOR_LAYERS.surfaceGap;
 assert.ok(Math.abs(woodTop-tileTop)<1e-10);
 assert.ok(rugBottom>woodTop);
 assert.ok(APARTMENT_FLOOR_LAYERS.tileThickness>0);
 assert.ok(APARTMENT_FLOOR_LAYERS.rugThickness>0);
});
