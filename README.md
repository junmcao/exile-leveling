# Exile Leveling (fork)

A fork of [HeartofPhos/exile-leveling](https://github.com/HeartofPhos/exile-leveling), a Path of Exile leveling guide with Path of Building integration, used under its MIT license.

What this fork changes:

- A quieter look, and a focus page that shows the current step large with the next few fading out.
- Auto-progress that reads the game's `Client.txt` directly in Chrome or Edge, with the companion app as a fallback, and that catches up when areas are done in a different order than the route.
- A build guide panel with gems, passive tree and gear, all following one level range that moves along with the route.

Not affiliated with or endorsed by Grinding Gear Games. Gem icons are the property of Grinding Gear Games. They are downloaded from the [Path of Exile Wiki](https://www.poewiki.net) when the site is built and are not stored in this repository.

## Getting Started

- `npm i`
- `npm run seed tree -w seeding` (or `TREE_VERSIONS=3_29,3_30 npm run seed tree -w seeding` for just those versions)
- `node tools/seed-gem-icons.mjs` (optional, without it gems show a coloured dot)
- `npm run dev -w web`

## Seeding

### Passive Tree

- `npm run seed tree -w seeding`

### General

- Find the list of required `dat` files in `seeding/data/index.ts`
- Use https://github.com/HeartofPhos/exile-export to get required `.dat.json` files
- `npm run seed data -w seeding`

### Testing auto-progress without the game

- `node tools/fake-log-server.mjs`, then open `http://localhost:6755/area?id=<area id>` to send an area entry

## Route

The base route is kept in line with current speed running strategies, as in the original project.

Users are encouraged to use the Edit Route tab in the deployed app to update the route to their preferred playstyle.
