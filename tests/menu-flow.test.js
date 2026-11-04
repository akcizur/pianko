import test from "node:test";
import assert from "node:assert/strict";
import {resolvePrimaryMenuAction} from "../src/ui/menu-flow.js";

test("primary menu starts a fresh game when no save exists",()=>{
 assert.equal(resolvePrimaryMenuAction(false),"start-new");
});
test("primary menu resumes a valid saved game",()=>{
 assert.equal(resolvePrimaryMenuAction(true),"continue");
});
