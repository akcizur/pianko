import test from "node:test";
import assert from "node:assert/strict";
import { createBuildingElevationResolver } from "../src/world/building-navigation.js";
import {calculatePanelakLayout} from "../src/world/building-geometry.js";

const makeEntry=(overrides={})=>{
  const input={id:"DŮM MÍR",x:-14,z:-6,width:10,depth:13,inward:1,doorWidth:1.34,
    floorOffset:.18,entryStepLength:.9,storyHeight:2.9,storyCount:6,...overrides};
  return {...input,...calculatePanelakLayout(input)};
};

test("entrance steps rise continuously from street to ground-floor threshold",()=>{
  const resolve=createBuildingElevationResolver([makeEntry()]);
  assert.equal(resolve(-8.1,-6,0),0);
  assert.ok(Math.abs(resolve(-8.55,-6,0)-.09)<1e-9);
  assert.ok(Math.abs(resolve(-9,-6,.09)-.18)<1e-9);
  assert.equal(resolve(-9.4,-6,.18),.18);
});

test("two-flight staircase reaches the next floor through its landing",()=>{
  const entry=makeEntry(),resolve=createBuildingElevationResolver([entry]);
  const firstMid=entry.stairX-entry.inward*entry.flightLength*.5;
  const secondMid=entry.landingX+entry.inward*entry.flightLength*.5;
  assert.ok(Math.abs(resolve(firstMid,-6.72,.18)-(.18+2.9*.25))<1e-9);
  assert.ok(Math.abs(resolve(entry.landingX,-6.72,.18+2.9*.25)-(.18+2.9/2))<1e-9);
  assert.ok(Math.abs(resolve(entry.landingX,-6,.18+2.9/2)-(.18+2.9/2))<1e-9);
  assert.ok(Math.abs(resolve(secondMid,-5.28,.18+2.9/2)-(.18+2.9*.75))<1e-9);
  assert.ok(Math.abs(resolve(entry.stairX,-5.28,.18+2.9*.75)-(.18+2.9))<1e-9);
});

test("building stair solvers are isolated in both street orientations",()=>{
  const left=makeEntry();
  const right=makeEntry({id:"VÝCHODNÍ PANELÁK",x:14,z:-23,inward:-1});
  const resolve=createBuildingElevationResolver([left,right]);
  const rightFirstMid=right.stairX-right.inward*right.flightLength*.5;
  const rightSecondMid=right.landingX+right.inward*right.flightLength*.5;
  assert.ok(Math.abs(resolve(rightFirstMid,-23.72,.18)-(.18+2.9*.25))<1e-9);
  assert.ok(Math.abs(resolve(right.landingX,-23.72,.18+2.9*.25)-(.18+2.9/2))<1e-9);
  assert.ok(Math.abs(resolve(rightSecondMid,-22.28,.18+2.9/2)-(.18+2.9*.75))<1e-9);
  assert.ok(Math.abs(resolve(right.stairX,-22.28,.18+2.9*.75)-(.18+2.9))<1e-9);
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
  walk(Math.PI/2,43);
  assert.ok(Math.abs(controller.player.x-(building.stairX+.13*building.inward))<1e-8);
  walk(0,4);
  assert.ok(Math.abs(controller.player.z-(-6.72))<1e-8);
  walk(Math.PI/2,12);
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

test("the final two-flight stair reaches the roof and stays there outside the stairwell",()=>{
 const entry=makeEntry(),resolve=createBuildingElevationResolver([entry]);
 const topBase=entry.floorOffset+(entry.storyCount-1)*entry.storyHeight;
 const upperFlightMid=entry.landingX+entry.inward*entry.flightLength*.5;
 assert.ok(Math.abs(resolve(upperFlightMid,-5.28,topBase+entry.storyHeight/2)-(topBase+entry.storyHeight*.75))<1e-8);
 assert.ok(Math.abs(resolve(entry.stairX,-5.28,topBase+entry.storyHeight*.75)-(topBase+entry.storyHeight))<1e-8);
 assert.equal(resolve(entry.stairX+.7,-5.28,topBase+entry.storyHeight),topBase+entry.storyHeight);
});
test("elevator cabin elevation follows the live lift position",()=>{
 const entry=makeEntry();
 entry.elevator={x:-19.46,z:-6,motion:{y:6.08}};
 const resolve=createBuildingElevationResolver([entry]);
 assert.equal(resolve(-19.46,-6,6.08),6.08);
 assert.equal(resolve(-19.46,-6,.18),6.08);
 assert.equal(resolve(-18.7,-6,.18),.18);
});
