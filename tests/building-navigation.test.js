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
  assert.ok(Math.abs(resolve(-14.21,-6.72,.18)-(.18+2.9*.25))<1e-9);
  assert.ok(Math.abs(resolve(-15.17,-6.72,.18+2.9*.25)-(.18+2.9/2))<1e-9);
  assert.ok(Math.abs(resolve(-15.17,-6,.18+2.9/2)-(.18+2.9/2))<1e-9);
  assert.ok(Math.abs(resolve(-14.21,-5.28,.18+2.9/2)-(.18+2.9*.75))<1e-9);
  assert.ok(Math.abs(resolve(-13.25,-5.28,.18+2.9*.75)-(.18+2.9))<1e-9);
});

test("building stair solvers are isolated in both street orientations",()=>{
  const left=makeEntry();
  const right=makeEntry({id:"VÝCHODNÍ PANELÁK",x:14,z:-23,frontX:9,inward:-1,stairX:13.25,landingX:15.17});
  const resolve=createBuildingElevationResolver([left,right]);
  assert.ok(Math.abs(resolve(14.21,-23.72,.18)-(.18+2.9*.25))<1e-9);
  assert.ok(Math.abs(resolve(15.17,-23.72,.18+2.9*.25)-(.18+2.9/2))<1e-9);
  assert.ok(Math.abs(resolve(14.21,-22.28,.18+2.9/2)-(.18+2.9*.75))<1e-9);
  assert.ok(Math.abs(resolve(13.25,-22.28,.18+2.9*.75)-(.18+2.9))<1e-9);
  assert.equal(resolve(40,40,3.1),3.1);
});


import { createPlayerController } from "../src/core/player-controller.js";

function testCamera() {
  return {
    position:{x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}},
    rotation:{x:0,y:0,z:0,order:"XYZ"}
  };
}

test("player controller can climb both flights, cross the landing and descend",()=>{
  const building=makeEntry();
  const resolve=createBuildingElevationResolver([building]);
  const controller=createPlayerController({
    camera:testCamera(),
    state:{started:true,paused:false},
    navigation:{elevationAt:resolve}
  });
  assert.equal(controller.setSpawn({x:-8.1,z:-6,yaw:Math.PI/2}),true);
  const walk=(yaw,frames)=>{
    controller.player.yaw=yaw;
    controller.keysDown.KeyW=true;
    for(let frame=0;frame<frames;frame++)controller.update(.05);
    delete controller.keysDown.KeyW;
  };

  // Walk through the front entrance, then align at the bottom of the first flight.
  walk(Math.PI/2,27);
  assert.ok(Math.abs(controller.player.x-(-12.96))<1e-8);
  walk(0,4);
  assert.ok(Math.abs(controller.player.z-(-6.72))<1e-8);
  walk(Math.PI/2,13);
  assert.ok(Math.abs(controller.player.elevation-(.18+2.9/2))<1e-8);

  // Cross the landing and climb the second flight.
  walk(Math.PI,8);
  assert.ok(Math.abs(controller.player.z-(-5.28))<1e-8);
  walk(-Math.PI/2,12);
  assert.ok(Math.abs(controller.player.elevation-(.18+2.9))<1e-8);

  // Descend via the same two flights in reverse.
  walk(Math.PI/2,12);
  assert.ok(Math.abs(controller.player.elevation-(.18+2.9/2))<1e-8);
  walk(0,8);
  assert.ok(Math.abs(controller.player.z-(-6.72))<1e-8);
  walk(-Math.PI/2,12);
  assert.ok(Math.abs(controller.player.elevation-.18)<1e-8);
});
