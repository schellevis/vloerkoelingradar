// web/test/model.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { classify, recommendedSupply } from "../model.js";

test("classify boundaries belong to greener side", () => {
  assert.equal(classify(15.9).key, "volop");
  assert.equal(classify(16.0).key, "volop");   // grens -> groener
  assert.equal(classify(16.1).key, "gematigd");
  assert.equal(classify(18.0).key, "gematigd");
  assert.equal(classify(18.1).key, "beperkt");
  assert.equal(classify(21.0).key, "beperkt");
  assert.equal(classify(21.1).key, "niet");
  assert.equal(classify(25).key, "niet");
});

test("recommendedSupply uses margin then clamps to minSupply", () => {
  assert.equal(recommendedSupply(17, 2, 16), 19); // 17+2
  assert.equal(recommendedSupply(10, 2, 16), 16); // clamp
  assert.equal(recommendedSupply(17), 19);        // defaults 2/16
});
