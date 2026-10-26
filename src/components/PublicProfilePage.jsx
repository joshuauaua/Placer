/* PLACER — somebody's public profile, at /people/<account id>.
 *
 * Centred at the top: the profile photo, the name, when they joined, where they are,
 * how many follow them and how many things they follow (each opening its list), and
 * a Follow button. Then three tabs: About (the bio, and the email, website and
 * organisations they chose to share), Projects (the ones they own or collaborate on)
 * and Activity (what they have said on projects, and, on your own profile only, the
 * inquiries you have kept from the Toolkit above it). Needs no session, the same as a
 * project's public page — a profile link is something to share.
 *
 * The profile comes from profile_public() (supabase/profiles-public.sql), because the
 * profiles table itself is readable only by its owner; the joined date and projects
 * from profile_public_activity() (supabase/profile-activity.sql).
 */

import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Avatar, PageLoader } from './UI';
import { FollowButton } from './FollowButton';
import { FollowListDialog } from './FollowListDialog';
import { ProjectCard } from './ProjectCard';
import { SavedInquiries } from './SavedInquiries';
import { isSupabaseConfigured, readPublicProfile } from '../services/auth';
import { readFollowCounts } from '../services/follows';
import { readProfileOrganisations } from '../services/organisations';
import { readProfileActivity, readProfileComments } from '../services/profileActivity';

const TABS = [
  { id: 'about', label: 'About' },
  { id: 'projects', label: 'Projects' },
  { id: 'activity', label: 'Activity' },
];

const JOINED_FORMAT = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const POSTED_FORMAT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function formatted(format, iso) {
  const date = new Date(iso ?? '');
  return Number.isNaN(date.getTime()) ? '' : format.format(date);
}

