# Form — measurement on a named device

Blank. One copy for each target and device. A filled copy is kept in the owner's local data
(`medical_thoracoscopy/gate/`) until its numbers are entered in the performance table
(`../../registers/performance-table.json`), where a result is recorded only with every field below.

A target is met only by a measurement on the hardware it names, with the browser, viewport,
quality, network and cache recorded. Desktop emulation of a phone or tablet is not a measurement on
that device, and a measurement on another computer is not a measurement on the one the target
names.

| Field                                                       | Entry |
| ----------------------------------------------------------- | ----- |
| Target (PT-1 to PT-5)                                       |       |
| Date, and who ran it                                        |       |
| Device model                                                |       |
| Operating system and version                                |       |
| Browser and version                                         |       |
| Graphics renderer, as the browser reports it                |       |
| Viewport and device pixel ratio                             |       |
| Quality setting                                             |       |
| Network profile and cache state, for the loading targets    |       |
| Commit                                                      |       |
| Anatomy manifest sha256                                     |       |
| Scene and input sequence (below, or what was done instead)  |       |
| Frame times: median, 95th and 99th percentile, and duration |       |
| Startup and decode time, and memory after load              |       |
| Result against the target: MET or NOT MET                   |       |
| Anything that went differently                              |       |

## The scene and input sequence

The same on every device, so that results compare:

1. Open `/medical-thoracoscopy/prototype/space` on a production build of the commit being
   measured, not the development server.
2. Wait until the controls of the model are ready and both views are drawn.
3. Scroll until the Scope view is wholly in the window.
4. Hold "Turn clockwise" for five seconds; both views redraw on every step.
5. For the loading targets, start from an empty cache, then load again with the cache warm.

## How to take it

- **Where the machine runs Playwright** (a laptop): build and start the site on that machine
  (`npm run build`, then `npm run start`), then run
  `MT_BASE_URL=http://localhost:<port> npx playwright test -c playwright.medical-thoracoscopy.config.ts -g "measurements"`,
  headed (`--headed`) so the browser draws with the machine's own graphics. It writes
  `test-results/medical-thoracoscopy/measurements.json` with every field but the result.
- **Where it does not** (an iPad): open the page in Safari, connect Web Inspector from a Mac, record
  a Timelines session while holding the control, and read the frame rate and the frame times from
  it.
