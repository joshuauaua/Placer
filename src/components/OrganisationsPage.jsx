/* PLACER — Organisations: every organisation this account is an admin of.
 *
 * Reached from the side nav, which only offers it once there is at least one. The
 * list itself is read once in App.jsx (it also decides whether the side nav shows the
 * tab), so this page is handed it rather than asking again. Opening one goes to its
 * dashboard.
 */

import { Btn } from './UI';
import { Icon } from './Icon';

function OrganisationCard({ t, organisation, onOpen }) {
  return (
    <button onClick={() => onOpen(organisation.id)} style={{ textAlign: 'left', padding: 20,
      background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12, boxShadow: t.shadow,
      cursor: 'pointer', fontFamily: 'var(--placer-font)', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <span style={{ width: 44, height: 44, borderRadius: 12, background: t.surfaceAlt, flex: '0 0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.ink }}>
        <Icon name="building" size={22} stroke={2} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 17, fontWeight: 700, color: t.ink, marginBottom: 4 }}>
          {organisation.name}
        </span>
        {organisation.location && (
          <span style={{ display: 'block', fontSize: 13.5, color: t.inkDim, marginBottom: 6 }}>
            {organisation.location}
          </span>
        )}
        {organisation.description && (
          <span style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {organisation.description}
          </span>
        )}
      </span>
    </button>
  );
}

export function OrganisationsPage({ t, organisations = [], onNewOrganisation, onOpenOrganisationDashboard }) {
  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: '48px 40px' }} className="placer-scroll">
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: 20, flexWrap: 'wrap', marginBottom: 40 }}>
          <div>
            <h1 className="placer-disp" style={{ fontSize: 48, fontWeight: 700, color: t.ink,
              letterSpacing: '-0.03em', marginBottom: 8 }}>
              Organisations
            </h1>
            <p style={{ fontSize: 18, color: t.inkDim, lineHeight: 1.6 }}>
              The organisations you are an admin of.
            </p>
          </div>
          {onNewOrganisation && (
            <Btn t={t} variant="primary" icon="plus" onClick={onNewOrganisation}>
              Create an organisation
            </Btn>
          )}
        </div>

        {organisations.length === 0 ? (
          <p style={{ fontSize: 14, color: t.inkFaint }}>
            You are not an admin of any organisation.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 20 }}>
            {organisations.map((organisation) => (
              <OrganisationCard key={organisation.id} t={t} organisation={organisation}
                onOpen={onOpenOrganisationDashboard} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default OrganisationsPage;
