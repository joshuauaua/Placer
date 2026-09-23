/* PLACER — User Labs page
 *
 * A photo from a lab on one side, and the pitch with a way to apply on the
 * other (see PhotoSplit). Linked from the footer's Project column.
 */

import userLabsPhoto from '../assets/user-labs.webp';
import { PhotoSplit, PhotoSplitHeading } from './PhotoSplit';

// Applications come in by email for now, to the same address ContactPage.jsx shows.
const APPLY_HREF = 'mailto:info@plcr.org?subject=User%20Labs%20application';

export function UserLabsPage({ t }) {
  return (
    <PhotoSplit
      t={t}
      src={userLabsPhoto}
      alt="A User Labs session outside an orange-red brick building: people pin notes to a map and sketch on wooden boards by a picnic table, beside a banner reading Designing Participatory Spaces."
    >
      <PhotoSplitHeading
        t={t}
        title="User Labs"
        subtitle="Help shape PLACER by testing it in the places you know."
      />
      <p style={{ marginTop: 20, fontSize: 17, lineHeight: 1.65, color: t.inkDim }}>
        User Labs are hands-on sessions where residents, designers and local leaders
        try PLACER out on real streets and squares. You sketch ideas, test early
        versions of the toolkit, and tell us what works and what does not, so what we
        build next comes from the people who will use it.
      </p>
      <a
        href={APPLY_HREF}
        className="placer-split-action"
        style={{ background: t.primaryBg, color: t.primaryFg }}
      >
        Apply
      </a>
    </PhotoSplit>
  );
}

export default UserLabsPage;
