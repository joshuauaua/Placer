/* PLACER — one tool's slide on its own, for the Preview of the configuration page.
 *
 * ToolConfiguratorPage's Preview loads /toolkit/<id>/preview-frame into two frames, one
 * the width of a desktop and one of a phone, so the tool lays itself out as it would on
 * each — its media queries answer to the frame, which a box on the page could not make
 * them do. The slide it shows is handed over through the opening page, on
 * `window.parent[PREVIEW_KEY]`: the same site, so the frame can read it. Opened any other
 * way, it shows the tool with its defaults.
 *
 * Like the canvas it is a preview and nothing more: the tool is inert, so nothing in it
 * can be clicked, typed in or reached, while the frame itself still scrolls.
 */

import { Component } from 'react';
import { useLocation } from 'wouter';
import { findTool } from '../toolkit/tools';
import { previewRoom } from '../toolkit/previewRoom';

/** Where the configuration page leaves the slide for the frames to read. */
export const PREVIEW_KEY = '__placerToolPreview';

/** The tool id in /toolkit/<id>/preview-frame. */
function toolIdFrom(path) {
  const match = /^\/toolkit\/([^/?#]+)\/preview-frame/.exec(path);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** The slide handed over by the page that opened this frame, if it is for this tool. */
function handedOver(toolId) {
  try {
    const shared = window.parent?.[PREVIEW_KEY];
    return shared?.toolId === toolId ? shared.setup ?? null : null;
  } catch {
    return null; // Not the same site: nothing to read.
  }
}

// A setup the tool cannot draw leaves a line rather than an empty frame.
class Boundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <p style={{ padding: 24 }}>This tool could not be shown with this setup.</p>;
    return this.props.children;
  }
}

export function ToolPreviewFrame({ t }) {
  const [location] = useLocation();
  const tool = findTool(toolIdFrom(location));
  const Tool = tool?.component;
  if (!Tool) return <p style={{ padding: 24 }}>There is no tool here to preview.</p>;

  const setup = handedOver(tool.id) ?? tool.setup?.defaults() ?? null;
  return (
    // The scroller itself, as the app's #root does not scroll (index.css). The tool in
    // it is inert, so a wheel or a swipe over it scrolls this instead.
    <div style={{ height: '100vh', overflowY: 'auto', background: t.page, color: t.ink, padding: 20,
      boxSizing: 'border-box' }}>
      {/* A preview only. The page around it still scrolls. */}
      <div inert aria-label="Preview of the slide" style={{ cursor: 'default', userSelect: 'none' }}>
        <Boundary>
          {tool.room
            ? <Tool t={t} tool={tool} room={previewRoom(setup)} />
            : <Tool t={t} tool={tool} setup={setup} />}
        </Boundary>
      </div>
    </div>
  );
}

export default ToolPreviewFrame;
