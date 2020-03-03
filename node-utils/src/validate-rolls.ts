import D2Manifest from "destiny2-manifest";
import { WishListRoll } from "./lib/types";
import fs from "fs";
import { toWishList } from "./lib/wishlist-file";
const manifest = new D2Manifest("asdf");

(async () => {
  let counter = 0;
  await manifest.load();
  ["Mercules904", "PandaPaxxy" /*, "misc"*/].forEach(dirName => {
    fs.readdirSync("../" + dirName).forEach(fileName => {
      console.log(`bad wishlist lines so far: ${counter}`);
      console.log(`loading ${fileName}`);
      const badIndexes = getInvalidWishlistRolls(
        manifest,
        toWishList(
          fs.readFileSync("../" + dirName + "/" + fileName, {
            encoding: "UTF-8"
          })
        ).wishListRolls
      );
      console.log(`ran ${badIndexes.length} rolls`);
      console.log(`${badIndexes.filter(i => i !== false).length} bad rolls`);

      counter += badIndexes.filter(i => i !== false).length;
      console.log(`bad wishlist lines so far: ${counter}`);
    });
  });
})();

// given an array of [valid roll, invalid roll, valid roll, invalid roll]
// returns           [false,      1,            false,      3           ]
// so i guess you have an array of the indices of invalid rolls
function getInvalidWishlistRolls(manifest: D2Manifest, rolls: WishListRoll[]) {
  console.log(`about to check ${rolls.length} rolls`);
  return rolls.map((roll, index) => {
    const perksOnThisRoll = [...roll.recommendedPerks];
    const rollItem = manifest.get(
      "DestinyInventoryItemDefinition",
      roll.itemHash
    );
    if (!rollItem) {
      console.log(`!!! couldn't find an item for ${rollItem} !!!`);
      return;
    }
    const itemName = rollItem.displayProperties.name;
    const perksThisGunCanActuallyHave = (rollItem.sockets.socketEntries
      .flatMap(se => {
        const hashesInPlugsets = ([
          "randomizedPlugSetHash",
          "reusablePlugSetHash"
        ] as (
          | "randomizedPlugSetHash" //reusablePlugItems
          | "reusablePlugSetHash"
        )[]).flatMap(key =>
          manifest
            .get("DestinyPlugSetDefinition", se[key])
            ?.reusablePlugItems?.map(p => p.plugItemHash)
        );
        const reusablePlugItemHashes = se.reusablePlugItems.map(
          pi => pi.plugItemHash
        );
        return [...hashesInPlugsets, ...reusablePlugItemHashes];
      })
      .filter(Boolean) ?? []) as number[];
    const allPerksAreValid = perksOnThisRoll.every(p =>
      perksThisGunCanActuallyHave.includes(p)
    );
    if (allPerksAreValid) {
      // console.log("that was a valid roll for " + itemName);
      return false;
    }
    console.log("something is wrong with " + itemName + ":");
    perksOnThisRoll.forEach(p => {
      if (perksThisGunCanActuallyHave.includes(p)) return;

      const cantExistPerkName = manifest.get(
        "DestinyInventoryItemDefinition",
        p
      )?.displayProperties.name;
      const maybeMeant = perksThisGunCanActuallyHave
        .filter(a => a !== p)
        .find(
          a =>
            manifest.get("DestinyInventoryItemDefinition", a)?.displayProperties
              .name === cantExistPerkName
        );
      console.log(
        `${cantExistPerkName} (${p}) cant exist on ${itemName} (${roll.itemHash})` +
          (!maybeMeant
            ? ""
            : `\nmaybe you meant rollable perk ${cantExistPerkName} (${maybeMeant})`)
      );
    });

    return index;
  });
}
