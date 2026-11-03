import test from "node:test";
import assert from "node:assert/strict";
import { createBuildingElevationResolver } from "../src/world/building-navigation.js";

const makeEntry=(overrides={})=>({
  id:"DŮM MÍR",x:-14,z:-6,width:10,depth:13,frontX:-9,inward:1,doorWidth:1.34,
  floorOffset:.18,entryStepLength:.9,stairX:-13.25,landingX:-15.17,flightLength:1.92,
  storyHeight:2.9,storyCount:6,...overrides
});

test("entrance steps rise continuously from street to ground-floor threshold",()=>{
  const resolve=createBuildingElevationResolver([makeEntry()]);
  assert.equal(resolve(-8.1,-6,0),0);
  assert.ok(Math.abs(resolve(-8.55,-6,0)-.09)<1e-9);
  assert.ok(Math.abs(resolve(-9,-6,.09)-.18)<1e-9);
  assert.equal(resolve(-9.4,-6,.18),.18);
});

test("two-flight staircase reaches floor two through the landing",()=>{
  const resolve=createBuildingElevationResolver([makeEntry()]);
  assert.ok(Math.abs(resolve(-14.21,-6.72,.18)-(.18+2.9/2))<1e-9);
  assert.ok(Math.abs(resolve(-15.17,-6,.18+2.9/2)-(.18+2.9/2))<1e-9);
  assert.ok(Math.abs(resolve(-14.21,-5.28,.18+2.9/2)-(.18+2.9*.75))<1e-9);
  assert.ok(Math.abs(resolve(-13.25,-5.28,.18+2.9*.75)-(.18+2.9))<1e-9);
});

test("building stair solvers are isolated in both street orientations",()=>{
  const left=makeEntry();
  const right=makeEntry({id:"VÝCHODNÍ PANELÁK",x:14,z:-23,frontX:9,inward:-1,stairX:13.25,landingX:15.17});
  const resolve=createBuildingElevationResolver([left,right]);
  assert.equal(resolve(14,-23,2.18),2.18);
  assert.equal(resolve(40,40,3.1),3.1);
});
