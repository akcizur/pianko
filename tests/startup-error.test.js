import test from "node:test";
import assert from "node:assert/strict";
import {describeStartupError,WEBGL_RENDERER_OPTIONS} from "../src/ui/startup-error.js";

test("WebGL failures produce a clear startup explanation",()=>{
 const state=describeStartupError(new Error("Error creating WebGL context."));
 assert.match(state.title,/GRAFIKA/);
 assert.match(state.message,/WebGL 2/);
 assert.match(state.steps,/hardwarovou akceleraci/);
 assert.match(state.detail,/WebGL context/);
});
test("other boot failures remain visible and actionable",()=>{
 const state=describeStartupError(new TypeError("Cannot read properties of undefined"));
 assert.match(state.title,/ZASTAVILA/);
 assert.match(state.steps,/Obnov stránku/);
});
test("renderer tries lightweight compatible context options first",()=>{
 assert.equal(WEBGL_RENDERER_OPTIONS.length,2);
 assert.deepEqual(WEBGL_RENDERER_OPTIONS.map(x=>x.powerPreference),["low-power","default"]);
 assert.ok(WEBGL_RENDERER_OPTIONS.every(x=>!x.antialias&&x.failIfMajorPerformanceCaveat===false));
});
