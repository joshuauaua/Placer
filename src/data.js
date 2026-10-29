/* PLACER — the things Idea Visualizer can place into a view */

import benchIcon from './assets/imagination/bench.png';
import planterBoxIcon from './assets/imagination/planter-box.png';
import planterPotIcon from './assets/imagination/planter-pot.png';
import bikeIcon from './assets/imagination/bike.png';
import trafficLightIcon from './assets/imagination/traffic-light.png';
import bollardIcon from './assets/imagination/bollard.png';
import barrierIcon from './assets/imagination/barrier.png';

export const ASSET_LIB = [
  { type: 'bench',   label: 'Bench',      cat: 'seating', icon: benchIcon },
  { type: 'planter', label: 'Planter',    cat: 'green',   icon: planterBoxIcon },
  { type: 'tree',    label: 'Tree',       cat: 'green',   icon: planterPotIcon },
  { type: 'bike',    label: 'Bike rack',  cat: 'seating', icon: bikeIcon },
  { type: 'light',   label: 'Lighting',   cat: 'safety',  icon: trafficLightIcon },
  { type: 'bollard', label: 'Bollard',    cat: 'safety',  icon: bollardIcon },
  { type: 'barrier', label: 'Barrier',    cat: 'safety',  icon: barrierIcon },
  { type: 'play',    label: 'Play',       cat: 'play' },
];
