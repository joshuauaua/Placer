/* PLACER — Follow / Following, for a person's or an organisation's public page.
 *
 * Reads whether this account already follows the thing, then toggles it through
 * services/follows.js, showing the new state straight away and putting it back if the
 * change is refused. `label` is the name the dashboard's Following list will show,
 * snapshotted now (see follows.js's header for why). `saveLabels` words it as Save /
 * Saved instead, for Explore's preview card, where following a place is keeping it.
 */

import { useEffect, useState } from 'react';
import { Btn } from './UI';
import { follow, isFollowing, unfollow } from '../services/follows';

export function FollowButton({ t, type, targetId, label, size = 'md', onChange, saveLabels = false }) {
  const [following, setFollowing] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setChecked(false);
    isFollowing(type, targetId)
      .then((value) => { if (!cancelled) setFollowing(value); })
      .catch((err) => console.error('Could not check whether you follow this:', err))
      .finally(() => { if (!cancelled) setChecked(true); });
    return () => { cancelled = true; };
  }, [type, targetId]);

  const toggle = async () => {
    const next = !following;
    setFollowing(next);
    try {
      if (next) await follow(type, targetId, label);
      else await unfollow(type, targetId);
      onChange?.(next);
    } catch (err) {
      console.error('Could not update whether you follow this:', err);
      setFollowing(!next);
    }
  };

  return (
    <Btn t={t} size={size} variant={following ? 'outline' : 'primary'}
      icon={following ? 'check' : saveLabels ? 'bookmark' : 'plus'}
      onClick={toggle} disabled={!checked} ariaPressed={saveLabels ? following : undefined}>
      {saveLabels ? (following ? 'Saved' : 'Save') : following ? 'Following' : 'Follow'}
    </Btn>
  );
}

export default FollowButton;
