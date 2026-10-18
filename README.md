# Haunted Files

Demons are possessing the files on your desktop. You grab the possessed files with your bare hands through the webcam and drop them into a bubbling cauldron, which blows the demon out in a burst of green fire. Gemma 4 looks at you through the camera to name each demon, taunt you and judge you at the end of every level.

![Screenshot placeholder](docs/screenshot.png)

## How to play

| Gesture | What it does |
|---|---|
| Pinch (thumb and index together) | Grab and drag a file or a window title bar. Pinch a button to press it. |
| Release the pinch | Drop into the cauldron, a folder, a window or anywhere on the desktop |
| Open palm, held 0.6 s | Open a folder or file, skip the mage's line |
| Thumbs up, held 1 s | Start the next level (or retry after a loss) |
| Peace sign, held 1.2 s | Pause or resume |
| Open your mouth for 1 s | Banshee scream: every infection drops by 10 (20 s cooldown) |

The loop:

1. A demon flies in and lands on a file. The file shakes, glows green and cracks as its corruption rises.
2. Pinch the file and drop it into the cauldron before it hits 100% and turns into a tombstone. Past 60% it starts spreading a tendril to the nearest file.
3. The cauldron explodes in green fire, the screen shakes and the demon flies out screaming. **BANISHED!**
4. Clear every demon and the level-up screen appears. Hold a thumbs up for one second to go on.

Levels get harder in three ways: more files and demons, faster corruption, and from level 2 on, possessed files **hop** to a new spot if you leave them alone (hovering over a file holds it still). Level 3 is a **boss fight**: the Mimic King possesses `MIMIC.exe`, jumps back out of the cauldron twice and only goes down on the third drop. If he turns to stone, you lose the level. Every third level after that has a boss.

Morwen the Mage walks you through a tutorial, calls out what is happening and tracks every monster you meet in her bestiary. The art is Kenney's Tiny Dungeon pixel pack, with lightning, drifting fog, flickering torches and a spark trail behind your hand.

No camera? The whole game works with a mouse: left drag is a pinch, hold P for an open palm, T for a thumbs up and V for the peace sign.

## How Gemma 4 is used

Gemma 4 runs through the Gemini API, and only on single webcam snapshots, never on video frames. Hand and face tracking need about 30 updates a second, so a language model is the wrong tool for that. Gemma reacts to moments instead:

- **Possession.** When a demon lands in a file, the app sends Gemma a mirrored 384x288 snapshot and the file name. Gemma replies with a demon name (often a pun on the file) and a taunt that mentions something it can actually see, like your hoodie or the lamp behind you.
- **Level judgment.** When you clear a level, Gemma gets a snapshot and your stats (banished, lost, how often demons hopped away, fastest save, boss beaten) and gives you a witch rank and a verdict, shown on the level-up screen.

The game never waits for Gemma. A demon starts as "???" and its name fills in when the answer arrives. With no key, or if a call fails, the app uses pre-written lines and shows a "backup scrolls" badge.

The prompts live in [`js/gemma.js`](js/gemma.js).

## Open-source stack

- **Gemma 4** (open weights) for demon names, taunts and judgments
- **MediaPipe Tasks Vision** (Apache 2.0) for hand landmarks, gesture labels and face blendshapes, running fully in the browser
- **Kenney Tiny Dungeon** (CC0) for the monsters, the mage, chests, graves and the dungeon background
- Plain HTML, CSS and JavaScript modules, with no build step and no dependencies to install

The gesture layer is also packaged as an Agent Skill in [`skill/SKILL.md`](skill/SKILL.md) so other projects can reuse it.

## Run locally

```bash
python3 -m http.server 8000
```

Open http://localhost:8000 in Chrome. The camera only works on `localhost` or over HTTPS.

To turn on Gemma, click **Settings**, paste a Gemini API key from Google AI Studio, click **Find Gemma models** and save. The key is stored only in your browser's localStorage and is sent only to Google's Gemini API.

## Deploy on DigitalOcean

**App Platform (easiest):** create an app from this GitHub repo, choose a **Static Site** component, leave the build command empty and set the output directory to `/`. App Platform serves it over HTTPS, so the camera works.

**Droplet:** on an Ubuntu droplet with a domain pointed at it, install Caddy and run:

```bash
caddy file-server --root /var/www/haunted-files --domain yourdomain.com
```

Caddy gets the HTTPS certificate automatically.

## Project layout

```
index.html        app shell, start screen, level-up screen, settings, mage panel
css/style.css     dungeon theme, desktop, infection effects, mage, cursor
assets/kenney/    Tiny Dungeon tiles and the generated dungeon background
js/main.js        boot, main loop, gesture dispatch, lightning, cauldron bubbles
js/tracker.js     MediaPipe hand + face tracking
js/input.js       hand-or-mouse pointer, pinch math, gesture debounce
js/assets.js      one config for all art, with SVG fallbacks
js/fs.js          in-memory file system
js/desktop.js     files, windows, drag and drop, cauldron
js/infection.js   possession, corruption, spread, hopping, boss, banish blast
js/levels.js      level table, tutorial, boss spawn, level-up screen, mage lines
js/mage.js        speech queue, task box, bestiary
js/gemma.js       Gemini API client, snapshots, prompts, fallbacks
js/fx.js          particles, rings, lightning, flashes, screen shake
```

## Credits

See [CREDITS.md](CREDITS.md).

## License

The code is MIT licensed (see [LICENSE](LICENSE)). Third-party assets keep their own licenses, listed in CREDITS.md.
