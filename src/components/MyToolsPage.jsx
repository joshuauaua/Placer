/* PLACER — My Tools, at /my-tools: every tool this account has started, as a page.
 *
 * The side nav's My Tools, and the dashboard row's View all. The same cards as the
 * dashboard's My Tools (MyTools.jsx) — the most recently changed first — but all of
 * them, in a grid rather than one row, with the dashed Create a tool card after them.
 * `onOpen(toolId, id)` opens one on its configuration page; `onCreateTool(category)`
 * goes on to Create a tool's list of that kind. Each card's bin deletes it, as on the
 * dashboard.
 */

import { AddToolCard, StartedToolCard, useStartedTools } from './MyTools';

export function MyToolsPage({ t, accountId = null, onOpen, onCreateTool }) {
  const [started, remove] = useStartedTools(accountId);
  const count = started.length;

  return (
    <div className="placer-scroll" style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: '96px 40px 48px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h1 className="placer-disp" style={{ fontSize: 48, fontWeight: 700, color: t.ink,
          letterSpacing: '-0.03em', lineHeight: 1.15, margin: '0 0 8px' }}>
          My Tools
        </h1>
        <p style={{ fontSize: 16, color: t.inkDim, margin: '0 0 32px' }}>
          {count === 0
            ? 'Nothing started yet. Create a tool to begin.'
            : `${count} ${count === 1 ? 'tool' : 'tools'} you have started, the most recently changed first.`}
        </p>
        <ul aria-label="My Tools" className="placer-template-grid">
          {started.map(({ entry, tool }) => (
            <StartedToolCard key={entry.id} started={entry} tool={tool} onOpen={onOpen} onDelete={remove} />
          ))}
          <AddToolCard onCreateTool={onCreateTool} />
        </ul>
      </div>
    </div>
  );
}

export default MyToolsPage;
