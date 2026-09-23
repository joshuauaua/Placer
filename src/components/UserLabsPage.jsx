/* PLACER — User Labs page
 *
 * A holding page for now: the title and a line saying what is coming. Linked
 * from the footer's Project column.
 */

export function UserLabsPage({ t }) {
  return (
    // Top padding clears the fixed nav bar that floats over the page.
    <div style={{
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      background: t.page,
      padding: '120px 24px 64px',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 className="placer-disp" style={{ fontSize: 48, fontWeight: 900, letterSpacing: '-0.03em',
          lineHeight: 1.05, color: t.ink }}>
          User Labs
        </h1>
        <p style={{ marginTop: 20, fontSize: 18, lineHeight: 1.6, color: t.inkDim }}>
          More about PLACER's User Labs is coming soon.
        </p>
      </div>
    </div>
  );
}

export default UserLabsPage;
