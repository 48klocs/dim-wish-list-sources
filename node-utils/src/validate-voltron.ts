import fs from "fs";
import { toWishList } from "./lib/wishlist-file.js";
import { isInvalidRoll } from "./utils.js";

let counter = 0;

const fileName = "voltron.txt";
let thisFileOutput = fileName;

const rolls = toWishList(
  fs.readFileSync("../" + fileName, "utf-8")
).wishListRolls;
thisFileOutput = ` (${rolls.length}) `.padStart(8) + thisFileOutput;
let thisFileBadCount = 0;
const uniqueErrors = new Set<string>();
for (const roll of rolls) {
  const rollError = isInvalidRoll(roll);
  if (rollError) {
    thisFileBadCount++;
    uniqueErrors.add(rollError);
  }
}
counter += thisFileBadCount;

thisFileOutput = `${thisFileBadCount ? "✘" : "✓"} ` + thisFileOutput;
if (thisFileBadCount) thisFileOutput += ` (${thisFileBadCount} errors)`;
if (uniqueErrors.size)
  thisFileOutput += ("\n" + [...uniqueErrors].join("\n")).replace(
    /\n/g,
    "\n     "
  );
console.log(thisFileOutput);
