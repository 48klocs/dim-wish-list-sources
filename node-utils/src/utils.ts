import d2manifest from "@d2api/manifest-node";
import {
  DestinyInventoryItemDefinition,
  DestinyItemSocketBlockDefinition,
  DestinyItemSocketCategoryDefinition,
} from "bungie-api-ts/destiny2";
import { WishListRoll } from "./lib/types.js";

// some settings
// if true, a roll with two magazines would be invalid
const collisionIsError = true;
// if true, a weapon with no non-sunset versions, is invalid
const sunsetIsError = false;

await d2manifest.load();
const masterworkPlugSet = d2manifest
  .getAll("DestinyPlugSetDefinition")
  .find((ps) => ps.reusablePlugItems.length === 100);
if (!masterworkPlugSet) throw "unable to find the masterworks plugset";
const masterworkPlugs = new Set(
  masterworkPlugSet.reusablePlugItems.map((pi) => pi.plugItemHash)
);

// export const uniqs = new Set<string>();

/**
 * for memory, speed, and structural simplicity,
 * this returns an empty string (falsy) if the roll is valid,
 * and an error description (truthy) if it's invalid
 */
export function isInvalidRoll(roll: WishListRoll) {
  const { itemHash, recommendedPerks, notes } = roll;
  const item = getItem(itemHash);

  if (!item)
    return `• couldn't find an item for (${itemHash}) maybe the roll notes would help:\n  ${notes}`;

  if (sunsetIsError && isSunset(itemHash))
    return `• ${nameHash(itemHash)} is sunset`;

  if (isDummy(item)) return `• ${nameHash(itemHash)} is a dummy item`;

  if (!item.sockets)
    return `• ${nameHash(itemHash)} has no sockets. is it really a weapon?`;

  for (const p of recommendedPerks)
    if (masterworkPlugs.has(p)) return `• masterwork plug detected (${p})`;

  // const uniqString = `${itemHash}--${[...recommendedPerks].sort().join()}`;
  // if (uniqs.has(uniqString)) return `• this already exists`;
  // uniqs.add(uniqString);

  const curatedError = getPerkAssignmentProblems(roll, item, "curated");
  if (!curatedError) return "";

  const randomError = getPerkAssignmentProblems(roll, item, "previous");
  if (!randomError) return "";

  const currentError = getPerkAssignmentProblems(roll, item, "current");
  if (!currentError) return "";

  // if either assignment succeeded, we're golden
  if (!curatedError || !randomError) return "";

  // otherwise, we're interested in the random roll error primarily
  return randomError || currentError || curatedError;
}

/** returns a string describing if there were problems assigning this roll's perks to this item  */
function getPerkAssignmentProblems(
  roll: WishListRoll,
  item: DestinyInventoryItemDefinition,
  perkSource: keyof PerkPossibilities
) {
  const { recommendedPerks, itemHash } = roll;
  const perkColumns = getPossiblePerkSets(item)[perkSource];
  const usedColumns = new Set<Set<number>>();

  for (const p of recommendedPerks) {
    const foundColumn = perkColumns.find((c) => c.has(p));
    if (!foundColumn) {
      const maybe = alternateSuggestion(p, item);
      let error = `• ${nameHash(itemHash)} can't roll ${nameHash(p)}`;
      if (maybe) {
        // if maybe=p, the perk exists on this item, but in a different group (curated/retired/current)
        if (maybe === p) {
          const allOtherPerks = [...recommendedPerks]
            .filter((h) => h !== p)
            .map(nameHash)
            .join(" / ");
          error += `  at the same time as these:\n   ${allOtherPerks}`;
        }
        // that perk isn't on the weapon at all, but there's a same-named one. someone picked a wrong hash
        else error += `. did you mean ${maybe}?`;
      }
      return error;
    }

    if (usedColumns.has(foundColumn)) {
      const info = collisionInfo(roll, item, perkSource);

      let err = `• multiple perks in same column on ${nameHash(
        itemHash
      )}:\n  ${info}`;

      if (collisionIsError) return err;
    }
    // this column is now "used up"
    usedColumns.add(foundColumn);
  }
  return "";
}

function collisionInfo(
  { recommendedPerks }: WishListRoll,
  item: DestinyInventoryItemDefinition,
  perkSource: keyof PerkPossibilities
) {
  const perkColumns = getPossiblePerkSets(item)[perkSource];
  const perkLocations: NodeJS.Dict<number> = {};
  for (const p of recommendedPerks) {
    const foundColumn = perkColumns.findIndex((c) => c.has(p));

    if (foundColumn !== -1) {
      const existing = perkLocations[foundColumn];
      if (existing !== undefined)
        return `${nameHash(p)} and ${nameHash(existing)}`;
      else perkLocations[foundColumn] = p;
    }
  }
}
/**
 * given a badPerkHash that *can't* be rolled on the parentItem,
 * looks for an alternate perk with the same name
 */
function alternateSuggestion(
  badPerkHash: number,
  parentItem: DestinyInventoryItemDefinition
) {
  const perkName = getName(badPerkHash) ?? getPerkName(badPerkHash);
  if (!perkName) return;
  const possibleHashes = allPerkHashes(parentItem);
  return possibleHashes.find(
    (h) => getItem(h)?.displayProperties.name === perkName
  );
}

