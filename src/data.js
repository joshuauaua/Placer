/* PLACER — the things Idea Visualizer can place into a view */

import benchIcon from './assets/imagination/bench.png';
import planterBoxIcon from './assets/imagination/planter-box.png';
import planterPotIcon from './assets/imagination/planter-pot.png';
import bikeIcon from './assets/imagination/bike.png';
import trafficLightIcon from './assets/imagination/traffic-light.png';
import bollardIcon from './assets/imagination/bollard.png';
import barrierIcon from './assets/imagination/barrier.png';
import streetTreeIcon from './assets/imagination/street-tree.svg';
import flowerBedIcon from './assets/imagination/flower-bed.svg';
import picnicTableIcon from './assets/imagination/picnic-table.svg';
import shelterIcon from './assets/imagination/shelter.svg';
import binIcon from './assets/imagination/bin.svg';
import streetLampIcon from './assets/imagination/street-lamp.svg';
import fountainIcon from './assets/imagination/fountain.svg';
import parasolIcon from './assets/imagination/parasol.svg';
import marketStallIcon from './assets/imagination/market-stall.svg';
import sculptureIcon from './assets/imagination/sculpture.svg';
import slideIcon from './assets/imagination/slide.svg';

// An asset is recorded by its `type` (lib/ideaVisualizer.js), so a type, once out,
// is never renamed: its label and picture can change, the type cannot. In the order
// the library shows them, grouped by category (theme.js's CAT).
export const ASSET_LIB = [
  { type: 'tree',         label: 'Planter',       cat: 'green',   icon: planterPotIcon },
  { type: 'planter',      label: 'Planter box',   cat: 'green',   icon: planterBoxIcon },
  { type: 'street-tree',  label: 'Tree',          cat: 'green',   icon: streetTreeIcon },
  { type: 'flower-bed',   label: 'Flower bed',    cat: 'green',   icon: flowerBedIcon },
  { type: 'bench',        label: 'Bench',         cat: 'seating', icon: benchIcon },
  { type: 'picnic-table', label: 'Picnic table',  cat: 'seating', icon: picnicTableIcon },
  { type: 'shelter',      label: 'Shelter',       cat: 'seating', icon: shelterIcon },
  { type: 'bike',         label: 'Bike',          cat: 'seating', icon: bikeIcon },
  { type: 'bin',          label: 'Bin',           cat: 'seating', icon: binIcon },
  { type: 'play',         label: 'Slide',         cat: 'play',    icon: slideIcon },
  { type: 'fountain',     label: 'Water fountain', cat: 'play',   icon: fountainIcon },
  { type: 'sculpture',    label: 'Sculpture',     cat: 'art',     icon: sculptureIcon },
  { type: 'market-stall', label: 'Market stall',  cat: 'food',    icon: marketStallIcon },
  { type: 'parasol',      label: 'Café table',    cat: 'food',    icon: parasolIcon },
  { type: 'street-lamp',  label: 'Street lamp',   cat: 'safety',  icon: streetLampIcon },
  { type: 'light',        label: 'Traffic light', cat: 'safety',  icon: trafficLightIcon },
  { type: 'bollard',      label: 'Bollard',       cat: 'safety',  icon: bollardIcon },
  { type: 'barrier',      label: 'Barrier',       cat: 'safety',  icon: barrierIcon },
];
