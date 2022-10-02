import fs from "fs";
import { toWishList } from "./lib/wishlist-file.js";
import { isInvalidRoll } from "./utils.js";
import fetch from "cross-fetch";

let counter = 0;

const txtDirectories = [
  "Mercules904",
  "PandaPaxxy",
  "AyyItsChevy",
  "blueberries-dot-gg",
  "YeezyGT",
  "misc",
];

const txtFilePaths = txtDirectories.flatMap((dirName) =>
  fs
    .readdirSync("../" + dirName)
    .filter((fileName) => fileName.endsWith(".txt"))
    .map((fileName) => "../" + dirName + "/" + fileName)
);

const remoteTxts = [
  "https://raw.githubusercontent.com/Butlins12/destiny-rolls/main/DMB-inspired-rolls.txt",
  "https://raw.githubusercontent.com/Butlins12/destiny-rolls/main/S15-IB-new-rolls-DMB-ep230.txt",
];

for (const path of [...txtFilePaths, ...remoteTxts]) {
  const plainText = path.startsWith("http")
    ? await (await fetch(path)).text()
    : fs.readFileSync(path, "utf-8");

  let thisFileOutput = path.split("/").slice(-1)[0];

  const rolls = toWishList(plainText).wishListRolls;
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
  if (uniqueErrors.size)
    thisFileOutput += ("\n" + [...uniqueErrors].join("\n")).replace(
      /\n/g,
      "\n          "
    );
  console.log(thisFileOutput);
}
