import d2manifest from "@d2api/manifest-node";
import { WishListRoll } from "./lib/types.js";
import { toDimWishListRoll } from "./lib/wishlist-file.js";
import fs from "fs";
import readline from "readline";
import { DestinyInventoryItemDefinition } from "bungie-api-ts/destiny2";

const verboseMain = true;
const placesToLookForValidPerks: (
  | "randomizedPlugSetHash"
  | "reusablePlugSetHash"
)[] = ["randomizedPlugSetHash", "reusablePlugSetHash"];

(async () => {
  await d2manifest.load();
  [
    "Mercules904",
    "PandaPaxxy",
    "AyyItsChevy",
    "blueberries-dot-gg",
    "YeezyGT",
    "misc",
    "RNGeez",
  ].forEach((dirName) => {
    fs.readdirSync("../" + dirName).forEach(async (fileName) => {
      if (!fileName.includes(".txt") || fileName.includes("-clean.txt")) {
        return;
      }

      verboseMain && console.log(`\nloading ${fileName}`);

      const sourceFileName = "../" + dirName + "/" + fileName;
      const fileStream = fs.createReadStream(sourceFileName);

      const cleanFileName = sourceFileName.replace(".txt", "-clean.txt");
      const cleanFileStream = fs.createWriteStream(
        "../" + dirName + "/" + cleanFileName,
        {
          flags: "a",
        }
      );

      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });
      // Note: we use the crlfDelay option to recognize all instances of CR LF
      // ('\r\n') in input.txt as a single line break.

      for await (const line of rl) {
        // Each line in input.txt will be successively available here as `line`.
        if (line.includes("dimwishlist:")) {
          const dimWishListRoll = toDimWishListRoll(line);
          if (isValidWishListRoll(dimWishListRoll)) {
            cleanFileStream.write(line + "\n");
          }
        } else {
          cleanFileStream.write(line + "\n");
        }
      }

      fileStream.destroy();
      cleanFileStream.end();

      fs.rename(cleanFileName, sourceFileName, (err) => {
        if (err) throw err;
      });
    });
  });
})();

// given an array of [valid roll, invalid roll, valid roll, invalid roll]
// returns           [false,      1,            false,      3           ]
// so i guess you have an array of the indices of invalid rolls
function isValidWishListRoll(roll: WishListRoll | null, verbose = false) {
  if (!roll) {
    return false;
  }

  const perksOnThisRoll = [...roll.recommendedPerks];
  const rollItem = getItem(roll.itemHash);

  if (!rollItem) {
    return false;
  }

  const itemName = rollItem.displayProperties.name;
  if (isDummy(rollItem)) {
    return false;
  }

  const perksThisGunCanActuallyHave = (rollItem.sockets?.socketEntries
    .reduce((acc, se) => {
      const hashesInPlugsets = placesToLookForValidPerks.reduce(
        (inneracc, key) =>
          inneracc.concat(
            getPlugSet(se[key] ?? -99999999)?.reusablePlugItems?.map(
              (p) => p.plugItemHash
            )
          ),
        [] as (number | undefined)[]
      );
      const reusablePlugItemHashes = se.reusablePlugItems.map(
        (pi) => pi.plugItemHash
      );
      return acc.concat([...hashesInPlugsets, ...reusablePlugItemHashes]);
    }, [] as (number | undefined)[])
    .filter(Boolean) ?? []) as number[];
  return perksOnThisRoll.every((p) => perksThisGunCanActuallyHave.includes(p));
}

// ItemCategory [3109687656] "Dummies"
function isDummy(item: DestinyInventoryItemDefinition) {
  return item?.itemCategoryHashes?.includes(3109687656);
}
function getItem(hash: number) {
  return d2manifest.get("DestinyInventoryItemDefinition", hash);
}
function getPlugSet(hash: number) {
  return d2manifest.get("DestinyPlugSetDefinition", hash);
}
