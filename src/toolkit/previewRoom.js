/* PLACER — a room that is not open, carrying a setup.
 *
 * What a tool that runs in a room is given where there is no room to run in: the
 * configuration page's canvas (ToolConfiguratorPage) and its Preview (ToolPreviewFrame).
 * The tool sees `config` as a room's setup and nothing else happening.
 */

export function previewRoom(config) {
  return {
    capable: false,
    status: 'none',
    error: null,
    roomId: null,
    pin: null,
    joinCode: null,
    expiresAt: null,
    opensAt: null,
    config,
    isHost: false,
    contributions: [],
    participantCount: 0,
    combined: null,
    publish: () => {},
    close: () => {},
    remove: () => {},
  };
}