/** just a big old list of every perk hash on the item */
function allPerkHashes(item: DestinyInventoryItemDefinition) {
  return Object.values(getPossiblePerkSets(item)).flatMap((pcs) =>
    pcs.flatMap((pc) => [...pc])
  );
}

/**
 * gets only the mag/barrel/perk/etc socket defs, from an item def
 */
function getPerkSockets({
  socketCategories,
  socketEntries,
}: DestinyItemSocketBlockDefinition) {
  const socketsIndexesOfInterest =
    socketCategories
      .filter(isWishlistSocket)
      ?.flatMap((se) => se.socketIndexes) ?? [];
  return socketsIndexesOfInterest.map((i) => socketEntries[i]);
}

const perkColumnsCache: NodeJS.Dict<PerkPossibilities> = {};

// this just keeps getting messier. ok so for items that have been reissued,
// we formulate a guess about what the previous perks were.
// that's retired perks, plus current,
// but not current perks in a column that are retired in another column.
// this is definitely innaccurate, but it's that or load up a hundred historical manifests
function getPossiblePerkSets(item: DestinyInventoryItemDefinition) {
  const { hash, displayProperties, sockets } = item;
  const cached = perkColumnsCache[hash];
  if (cached) return cached;

  if (!sockets)
    throw `no sockets on ${hash} ${displayProperties.name}. does this belong here?`;

  const curated = [];
  const previous = [];
  const current = [];
  const allColumnsRetiredPerks = new Set<number>();
  const perkSockets = getPerkSockets(sockets);

  for (const {
    singleInitialItemHash,
    reusablePlugItems,
    randomizedPlugSetHash,
    reusablePlugSetHash,
  } of perkSockets) {
    //gather curated perks
    const thisSocketCurated = new Set<number>();

    if (singleInitialItemHash) thisSocketCurated.add(singleInitialItemHash);

    for (const r of reusablePlugItems) thisSocketCurated.add(r.plugItemHash);
    if (reusablePlugSetHash) {
      const reusables = getPlugSet(reusablePlugSetHash)?.reusablePlugItems;
      if (reusables)
        for (const ps of reusables) thisSocketCurated.add(ps.plugItemHash);
    }

    const thisSocketPrevious = new Set<number>();
    // only the random sockets that can currently roll
    const thisSocketCurrent = new Set<number>();

    // gather random perks
    if (randomizedPlugSetHash) {
      const randoms = getPlugSet(randomizedPlugSetHash)?.reusablePlugItems;
      if (randoms)
        for (const ps of randoms) {
          if (ps.currentlyCanRoll) thisSocketCurrent.add(ps.plugItemHash);
          else {
            thisSocketPrevious.add(ps.plugItemHash);
            allColumnsRetiredPerks.add(ps.plugItemHash);
          }
        }
    }

    curated.push(thisSocketCurated);
    // if there was no random stuff at all for this socket, fall back to curated
    previous.push(
      thisSocketPrevious.size ? thisSocketPrevious : thisSocketCurated
    );
    current.push(
      thisSocketCurrent.size ? thisSocketCurrent : thisSocketCurated
    );
  }

  // at this point, previous only contains retired perks.
  // now we fill in the rest of the random perks while avoiding ones that swapped columns
  for (const i in previous) {
    const thisColPrev = previous[i];
    const thisColCurr = current[i];
    for (const hash of thisColCurr)
      if (!allColumnsRetiredPerks.has(hash)) thisColPrev.add(hash);
  }

  const results = { curated, previous, current };
  perkColumnsCache[hash] = results;
  return results;
}

function isWishlistSocket({
  socketCategoryHash,
}: DestinyItemSocketCategoryDefinition) {
  return socketCategoryHash === 4241085061 || socketCategoryHash === 3956125808;
}

export function isDummy(item: DestinyInventoryItemDefinition) {
  return item?.itemCategoryHashes?.includes(3109687656); // ItemCategory [3109687656] "Dummies"
}
export function getItem(hash: number) {
  return d2manifest.get("DestinyInventoryItemDefinition", hash);
}
export function getName(hash: number) {
  return getItem(hash)?.displayProperties.name;
}
export function getPerkName(hash: number) {
  return d2manifest.get("DestinySandboxPerkDefinition", hash)?.displayProperties
    .name;
}
export function getPlugSet(hash: number) {
  return d2manifest.get("DestinyPlugSetDefinition", hash);
}

type PerkPossibilities = Record<
  "curated" | "previous" | "current",
  PerkColumns
>;
type PerkColumns = Set<number>[];

function nameHash(hash: number) {
  return `${getName(hash)} (${hash})`;
}

export function isSunset(itemHash: number) {
  const powerCap = d2manifest.get(
    "DestinyPowerCapDefinition",
    getItem(itemHash)?.quality?.versions.slice(-1)[0].powerCapHash
  )?.powerCap;
  return powerCap !== undefined && powerCap < 1310;
}