export function PublicProfilePage({ t, userId, accountId = null, onOpen }) {
  const [person, setPerson] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'notFound' | 'error'
  // Extras beside the profile itself: each is null until loaded, and stays null if it
  // could not be — the page stands without them.
  const [counts, setCounts] = useState(null);
  const [organisations, setOrganisations] = useState(null);
  // When they joined and their projects, and their comments: each { status, ... }.
  const [activity, setActivity] = useState({ status: 'loading', joinedAt: null, projects: [] });
  const [comments, setComments] = useState({ status: 'loading', list: [] });
  // Which list is open over the page: 'followers', 'following', or null.
  const [listOpen, setListOpen] = useState(null);
  const [tab, setTab] = useState('about');

  useEffect(() => {
    // No Supabase project, no accounts — and so nobody to have a profile.
    if (!isSupabaseConfigured()) {
      setStatus('notFound');
      return undefined;
    }

    let cancelled = false;
    setStatus('loading');

    readPublicProfile(userId)
      .then((found) => {
        if (cancelled) return;
        if (!found) {
          setStatus('notFound');
          return;
        }
        setPerson(found);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        // An id that is not a uuid at all is refused by the database as malformed,
        // which to whoever followed the link is the same as no such person.
        if (/invalid input syntax for type uuid/i.test(err?.message ?? '')) {
          setStatus('notFound');
          return;
        }
        console.error('Could not load this profile:', err);
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (status !== 'ready') return undefined;
    let cancelled = false;
    setCounts(null);
    setOrganisations(null);
    setActivity({ status: 'loading', joinedAt: null, projects: [] });
    setComments({ status: 'loading', list: [] });
    setTab('about');
    readFollowCounts(userId)
      .then((found) => { if (!cancelled) setCounts(found); })
      .catch((err) => console.error('Could not load the follow counts:', err));
    readProfileOrganisations(userId)
      .then((found) => { if (!cancelled) setOrganisations(found); })
      .catch((err) => console.error("Could not load this account's organisations:", err));
    readProfileActivity(userId)
      .then((found) => {
        if (!cancelled) setActivity({ status: 'ready', joinedAt: found?.joinedAt ?? null, projects: found?.projects ?? [] });
      })
      .catch((err) => {
        console.error("Could not load this account's projects:", err);
        if (!cancelled) setActivity({ status: 'error', joinedAt: null, projects: [] });
      });
    readProfileComments(userId)
      .then((list) => { if (!cancelled) setComments({ status: 'ready', list }); })
      .catch((err) => {
        console.error("Could not load this account's comments:", err);
        if (!cancelled) setComments({ status: 'error', list: [] });
      });
    return () => { cancelled = true; };
  }, [userId, status]);

  const shell = (children) => (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: '48px 40px' }} className="placer-scroll">
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>{children}</div>
    </div>
  );

  if (status === 'loading') {
    return <PageLoader />;
  }

  if (status === 'notFound') {
    return shell(
      <div style={{ textAlign: 'center', padding: 48 }}>
        <h1 style={{ color: t.ink, marginBottom: 8 }}>Profile not found</h1>
        <p style={{ fontSize: 16, color: t.inkDim }}>The link may be wrong, or the account may have been removed.</p>
      </div>
    );
  }

  if (status === 'error') {
    return shell(
      <div role="alert" style={{ fontSize: 14, color: t.ink, fontWeight: 500 }}>
        Could not load this profile. Try again in a moment.
      </div>
    );
  }

  const isYou = accountId && accountId === person.id;
  // The address as people read it, without the https:// or a trailing slash.
  const websiteLabel = person.website.replace(/^https?:\/\//i, '').replace(/\/$/, '');

  const joined = formatted(JOINED_FORMAT, activity.joinedAt);

  const onTabKey = (event) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = TABS.findIndex(({ id }) => id === tab);
    const next = TABS[(index + step + TABS.length) % TABS.length].id;
    setTab(next);
    document.getElementById(`profile-tab-${next}`)?.focus();
  };

  const empty = (text) => (
    <div className="placer-card" style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 16, color: t.inkDim }}>{text}</p>
    </div>
  );
  const loading = <p style={{ fontSize: 15, color: t.inkDim }}>Loading…</p>;

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page }}
      className="placer-scroll">
      <div className="placer-profile">
        <header className="placer-profile-head">
          <Avatar name={person.name} photo={person.photo} size={120} ring={t.line} />
          <h1 className="placer-disp placer-profile-title" style={{ color: t.ink }}>{person.name}</h1>
          {joined && <p style={{ fontSize: 16, color: t.inkDim }}>Joined {joined}</p>}
          {person.location && (
            <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, color: t.inkDim }}>
              <Icon name="pin" size={16} stroke={2.1} />
              {person.location}
            </p>
          )}
          {counts && (
            <div style={{ display: 'flex', gap: 16, color: t.ink }}>
              {[['followers', counts.followers, counts.followers === 1 ? 'Follower' : 'Followers'],
                ['following', counts.following, 'Following']].map(([key, value, label]) => (
                <button key={key} type="button" onClick={() => setListOpen(key)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    color: 'inherit', fontFamily: 'var(--placer-font)', fontSize: 15 }}>
                  <strong style={{ fontWeight: 700 }}>{value}</strong>{' '}
                  <span style={{ color: t.inkDim }}>{label}</span>
                </button>
              ))}
            </div>
          )}
          {/* Signed in, and somebody else — nobody follows themselves. */}
          {accountId && !isYou && (
            <FollowButton t={t} type="user" targetId={person.id} label={person.name} size="sm"
              onChange={(nowFollowing) => setCounts((current) => current && {
                ...current, followers: Math.max(0, current.followers + (nowFollowing ? 1 : -1)) })} />
          )}
        </header>

        <div role="tablist" aria-label="Profile sections" onKeyDown={onTabKey} className="placer-profile-tabs"
          style={{ borderBottom: `1px solid ${t.line}` }}>
          {TABS.map(({ id, label }) => {
            const current = id === tab;
            // Activity counts comments, the part of it everybody sees.
            const count = id === 'projects' ? activity.projects.length : id === 'activity' ? comments.list.length : 0;
            return (
              <button key={id} id={`profile-tab-${id}`} type="button" role="tab" aria-selected={current}
                aria-controls={`profile-panel-${id}`} aria-label={count > 0 ? `${label} (${count})` : undefined}
                tabIndex={current ? 0 : -1} onClick={() => setTab(id)} className="placer-project-tab"
                style={{ color: current ? t.ink : t.inkDim, fontWeight: current ? 700 : 500,
                  boxShadow: current ? `inset 0 -3px 0 ${t.ink}` : 'none' }}>
                {label}
                {count > 0 && (
                  <span aria-hidden="true" style={{ marginLeft: 8, fontSize: 12, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 999, background: t.surfaceAlt, color: t.ink }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div id={`profile-panel-${tab}`} role="tabpanel" aria-labelledby={`profile-tab-${tab}`}
          className="placer-profile-panel">
          {tab === 'about' && (
            <>
              <p style={{ fontSize: 17, color: person.bio ? t.ink : t.inkFaint, lineHeight: 1.7,
                whiteSpace: 'pre-line', marginBottom: 32 }}>
                {person.bio || (isYou ? 'You have not written a bio yet. Add one in Settings.' : 'No bio yet.')}
              </p>
              <dl className="placer-profile-dl" style={{ borderTop: `1px solid ${t.line}`, paddingTop: 24 }}>
                <dt style={{ color: t.inkFaint }}>Email</dt>
                <dd style={{ color: t.ink }}>
                  {person.contactEmail
                    ? <a href={`mailto:${person.contactEmail}`} style={{ color: t.ink }}>{person.contactEmail}</a>
                    : <span style={{ color: t.inkFaint }}>Not shared</span>}
                </dd>
                <dt style={{ color: t.inkFaint }}>Website</dt>
                <dd style={{ color: t.ink }}>
                  {person.website
                    ? <a href={person.website} target="_blank" rel="noopener noreferrer nofollow"
                        style={{ color: t.ink }}>{websiteLabel}</a>
                    : <span style={{ color: t.inkFaint }}>Not shared</span>}
                </dd>
                {organisations?.length > 0 && (
                  <>
                    <dt style={{ color: t.inkFaint }}>
                      {organisations.length === 1 ? 'Organisation' : 'Organisations'}
                    </dt>
                    <dd style={{ color: t.ink }}>
                      {organisations.map((organisation, i) => (
                        <span key={organisation.id}>
                          {i > 0 && ', '}
                          <a href={`/organisations/${organisation.id}`}
                            onClick={(e) => { e.preventDefault(); onOpen?.('organisation', organisation.id); }}
                            style={{ color: t.ink }}>
                            {organisation.name}
                          </a>
                        </span>
                      ))}
                    </dd>
                  </>
                )}
              </dl>
            </>
          )}

          {tab === 'projects' && (
            activity.status === 'loading' ? loading
              : activity.status === 'error' ? empty('Projects could not be loaded. Try again in a moment.')
              : activity.projects.length === 0 ? empty(isYou ? 'You are not involved in any projects yet.'
                : `${person.name} is not involved in any projects yet.`)
              : (
                <div className="placer-profile-projects">
                  {activity.projects.map((project) => (
                    <ProjectCard key={project.id} t={t} project={project}
                      label={project.role === 'owner' ? 'Owner' : 'Collaborator'}
                      onOpen={(id) => onOpen?.('project', id)} />
                  ))}
                </div>
              )
          )}

          {/* What somebody has kept from the Toolkit is for them alone, so anybody else
              sees only the comments, without a heading over them. */}
          {tab === 'activity' && isYou && (
            <>
              <h2 style={{ fontSize: 19, fontWeight: 700, color: t.ink, margin: '0 0 12px' }}>Saved inquiries</h2>
              <SavedInquiries t={t} />
              <h2 style={{ fontSize: 19, fontWeight: 700, color: t.ink, margin: '40px 0 12px' }}>Comments</h2>
            </>
          )}

          {tab === 'activity' && (
            comments.status === 'loading' ? loading
              : comments.status === 'error' ? empty('Comments could not be loaded. Try again in a moment.')
              : comments.list.length === 0 ? empty(isYou ? 'You have not commented on any projects yet.'
                : `${person.name} has not commented on any projects yet.`)
              : (
                <ul aria-label="Comments" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {comments.list.map((comment) => (
                    <li key={comment.id} style={{ padding: '18px 0', borderTop: `1px solid ${t.line}` }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap',
                        marginBottom: 6, fontSize: 14, color: t.inkDim }}>
                        <span>
                          On{' '}
                          <a href={`/projects/${comment.projectId}`}
                            onClick={(e) => { e.preventDefault(); onOpen?.('project', comment.projectId); }}
                            style={{ color: t.ink, fontWeight: 700 }}>
                            {comment.projectName}
                          </a>
                        </span>
                        <span className="placer-caption">{formatted(POSTED_FORMAT, comment.createdAt)}</span>
                      </div>
                      <p style={{ fontSize: 15.5, lineHeight: 1.6, color: t.ink, whiteSpace: 'pre-line',
                        overflowWrap: 'anywhere' }}>
                        {comment.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )
          )}
        </div>
      </div>

      {listOpen && (
        <FollowListDialog t={t} userId={person.id} name={person.name} initialTab={listOpen}
          onOpen={onOpen} onClose={() => setListOpen(null)} />
      )}
    </div>
  );
}

export default PublicProfilePage;
