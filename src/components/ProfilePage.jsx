/* PLACER — your profile: what you have posted, and how it has landed */

import { useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';
import { Avatar, Btn, CatTag, Vote } from './UI';
import { ImaginationPreview } from './ImaginationPreview';
import { ProjectCard } from './ProjectCard';
import { postsAreShared, readImaginations, readLocalImaginations } from '../services/imaginations';
import { FOLLOW_TYPES, readFollows, unfollow } from '../services/follows';
import { isSupabaseConfigured as projectsAvailable, readMyProjects } from '../services/projects';

// What each of the four followed sections is called and what it says when there is
// nothing in it. 'imagination' is resolved against the imaginations already loaded
// for this page rather than fetched again; the other three have no catalog anywhere
// in the app to follow one *from* yet, so their lists are honestly always empty
// until that exists — see services/follows.js's header for why the plumbing is
// still worth having now.
const FOLLOWED_SECTIONS = [
  { type: 'imagination', title: 'Followed imaginations',
    empty: 'Nothing saved yet. Open an imagination and follow it to keep track of it here.' },
  { type: 'user', title: 'Followed users',
    empty: 'Nothing yet — there is nowhere in PLACER to follow another person from yet.' },
  { type: 'project', title: 'Followed projects',
    empty: 'Nothing yet — follow a project from its public page to keep track of it here.' },
  { type: 'city', title: 'Followed cities',
    empty: 'Nothing yet — PLACER has no city pages to follow from yet.' },
];

const sumUpvotes = (items) => items.reduce((total, item) => total + (item.upvotes || 0), 0);

// comments is an array on a record, not a count. It used to be read as though it were a
// number, which is why the two figures beside "Imaginations posted" always came out at
// zero — along with `votes`, which no record has ever had; the field is `upvotes`.
const countComments = (items) => items.reduce(
  (total, item) => total + (Array.isArray(item.comments) ? item.comments.length : 0),
  0,
);

// Local to this page, the way AdminDashboard keeps its own StatCard: the house
// convention here is to duplicate a small presentational helper rather than push
// it into UI.jsx.
function StatCard({ t, icon, label, value }) {
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12,
      padding: 24, boxShadow: t.shadow }}>
      <div style={{ width: 48, height: 48, borderRadius: 10, background: t.accent + '15',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Icon name={icon} size={24} stroke={2} style={{ color: t.accent }} />
      </div>
      <div className="placer-disp" style={{ fontSize: 32, fontWeight: 900, color: t.ink, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 14, color: t.inkDim, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function ImaginationCard({ t, imagination, onOpen }) {
  const { title, cat, blurb, loc, preview, upvotes = 0, comments = [] } = imagination;
  const commentCount = Array.isArray(comments) ? comments.length : 0;

  return (
    <article
      onClick={() => onOpen(imagination)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(imagination); } }}
      style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12,
        overflow: 'hidden', boxShadow: t.shadow, cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = t.shadow;
      }}>
      {preview && (
        <img src={preview} alt={`Preview of ${title || 'this imagination'}`}
          style={{ width: '100%', height: 170, objectFit: 'cover', display: 'block' }} />
      )}
      <div style={{ padding: 20, display: 'flex', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {cat && <div style={{ marginBottom: 10 }}><CatTag cat={cat} t={t} size="sm" /></div>}
          <h3 style={{ fontSize: 20, fontWeight: 700, color: t.ink, lineHeight: 1.3, marginBottom: 6 }}>
            {title || 'Untitled imagination'}
          </h3>
          {blurb && (
            <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, marginBottom: 10,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {blurb}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: t.inkDim }}>
            {loc && <span>{loc}</span>}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Icon name="comment" size={14} stroke={2.1} />
              {commentCount}
            </span>
          </div>
        </div>
        <Vote t={t} count={upvotes} size="sm" />
      </div>
    </article>
  );
}

// A followed project, city or user: nothing to show but the label captured at
// follow time — see services/follows.js — plus a way to undo it.
function FollowedRow({ t, item, onUnfollow }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '12px 16px', background: t.surface, border: `1px solid ${t.line}`, borderRadius: 10 }}>
      <span style={{ fontSize: 14.5, fontWeight: 700, color: t.ink }}>{item.label}</span>
      <button onClick={() => onUnfollow(item)} style={{ background: 'none', border: 'none',
        color: t.inkDim, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
        Unfollow
      </button>
    </div>
  );
}

function FollowedSection({ t, title, empty, items, status, render }) {
  return (
    <>
      <h2 className="placer-disp" style={{ fontSize: 22, fontWeight: 900, color: t.ink,
        letterSpacing: '-0.02em', margin: '40px 0 16px' }}>
        {title}
      </h2>
      {status === 'loading' && (
        <div style={{ fontSize: 14, color: t.inkDim, fontWeight: 600 }}>Loading…</div>
      )}
      {status === 'error' && (
        <div role="alert" style={{ padding: 16, borderRadius: 8, background: '#D6452F22',
          borderLeft: '4px solid #D6452F', fontSize: 14, fontWeight: 600, color: t.ink }}>
          Could not load {title.toLowerCase()}. See the console for details.
        </div>
      )}
      {status === 'ready' && items.length === 0 && (
        <p style={{ fontSize: 14, color: t.inkFaint }}>{empty}</p>
      )}
      {status === 'ready' && items.length > 0 && render()}
    </>
  );
}

export function ProfilePage({ t, profile, accountId = null, onNavigate, onNewProject,
  onOpenProjectDashboard, onSignIn }) {
  // The imagination open in the modal, if any — set from any card on this page.
  const [selected, setSelected] = useState(null);
  const [posted, setPosted] = useState([]);
  // Imaginations still only in this browser, kept apart from the posted ones because they
  // are a different thing: nobody else can see them.
  const [onlyHere, setOnlyHere] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'

  // One list per followed type, plus one status for all four — they are cheap enough,
  // and always loaded together, that a status per section would only be more state to
  // keep in step for no screen anyone would notice.
  const [followedByType, setFollowedByType] = useState(() =>
    Object.fromEntries(FOLLOW_TYPES.map((type) => [type, []])));
  const [followedStatus, setFollowedStatus] = useState('loading');

  // Projects need an account and a Supabase project either way — see
  // services/projects.js's header — so a checkout with neither shows the section
  // as simply empty rather than spending a request finding that out.
  const [myProjects, setMyProjects] = useState([]);
  const [projectsStatus, setProjectsStatus] = useState('loading');

  const shared = postsAreShared();

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      readImaginations(),
      // Only worth asking where the two stores are different things. Without a project
      // configured, readImaginations IS the local store and this would be the same list.
      shared ? readLocalImaginations() : Promise.resolve([]),
    ])
      .then(([all, local]) => {
        if (cancelled) return;
        setPosted(all);
        setOnlyHere(local);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Could not load imaginations:', err);
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [shared]);

  useEffect(() => {
    let cancelled = false;

    Promise.all(FOLLOW_TYPES.map((type) => readFollows(type)))
      .then((lists) => {
        if (cancelled) return;
        setFollowedByType(Object.fromEntries(FOLLOW_TYPES.map((type, i) => [type, lists[i]])));
        setFollowedStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Could not load what you follow:', err);
        setFollowedStatus('error');
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!projectsAvailable() || !accountId) {
      setMyProjects([]);
      setProjectsStatus('ready');
      return undefined;
    }

    let cancelled = false;

    readMyProjects(accountId)
      .then((found) => {
        if (cancelled) return;
        setMyProjects(found);
        setProjectsStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Could not load your projects:', err);
        setProjectsStatus('error');
      });

    return () => { cancelled = true; };
  }, [accountId]);

  // Escape closes the modal, matching the map's own Escape behaviour.
  useEffect(() => {
    if (!selected) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSelected(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected]);

  const handleUnfollow = async (item) => {
    // Optimistic: nothing downstream depends on the request finishing before the
    // row goes away, and a follow list is low enough stakes that a failed unfollow
    // reappearing on the next visit is a fine fallback rather than reverting here.
    setFollowedByType((current) => ({
      ...current,
      [item.type]: current[item.type].filter((entry) => entry.targetId !== item.targetId),
    }));
    try {
      await unfollow(item.type, item.targetId);
    } catch (err) {
      console.error('Could not unfollow that:', err);
    }
  };

  const name = profile?.name ?? '';
  // Ownership is the account id now. It used to be a display-name comparison, which meant
  // renaming yourself in Settings orphaned everything you had posted.
  const mine = useMemo(
    () => posted.filter((imagination) => (shared
      ? imagination.userId === accountId
      : imagination.author === name)),
    [posted, shared, accountId, name],
  );

  // The full imaginations a follow points at, in followed order — not just the
  // ones this account made. Resolved against what the page already loaded rather
  // than fetched again; an id followed on another device that has not synced here
  // yet is the one case this quietly drops, which is what readFollows() being
  // per-account already implies.
  const followedImaginations = useMemo(() => {
    const byId = new Map([...posted, ...onlyHere].map((imagination) => [imagination.id, imagination]));
    return followedByType.imagination
      .map((entry) => byId.get(entry.targetId))
      .filter(Boolean);
  }, [followedByType.imagination, posted, onlyHere]);

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: '48px 40px' }} className="placer-scroll">
      {selected && (
        <ImaginationPreview t={t} imagination={selected} onClose={() => setSelected(null)}
          accountId={accountId} authorName={name} onSignIn={onSignIn} />
      )}
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 48 }}>
          <Avatar name={name} icon={profile?.avatar} size={72} ring={t.line} />
          <div>
            <h1 className="placer-disp" style={{ fontSize: 48, fontWeight: 900, color: t.ink,
              letterSpacing: '-0.03em', marginBottom: 8 }}>
              Profile
            </h1>
            <p style={{ fontSize: 18, color: t.inkDim, lineHeight: 1.6 }}>
              Posting as <strong style={{ color: t.ink }}>{name}</strong>.{' '}
              <span
                onClick={() => onNavigate('settings')}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNavigate('settings'); }}
                style={{ color: t.ink, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                Change your name
              </span>
            </p>
            {profile?.location && (
              <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14.5,
                color: t.inkDim, fontWeight: 600, marginTop: 6 }}>
                <Icon name="pin" size={15} stroke={2.1} />
                {profile.location}
              </p>
            )}
            {profile?.bio && (
              <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginTop: 10, maxWidth: 560 }}>
                {profile.bio}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 20, marginBottom: 40 }}>
          <StatCard t={t} icon="grid" label="Imaginations posted" value={mine.length} />
          <StatCard t={t} icon="arrowUp" label="Votes received" value={sumUpvotes(mine)} />
          <StatCard t={t} icon="comment" label="Comments received" value={countComments(mine)} />
        </div>

        {projectsAvailable() && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 20 }}>
              <h2 className="placer-disp" style={{ fontSize: 28, fontWeight: 900, color: t.ink,
                letterSpacing: '-0.02em' }}>
                Your projects
              </h2>
              {onNewProject && (
                <Btn t={t} variant="outline" size="sm" icon="plus" onClick={onNewProject}>
                  Start a project
                </Btn>
              )}
            </div>

            {projectsStatus === 'error' && (
              <div role="alert" style={{ padding: 16, borderRadius: 8, background: '#D6452F22',
                borderLeft: '4px solid #D6452F', fontSize: 14, fontWeight: 600, color: t.ink, marginBottom: 40 }}>
                Could not load your projects. See the console for details.
              </div>
            )}

            {projectsStatus === 'ready' && myProjects.length === 0 && (
              <p style={{ fontSize: 14, color: t.inkFaint, marginBottom: 40 }}>
                Nothing yet. A project gets a dashboard, a public page, and lets people
                collaborate with you on it.
              </p>
            )}

            {projectsStatus === 'ready' && myProjects.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 20, marginBottom: 40 }}>
                {myProjects.map((project) => (
                  <ProjectCard key={project.id} t={t} project={project} onOpen={onOpenProjectDashboard} />
                ))}
              </div>
            )}
          </>
        )}

        <h2 className="placer-disp" style={{ fontSize: 28, fontWeight: 900, color: t.ink,
          letterSpacing: '-0.02em', marginBottom: 20 }}>
          Created imaginations
        </h2>

        {status === 'loading' && (
          <div style={{ fontSize: 14, color: t.inkDim, fontWeight: 600 }}>Loading imaginations…</div>
        )}

        {status === 'error' && (
          <div role="alert" style={{ padding: 16, borderRadius: 8, background: '#D6452F22',
            borderLeft: '4px solid #D6452F', fontSize: 14, fontWeight: 600, color: t.ink }}>
            Could not load your imaginations. See the console for details.
          </div>
        )}

        {status === 'ready' && mine.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', background: t.surface,
            border: `1px solid ${t.line}`, borderRadius: 12 }}>
            <Icon name="sparkle" size={30} stroke={1.9} style={{ color: t.inkFaint, margin: '0 auto 12px' }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, marginBottom: 6 }}>
              Nothing posted yet
            </div>
            <div style={{ fontSize: 14, color: t.inkDim, marginBottom: 20 }}>
              Find a street on the map, draw what it could be, and it shows up here.
            </div>
            <Btn t={t} variant="accent" icon="sparkle" onClick={() => onNavigate('map')}>
              Start imagining
            </Btn>
          </div>
        )}

        {status === 'ready' && mine.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 24, paddingBottom: 40 }}>
            {mine.map((imagination) => (
              <ImaginationCard key={imagination.id} t={t} imagination={imagination} onOpen={setSelected} />
            ))}
          </div>
        )}

        {/* Anything made before there were accounts. Left where it is rather than uploaded:
            it was made under a privacy policy that said it would never leave the device,
            and publishing it to a shared map without being asked would break that. */}
        {status === 'ready' && shared && onlyHere.length > 0 && (
          <>
            <h2 className="placer-disp" style={{ fontSize: 28, fontWeight: 900, color: t.ink,
              letterSpacing: '-0.02em', margin: '48px 0 8px' }}>
              Saved on this device
            </h2>
            <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginBottom: 20 }}>
              Made before you had an account, so they live in this browser and nobody else
              can see them. They stay here until you clear your browsing data — they are not
              on the community map, and nothing has been uploaded.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: 24, paddingBottom: 40 }}>
              {onlyHere.map((imagination) => (
                <ImaginationCard key={imagination.id} t={t} imagination={imagination} onOpen={setSelected} />
              ))}
            </div>
          </>
        )}

        {FOLLOWED_SECTIONS.map(({ type, title, empty }) => (
          <FollowedSection key={type} t={t} title={title} empty={empty}
            items={type === 'imagination' ? followedImaginations : followedByType[type]}
            status={followedStatus}
            render={() => (
              type === 'imagination' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                  gap: 24 }}>
                  {followedImaginations.map((imagination) => (
                    <ImaginationCard key={imagination.id} t={t} imagination={imagination} onOpen={setSelected} />
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {followedByType[type].map((item) => (
                    <FollowedRow key={item.targetId} t={t} item={item} onUnfollow={handleUnfollow} />
                  ))}
                </div>
              )
            )} />
        ))}
      </div>
    </div>
  );
}

export default ProfilePage;
