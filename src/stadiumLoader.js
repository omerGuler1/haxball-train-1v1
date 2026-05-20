import fs from "node:fs/promises";

export async function loadStadiumJsonString(stadiumPath) {
  const raw = await fs.readFile(stadiumPath, "utf8");
  JSON.parse(raw); // validate JSON early so errors are loud
  return raw;
}
