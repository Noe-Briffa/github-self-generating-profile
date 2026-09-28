const test = require("node:test");
const assert = require("node:assert/strict");
const { repoWeight, detectFromLanguage, mergeScores, STACK_RULES } = require("../scripts/analyze-stack");

test("poids favorise activite recente sans ecraser", () => {
  assert.ok(repoWeight(30) > repoWeight(0));
  assert.ok(repoWeight(1000) < 10); // log, pas lineaire
});

test("pourcentages normalises", () => {
  const out = mergeScores(new Map([["Python", 4], ["TypeScript", 1]]));
  assert.equal(out[0].name, "Python");
  assert.equal(out.reduce((a, t) => a + t.percentage, 0), 100);
});

test("mapping contient base fiable spec", () => {
  const techs = STACK_RULES.map((r) => r.tech);
  for (const t of ["Docker", "Kubernetes", "React", "TypeScript", "FastAPI", "PyTorch"]) {
    assert.ok(techs.includes(t), `manquant: ${t}`);
  }
});

test("vieux projet inactif ne domine pas", () => {
  const hits = detectFromLanguage([
    { language: "Dart", commits30d: 0 },
    { language: "Python", commits30d: 30 },
  ]);
  assert.ok(hits.get("Python") > hits.get("Dart"));
});
