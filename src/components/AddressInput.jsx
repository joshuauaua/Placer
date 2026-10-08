/* PLACER — an address field with place suggestions.
 *
 * Any address or place, suggested as it is typed (PlaceSearch, from OpenStreetMap) —
 * the same search as Settings' location, but not only towns. Choosing a suggestion
 * reports the address, where it is, and the town and country it is in through
 * `onPick`. Typing by hand afterwards reports only the text, through `onChange`, and
 * the caller drops the point, since the text no longer says where it was.
 *
 * Used by an organisation's setup and a project's.
 */

import { PlaceSearch } from './PlaceSearch';

export function AddressInput({ id, value, onChange, onPick, placeholder, style }) {
  return (
    <PlaceSearch id={id} value={value} placeholder={placeholder} style={style}
      onChange={onChange}
      onPick={(result) => onPick({
        address: result.label,
        point: result.point,
        townAndCountry: result.townAndCountry,
      })} />
  );
}

export default AddressInput;
