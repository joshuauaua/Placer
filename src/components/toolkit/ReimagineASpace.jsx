/* PLACER — Toolkit: Idea Visualizer.
 *
 * The imagination flow as a tool: pick a spot on the map, place benches, trees and the
 * rest into its Street View, describe the idea and post it. That flow is App's, not
 * this component's — it runs full-bleed and keeps its draft across steps and across a
 * sign-in redirect — so the registry entry is marked `launch`, and the cover's Get
 * started hands over to it (ToolkitPage's onLaunchTool) instead of mounting this.
 *
 * This is what shows where nothing has taken that hand-over: a way to start, so the
 * tool is never a dead end.
 */

import { Panel } from '../ToolLayout';
import { Btn } from '../UI';

export function ReimagineASpace({ t, tool, onLaunch }) {
  return (
    <Panel t={t} title="How it works">
      <ol style={{ margin: '0 0 20px', paddingLeft: 20, fontSize: 15, color: t.ink, lineHeight: 1.7 }}>
        <li>Pick a spot on the map and open it in Street View.</li>
        <li>Place benches, trees, lighting and more into the view.</li>
        <li>Say what the idea is and why, and post it for others to see.</li>
      </ol>
      {onLaunch && (
        <Btn t={t} variant="character" tone={tool} icon="pin" onClick={onLaunch}>
          Choose a spot on the map
        </Btn>
      )}
    </Panel>
  );
}

export default ReimagineASpace;
