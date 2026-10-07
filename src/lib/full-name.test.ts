import assert from "node:assert/strict";
import test from "node:test";

import { isThreePartName } from "./full-name.ts";

test("يقبل اسمًا ثلاثي الكلمات فقط", () => {
  assert.equal(isThreePartName("محمد أحمد علي"), true);
  assert.equal(isThreePartName("Mohammed Ahmed Ali"), true);
});

test("يرفض اسمًا أقل أو أكثر من ثلاث كلمات", () => {
  assert.equal(isThreePartName("محمد أحمد"), false);
  assert.equal(isThreePartName("محمد أحمد علي سعد"), false);
});

test("يرفض الأرقام والرموز", () => {
  assert.equal(isThreePartName("محمد أحمد 123"), false);
  assert.equal(isThreePartName("محمد-أحمد-علي"), false);
});
