import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';

// The client is never really built: every test asserts what would have been sent.
const insert = vi.fn();
const from = vi.fn(() => ({ insert }));
const createClient = vi.fn(() => ({ from }));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

const configure = () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://project-ref.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
};

/** What the survey hands to submit() when it is finished. */
const response = () => ({
  section1: { persona: 'urban-planner' },
  section2: { toolStack: ['spatial-gis', 'visual-boards'] },
  section3: {
    featurePriorities: ['council-reports', 'participatory-mapping'],
    coCreation: ['interview'],
  },
  email: 'planner@example.com',
  otherText: { featurePriorities: 'A shade structure' },
  source: 'landing_survey',
});

// The modules read the environment at call time, but the client is cached, so
// each test gets its own copy of both.
let api;
let supabase;

describe('saving a survey response', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
    insert.mockReset().mockResolvedValue({ error: null });
    from.mockClear();
    createClient.mockClear();
    supabase = await import('../supabase');
    api = await import('../api');
  });

  describe('with no project configured', () => {
    it('keeps the response in this browser instead', async () => {
      // The setup file leaves both variables empty.
      expect(supabase.isSupabaseConfigured()).toBe(false);
      expect(supabase.getSupabase()).toBeNull();

      const saved = await api.saveSurveyResponse(response());

      expect(createClient).not.toHaveBeenCalled();
      const stored = JSON.parse(localStorage.getItem('placemaking_survey_responses'));
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({ email: 'planner@example.com', source: 'landing_survey' });
      expect(saved.id).toBeTruthy();
    });
  });

  describe('with a project configured', () => {
    beforeEach(configure);

    it('inserts one row, with the answers as a single jsonb value', async () => {
      await api.saveSurveyResponse(response());

      expect(from).toHaveBeenCalledWith('survey_responses');
      expect(insert).toHaveBeenCalledWith({
        source: 'landing_survey',
        email: 'planner@example.com',
        // Sections stay nested: rewording the survey needs no migration.
        answers: {
          section1: { persona: 'urban-planner' },
          section2: { toolStack: ['spatial-gis', 'visual-boards'] },
          section3: {
            featurePriorities: ['council-reports', 'participatory-mapping'],
            coCreation: ['interview'],
          },
        },
        other_text: { featurePriorities: 'A shade structure' },
      });
    });

    it('writes nothing to this browser', async () => {
      await api.saveSurveyResponse(response());

      expect(localStorage.getItem('placemaking_survey_responses')).toBeNull();
    });

    it('sends no address when none was given', async () => {
      await api.saveSurveyResponse({ ...response(), email: null });
      expect(insert).toHaveBeenCalledWith(expect.objectContaining({ email: null }));

      // An empty string is not an address either.
      await api.saveSurveyResponse({ ...response(), email: '' });
      expect(insert).toHaveBeenLastCalledWith(expect.objectContaining({ email: null }));
    });

    it('defaults the free text to an empty object', async () => {
      const withoutOther = response();
      delete withoutOther.otherText;
      await api.saveSurveyResponse(withoutOther);

      expect(insert).toHaveBeenCalledWith(expect.objectContaining({ other_text: {} }));
    });

    it('never asks for the row back, which the anon policy would refuse', async () => {
      await api.saveSurveyResponse(response());

      // insert() is the end of the chain: a .select() after it would need read
      // access the browser's key does not have, and would fail the whole call.
      const chain = from.mock.results[0].value;
      expect(Object.keys(chain)).toEqual(['insert']);
    });

    it('throws with the reason when the insert is refused', async () => {
      insert.mockResolvedValue({ error: { message: 'new row violates row-level security policy' } });

      await expect(api.saveSurveyResponse(response())).rejects.toThrow(
        /row-level security policy/,
      );
      // Nothing kept locally either: the survey shows its error and stays put.
      expect(localStorage.getItem('placemaking_survey_responses')).toBeNull();
    });

    it('builds the client once and reuses it', async () => {
      await api.saveSurveyResponse(response());
      await api.saveSurveyResponse(response());

      expect(createClient).toHaveBeenCalledTimes(1);
      expect(createClient).toHaveBeenCalledWith(
        'https://project-ref.supabase.co',
        'anon-key',
        // No session to keep: nobody signs in.
        expect.objectContaining({ auth: expect.objectContaining({ persistSession: false }) }),
      );
    });
  });
});
