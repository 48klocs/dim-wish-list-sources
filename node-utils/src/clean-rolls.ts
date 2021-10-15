import d2manifest from "@d2api/manifest-node";
// import { WishListRoll } from "./lib/types.js";
import { toDimWishListRoll } from "./lib/wishlist-file.js";
import fs from "fs";
// import fsa from "fs/promises";
import readline from "readline";
// import { toWishList } from "./lib/wishlist-file.js";
// import { DestinyInventoryItemDefinition } from "bungie-api-ts/destiny2";
import { isInvalidRoll } from "./utils.js";

export const verboseMain = true;
await d2manifest.load();

[
  "Mercules904",
  "PandaPaxxy",
  "AyyItsChevy",
  "blueberries-dot-gg",
  "YeezyGT",
  // "misc",
].forEach(async (dirName) =>
  fs.readdirSync("../" + dirName).forEach(async (fileName) => {
    if (!fileName.includes(".txt") || fileName.includes("-clean.txt")) {
      return;
    }

    verboseMain && console.log(`\nloading ${fileName}`);

    const sourceFileName = "../" + dirName + "/" + fileName;
    const sourceFileStream = fs.createReadStream(sourceFileName);

    const cleanFileName = sourceFileName.replace(".txt", "-clean.txt");
    const cleanFileStream = fs.createWriteStream(
      "../" + dirName + "/" + cleanFileName,
      { flags: "a" }
    );

    const rl = readline.createInterface({
      input: sourceFileStream,
      // Note: we use the crlfDelay option to recognize all instances of CR LF
      // ('\r\n') in input.txt as a single line break.
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      // Each line in input.txt will be successively available here as `line`.
      if (line.includes("dimwishlist:")) {
        const dimWishListRoll = toDimWishListRoll(line);
        if (dimWishListRoll && isInvalidRoll(dimWishListRoll)) {
          cleanFileStream.write(line + "\n");
        }
      } else {
        cleanFileStream.write(line + "\n");
      }
    }

    sourceFileStream.destroy();
    cleanFileStream.end();

    fs.rename(cleanFileName, sourceFileName, (err) => {
      if (err) throw err;
    });
  })
);
