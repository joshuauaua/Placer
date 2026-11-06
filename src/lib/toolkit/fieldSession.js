/* PLACER — a field session: who is observing, when, and in what weather.
 *
 * The Gehl Institute's field tools (`fieldSession: true` in their register entries) ask
 * for it first, before anything else, whenever somebody comes into one of their rooms
 * by its link, PIN or QR code (FieldSessionGate). The name is the signed-in account's,
 * and cannot be changed there: the observer has to be on the project's team. The date
 * and time start at now.
 */

/** The weather, as the observer would note it. */
export const WEATHER = ['Sunny', 'Partly cloudy', 'Overcast', 'Rain', 'Snow', 'Windy'];

const pad = (number) => String(number).padStart(2, '0');

/** A session for `name`, dated today at the time now, with the weather still to pick. */
export function emptyFieldSession(name = '', now = new Date()) {
  return {
    name: name ?? '',
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    weather: '',
  };
}

/** What is still missing, in the order the form asks. */
export function fieldSessionProblems(session) {
  const problems = [];
  if (!session?.name?.trim()) problems.push('Your account has no name. Add one in Settings.');
  if (!session?.date) problems.push('Add the date.');
  if (!session?.time) problems.push('Add the time.');
  if (!session?.weather) problems.push('Pick the weather.');
  return problems;
}

/** Whether a tool asks for a field session before anybody takes part in its rooms. */
export const asksForFieldSession = (tool) => Boolean(tool?.fieldSession && tool?.room);
