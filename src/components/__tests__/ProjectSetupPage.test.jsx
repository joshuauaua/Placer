import { describe, it, expect, vi, afterEach, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ProjectSetupPage, parseBudgetAmount } from '../ProjectSetupPage';
import {
  createProject, readProjectBudget, readProjectToolConfig, readProjectTools, removeProjectImageFile,
  readConfiguredProjectTools, saveProjectBudget, saveProjectToolConfig, saveProjectTools, updateProject,
  uploadProjectGalleryImage,
} from '../../services/projects';
import { readProjectOpenRooms } from '../../services/rooms';
import { THEME } from '../../theme';
import { CATEGORIES, TOOLS } from '../../toolkit/tools';

vi.mock('../../services/projects', async (importOriginal) => ({
  // The real PROJECT_TYPES and currencies, so the choices on screen are the ones that ship.
  PROJECT_TYPES: (await importOriginal()).PROJECT_TYPES,
  BUDGET_CURRENCIES: (await importOriginal()).BUDGET_CURRENCIES,
  VISIBILITIES: (await importOriginal()).VISIBILITIES,
  readProjectBudget: vi.fn(() => Promise.resolve(null)),
  saveProjectBudget: vi.fn(() => Promise.resolve()),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  readProjectTools: vi.fn(() => Promise.resolve([])),
  readProjectToolConfig: vi.fn(() => Promise.resolve(null)),
  saveProjectToolConfig: vi.fn(() => Promise.resolve()),
  uploadSceneImage: vi.fn(() => Promise.resolve('scenes/proj-1/scene-1.webp')),
  saveProjectTools: vi.fn((projectId, tools) => Promise.resolve(tools)),
  removeProjectImageFile: vi.fn(() => Promise.resolve()),
  uploadProjectGalleryImage: vi.fn(),
  GALLERY_MAX: 12,
  readConfiguredProjectTools: vi.fn(() => Promise.resolve(new Set())),
}));

vi.mock('../../services/rooms', () => ({
  readProjectOpenRooms: vi.fn(() => Promise.resolve([])),
}));

// Where this machine is says nothing about the project: the suggestion goes only on
// the places a test gives it.
vi.mock('../../lib/currency', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, suggestCurrency: (options) => real.suggestCurrency({ timeZone: '', locales: [], ...options }) };
});

vi.mock('../../services/media', async (importOriginal) => ({
  ...(await importOriginal()),
  mediaUrl: (path) => (path ? `https://media.test/${path}` : null),
}));

// The Places suggestions need a real Google Maps script this suite has no business
// loading. Stubbed to the field plus a stand-in for choosing a suggestion, which is
// all ProjectSetupPage sees of it.
const PICKED = {
  address: 'Folkets Park, Amiralsgatan 35, Malmö', point: { lat: 55.59, lng: 13.01 },
  townAndCountry: 'Malmö, Sweden',
};
vi.mock('../AddressInput', () => ({
  AddressInput: ({ id, value, onChange, onPick }) => (
    <>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" onClick={() => onPick(PICKED)}>Pick the suggestion</button>
    </>
  ),
}));

const setup = (overrides = {}) => {
  const props = {
    t: THEME,
    accountId: 'user-1',
    accountName: 'Mara Quinn',
    onSaved: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  render(<ProjectSetupPage {...props} />);
  return props;
};

const ORGANISATIONS = [
  { id: 'org-1', name: 'Malmö Stad' },
  { id: 'org-2', name: 'Folkets Park Association' },
];

const next = () => fireEvent.click(screen.getByRole('button', { name: /^Next/ }));

/** From the cover, through the type step, to the basics. */
const toBasics = (type = /I have a say over a place/) => {
  fireEvent.click(screen.getByRole('button', { name: /Create a new project/ }));
  fireEvent.click(screen.getByRole('radio', { name: type }));
  next();
};

describe('ProjectSetupPage, starting a project', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens on a cover saying what a project is', () => {
    setup();

    expect(screen.getByRole('heading', { level: 1, name: 'Start a Project' })).toBeInTheDocument();
    expect(screen.getByText(/Bring people together around a place/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Name *')).not.toBeInTheDocument();
  });

  it('asks what kind of project it is, and will not go on without an answer', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Create a new project/ }));

    expect(screen.getByText('Step 2 of 5 · Project type')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: /I have a say over a place/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /I want to push for change/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Something else/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Next/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: /Something else/ }));
    expect(screen.getByRole('button', { name: /^Next/ })).toBeEnabled();
  });

  it('tailors the goals question to the kind of project', () => {
    setup();
    toBasics(/I want to push for change/);

    expect(screen.getByText(/What change do you want to see/)).toBeInTheDocument();
  });

  it('needs a name before the basics let you past', () => {
    setup();
    toBasics();

    expect(screen.getByRole('button', { name: /^Next/ })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Riverside Greenway' } });
    expect(screen.getByRole('button', { name: /^Next/ })).toBeEnabled();
  });

  it('asks for a description above the goals, and holds the name to what the database takes', () => {
    setup();
    toBasics();

    const description = screen.getByLabelText('Description');
    const goals = screen.getByLabelText('Goals');
    expect(description.compareDocumentPosition(goals) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByLabelText('Name *')).toHaveAttribute('maxLength', '120');
  });

  it('goes back a step without losing what was filled in', () => {
    setup();
    toBasics();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Riverside Greenway' } });

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('radio', { name: /I have a say over a place/ })).toBeChecked();
    next();

    expect(screen.getByLabelText('Name *')).toHaveValue('Riverside Greenway');
  });

  it('starts a project with what was filled in across the five steps', async () => {
    createProject.mockResolvedValue({ id: 'proj-1', name: 'Riverside Greenway' });
    const { onSaved } = setup();

    toBasics();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Riverside Greenway' } });
    fireEvent.change(screen.getByLabelText('Subtitle'), { target: { value: ' A park for the whole neighbourhood ' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'A park along the old rail line.' } });
    fireEvent.change(screen.getByLabelText('Goals'), { target: { value: 'Turn the old rail corridor into a park.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pick the suggestion' }));
    next();
    expect(screen.getByText('Step 4 of 5 · Tools')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Co-Budget/ }));
    fireEvent.click(screen.getByRole('button', { name: /Desire Lines/ }));
    next();
    expect(screen.getByText('Step 5 of 5 · Visuals')).toBeInTheDocument();
    expect(createProject).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Start project/ }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ id: 'proj-1', name: 'Riverside Greenway' }));
    expect(createProject).toHaveBeenCalledWith({
      ownerId: 'user-1', ownerName: 'Mara Quinn', name: 'Riverside Greenway',
      subtitle: 'A park for the whole neighbourhood',
      summary: 'A park along the old rail line.',
      description: 'Turn the old rail corridor into a park.',
      startDate: null, endDate: null,
      address: 'Folkets Park, Amiralsgatan 35, Malmö', locationPoint: { lat: 55.59, lng: 13.01 },
      locations: ['Malmö, Sweden'],
      projectType: 'steward',
      visibility: 'public',
    });
    expect(saveProjectTools).toHaveBeenCalledWith('proj-1', ['budget-ballot', 'desire-lines'], 'user-1');
  });

  it('asks for the place as an address in the basics, with no outline to draw', () => {
    setup();
    toBasics();

    expect(screen.getByLabelText('Address')).toBeInTheDocument();
    expect(screen.queryByText('Location outline')).not.toBeInTheDocument();
  });

  it('keeps an address typed by hand, unpinned, as the place name', async () => {
    createProject.mockResolvedValue({ id: 'proj-1', name: 'Riverside Greenway' });
    setup();

    toBasics();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Riverside Greenway' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pick the suggestion' }));
    // Edited by hand after picking: the point no longer says where the text is.
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'The old rail yard' } });
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: /Start project/ }));

    await waitFor(() => expect(createProject).toHaveBeenCalledWith(expect.objectContaining({
      address: 'The old rail yard', locationPoint: null, locations: ['The old rail yard'],
    })));
  });

  it('shows every Toolkit tool to choose from, and lets one be unchosen', () => {
    setup();
    toBasics();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Riverside Greenway' } });
    next();

    const tools = within(screen.getByRole('group', { name: 'Toolkit tools' })).getAllByRole('button');
    expect(tools).toHaveLength(TOOLS.length);
    // A list per category, Understand, Imagine and Plan, each holding just its own tools.
    for (const category of CATEGORIES) {
      const list = within(screen.getByRole('list', { name: category.name }));
      expect(list.getAllByRole('button')).toHaveLength(TOOLS.filter((tool) => tool.category === category.id).length);
    }
    expect(within(screen.getByRole('list', { name: 'Plan' })).getByRole('button', { name: /Co-Budget/ }))
      .toBeInTheDocument();
    const ballot = screen.getByRole('button', { name: /Co-Budget/ });
    expect(ballot).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(ballot);
    expect(ballot).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(ballot);
    expect(ballot).toHaveAttribute('aria-pressed', 'false');
  });

  it('saves no tools when none were chosen', async () => {
    createProject.mockResolvedValue({ id: 'proj-1', name: 'Riverside Greenway' });
    const { onSaved } = setup();

    toBasics();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Riverside Greenway' } });
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: /Start project/ }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(saveProjectTools).not.toHaveBeenCalled();
  });

  it('keeps the project and the choice when the tools fail to save, so saving again retries', async () => {
    createProject.mockResolvedValue({ id: 'proj-1', name: 'Riverside Greenway' });
    updateProject.mockResolvedValue({ id: 'proj-1', name: 'Riverside Greenway' });
    saveProjectTools.mockRejectedValueOnce(new Error('network down'));
    const { onSaved } = setup();

    toBasics();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Riverside Greenway' } });
    next();
    fireEvent.click(screen.getByRole('button', { name: /Co-Budget/ }));
    next();
    fireEvent.click(screen.getByRole('button', { name: /Start project/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('its tools could not be: network down');
    expect(onSaved).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createProject).toHaveBeenCalledTimes(1);
    expect(saveProjectTools).toHaveBeenLastCalledWith('proj-1', ['budget-ballot'], 'user-1');
  });

  it('offers no choice of who runs it to somebody with no organisation', () => {
    setup();
    toBasics();

    expect(screen.queryByLabelText('Run by')).not.toBeInTheDocument();
  });

  it('can be run in the name of an organisation, preselected when started from one', async () => {
    createProject.mockResolvedValue({ id: 'proj-1', name: 'Riverside Greenway' });
    setup({ organisations: ORGANISATIONS, initialOrganisationId: 'org-2' });

    toBasics();
    expect(screen.getByLabelText('Run by')).toHaveValue('org-2');
    expect(screen.getByRole('option', { name: 'Just me (Mara Quinn)' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Run by'), { target: { value: 'org-1' } });
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Riverside Greenway' } });
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: /Start project/ }));

    await waitFor(() => expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({ organisationId: 'org-1' })));
  });

  it('ignores an organisation it is not an admin of', () => {
    setup({ organisations: ORGANISATIONS, initialOrganisationId: 'org-elsewhere' });
    toBasics();

    expect(screen.getByLabelText('Run by')).toHaveValue('');
  });

  it('moves on a step, rather than starting the project, when Enter is pressed in a field', () => {
    setup();
    toBasics();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Riverside Greenway' } });

    fireEvent.submit(screen.getByLabelText('Name *').closest('form'));

    expect(screen.getByText('Step 4 of 5 · Tools')).toBeInTheDocument();
    expect(createProject).not.toHaveBeenCalled();
  });

  it('says so when starting the project fails', async () => {
    createProject.mockRejectedValue(new Error('name too long'));
    setup();

    toBasics();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'x'.repeat(200) } });
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: /Start project/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('name too long');
  });

  it('cancels back out, from the cover or from a step', () => {
    const { onCancel } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: /Create a new project/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});

describe('ProjectSetupPage, editing a project', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const PROJECT = {
    id: 'proj-1', ownerId: 'user-1', ownerName: 'Mara Quinn', name: 'Riverside Greenway',
    description: 'Turn the old rail corridor into a park.', startDate: '2026-01-01', endDate: '2026-12-31',
    locations: ['Malmö', 'Folkets Park'], projectType: 'advocate',
    address: 'Folkets Park, Amiralsgatan 35, Malmö', locationPoint: { lat: 55.59, lng: 13.01 },
  };

  it('starts filled in with the project already there', () => {
    setup({ project: PROJECT });

    expect(screen.getByLabelText('Name *')).toHaveValue('Riverside Greenway');
    expect(screen.getByLabelText('Dates')).toHaveTextContent(/Jan.*Dec.*2026/);
    expect(screen.getByLabelText('Address')).toHaveValue('Folkets Park, Amiralsgatan 35, Malmö');
    expect(screen.getByRole('button', { name: /Save changes/ })).toBeInTheDocument();
  });

  it('is one page, with no cover or steps', () => {
    setup({ project: PROJECT });

    expect(screen.getByRole('heading', { level: 1, name: 'Edit project' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create a new project/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Step \d of 5/)).not.toBeInTheDocument();
  });

  it('keeps the place names of a project whose address was not touched', async () => {
    updateProject.mockResolvedValue(PROJECT);
    setup({ project: { ...PROJECT, address: '', locationPoint: null } });

    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    await waitFor(() => expect(updateProject).toHaveBeenCalled());
    expect(updateProject.mock.calls[0][1]).not.toHaveProperty('locations');
    expect(updateProject.mock.calls[0][1]).not.toHaveProperty('locationShapes');
  });

  it('has no tools to choose, since My Toolkit looks after them, and never saves them', async () => {
    updateProject.mockResolvedValue(PROJECT);
    const { onSaved } = setup({ project: PROJECT });

    expect(screen.queryByRole('button', { name: /Co-Budget/ })).not.toBeInTheDocument();
    expect(screen.getByText(/My Toolkit tab/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(saveProjectTools).not.toHaveBeenCalled();
  });

  it('splits into General settings, Images and Media, and Page Layout, saved together', async () => {
    updateProject.mockResolvedValue(PROJECT);
    setup({ project: { ...PROJECT, gallery: [], galleryPaths: [] } });

    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(tabs).toEqual(['General settings', 'Images and Media', 'Page Layout']);
    expect(screen.getByRole('tab', { name: 'General settings' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('Gallery Images')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'New name' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Images and Media' }));
    expect(screen.getByText('Gallery Images')).toBeInTheDocument();
    expect(screen.queryByLabelText('Name *')).not.toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Images and Media' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Page Layout' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));
    await waitFor(() => expect(updateProject).toHaveBeenCalledWith('proj-1',
      expect.objectContaining({ name: 'New name' })));
  });

  it('does not show or change the kind of project', () => {
    setup({ project: PROJECT });

    expect(screen.queryByText(/What kind of project/)).not.toBeInTheDocument();
    expect(screen.queryByText('I want to push for change in a place')).not.toBeInTheDocument();
  });

  it('leaves the organisation alone when editing a project run by one this account does not run', async () => {
    updateProject.mockResolvedValue(PROJECT);
    setup({ project: { ...PROJECT, organisationId: 'org-elsewhere' }, organisations: ORGANISATIONS });

    expect(screen.queryByLabelText('Run by')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    await waitFor(() => expect(updateProject).toHaveBeenCalled());
    expect(updateProject.mock.calls[0][1]).not.toHaveProperty('organisationId');
  });

  it('saves changes through updateProject rather than creating a new one', async () => {
    updateProject.mockResolvedValue({ ...PROJECT, name: 'New name' });
    const { onSaved } = setup({ project: PROJECT });

    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'New name' } });
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ ...PROJECT, name: 'New name' }));
    expect(updateProject).toHaveBeenCalledWith('proj-1', expect.objectContaining({ name: 'New name' }));
    expect(createProject).not.toHaveBeenCalled();
  });
});

describe('ProjectSetupPage, the budget question', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const budgetQuestion = () => screen.getByRole('group', { name: 'Do you have a budget for this project?' });

  /** From the basics, past every later step, to starting the project. */
  const startFromBasics = () => {
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: /Start project/ }));
  };

  it('asks it in the basics, with no amount until the answer is yes', () => {
    setup();
    toBasics();

    expect(budgetQuestion()).toBeInTheDocument();
    expect(screen.queryByLabelText('Amount')).not.toBeInTheDocument();

    fireEvent.click(within(budgetQuestion()).getByRole('radio', { name: 'Yes' }));
    expect(screen.getByLabelText('Amount')).toBeInTheDocument();
    expect(screen.getByLabelText('Currency')).toHaveValue('EUR');

    fireEvent.click(within(budgetQuestion()).getByRole('radio', { name: 'No' }));
    expect(screen.queryByLabelText('Amount')).not.toBeInTheDocument();
  });

  it('saves the amount and currency of a yes', async () => {
    createProject.mockResolvedValue({ id: 'proj-1', name: 'Riverside Greenway' });
    const { onSaved } = setup();

    toBasics();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Riverside Greenway' } });
    fireEvent.click(within(budgetQuestion()).getByRole('radio', { name: 'Yes' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '250 000' } });
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'SEK' } });
    startFromBasics();

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(saveProjectBudget).toHaveBeenCalledWith('proj-1', { hasBudget: true, amount: 250000, currency: 'SEK' });
  });

  it('starts in the currency where the organiser is', () => {
    setup({ accountLocation: 'Istanbul, Türkiye' });
    toBasics();
    fireEvent.click(within(budgetQuestion()).getByRole('radio', { name: 'Yes' }));

    expect(screen.getByLabelText('Currency')).toHaveValue('TRY');
  });

  it('follows the project to its place, until a currency is picked', async () => {
    createProject.mockResolvedValue({ id: 'proj-1', name: 'Riverside Greenway' });
    const { onSaved } = setup({ accountLocation: 'Istanbul, Türkiye' });

    toBasics();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Riverside Greenway' } });
    fireEvent.click(within(budgetQuestion()).getByRole('radio', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick the suggestion' }));
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: /Start project/ }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(saveProjectBudget).toHaveBeenCalledWith('proj-1', expect.objectContaining({ currency: 'SEK' }));
  });

  it('keeps a currency picked by hand, wherever the project is', async () => {
    createProject.mockResolvedValue({ id: 'proj-1', name: 'Riverside Greenway' });
    const { onSaved } = setup({ accountLocation: 'Istanbul, Türkiye' });

    toBasics();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Riverside Greenway' } });
    fireEvent.click(within(budgetQuestion()).getByRole('radio', { name: 'Yes' }));
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'TRY' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pick the suggestion' }));
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: /Start project/ }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(saveProjectBudget).toHaveBeenCalledWith('proj-1', expect.objectContaining({ currency: 'TRY' }));
  });

  it('saves a no', async () => {
    createProject.mockResolvedValue({ id: 'proj-1', name: 'Riverside Greenway' });
    const { onSaved } = setup();

    toBasics();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Riverside Greenway' } });
    fireEvent.click(within(budgetQuestion()).getByRole('radio', { name: 'No' }));
    startFromBasics();

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(saveProjectBudget).toHaveBeenCalledWith('proj-1', expect.objectContaining({ hasBudget: false }));
  });

  it('saves nothing when the question was skipped', async () => {
    createProject.mockResolvedValue({ id: 'proj-1', name: 'Riverside Greenway' });
    const { onSaved } = setup();

    toBasics();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Riverside Greenway' } });
    startFromBasics();

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(saveProjectBudget).not.toHaveBeenCalled();
  });

  it('will not go on with an amount that is not a number', () => {
    setup();
    toBasics();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Riverside Greenway' } });
    fireEvent.click(within(budgetQuestion()).getByRole('radio', { name: 'Yes' }));

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: 'lots' } });
    expect(screen.getByText(/Enter the amount as a number/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Next/ })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: /^Next/ })).toBeEnabled();
  });

  it('starts filled in when editing, and saves a change', async () => {
    readProjectBudget.mockResolvedValueOnce({ hasBudget: true, amount: 50000, currency: 'DKK' });
    updateProject.mockResolvedValue({ id: 'proj-1', name: 'Riverside Greenway' });
    setup({ project: { id: 'proj-1', name: 'Riverside Greenway', locations: [] } });

    expect(await screen.findByLabelText('Amount')).toHaveValue('50000');
    expect(screen.getByLabelText('Currency')).toHaveValue('DKK');
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '60000' } });
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    await waitFor(() => expect(saveProjectBudget)
      .toHaveBeenCalledWith('proj-1', { hasBudget: true, amount: 60000, currency: 'DKK' }));
  });

  it('never saves over a budget that could not be loaded', async () => {
    readProjectBudget.mockRejectedValueOnce(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    updateProject.mockResolvedValue({ id: 'proj-1', name: 'Riverside Greenway' });
    const { onSaved } = setup({ project: { id: 'proj-1', name: 'Riverside Greenway', locations: [] } });

    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(saveProjectBudget).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Do you have a budget for this project?' })).not.toBeInTheDocument();
  });
});

describe('parseBudgetAmount', () => {
  it('reads a plain or grouped amount, whichever way round it is written', () => {
    expect(parseBudgetAmount('250000')).toBe(250000);
    expect(parseBudgetAmount(' 250 000 ')).toBe(250000);
    expect(parseBudgetAmount('250,000')).toBe(250000);
    expect(parseBudgetAmount('1,250.50')).toBe(1250.5);
    expect(parseBudgetAmount('250.000')).toBe(250000);
    expect(parseBudgetAmount('1.250,50')).toBe(1250.5);
    expect(parseBudgetAmount('1250,50')).toBe(1250.5);
    expect(parseBudgetAmount('1250.50')).toBe(1250.5);
  });

  it('is null when left empty, and NaN when it is not an amount', () => {
    expect(parseBudgetAmount('')).toBeNull();
    expect(parseBudgetAmount('lots')).toBeNaN();
    expect(parseBudgetAmount('-5')).toBeNaN();
    expect(parseBudgetAmount('1,2,3')).toBeNaN();
    expect(parseBudgetAmount('€500')).toBeNaN();
  });
});

describe('ProjectSetupPage, public or private', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('is public unless the organiser makes it private', async () => {
    createProject.mockResolvedValue({ id: 'proj-1', name: 'Riverside Greenway' });
    const { onSaved } = setup();

    toBasics();
    const visibility = screen.getByRole('switch', { name: 'Visibility' });
    expect(visibility).toBeChecked();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Riverside Greenway' } });
    fireEvent.click(visibility);
    expect(visibility).not.toBeChecked();
    expect(screen.getByText(/Only you, your collaborators/)).toBeInTheDocument();
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: /Start project/ }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createProject).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'private' }));
  });

  it('can be changed when editing', async () => {
    updateProject.mockResolvedValue({ id: 'proj-1', name: 'Riverside Greenway' });
    setup({ project: { id: 'proj-1', name: 'Riverside Greenway', locations: [], visibility: 'private' } });

    const visibility = screen.getByRole('switch', { name: 'Visibility' });
    expect(visibility).not.toBeChecked();
    fireEvent.click(visibility);
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    await waitFor(() => expect(updateProject).toHaveBeenCalledWith('proj-1', expect.objectContaining({ visibility: 'public' })));
  });
});

describe('ProjectSetupPage, Idea Visualizer', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  /** Through to the tools step of a new project placed at the picked address. */
  const toTools = () => {
    toBasics();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Riverside Greenway' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pick the suggestion' }));
    next();
  };

  it('is only chosen here, and configured from the dashboard afterwards', async () => {
    createProject.mockResolvedValue({ id: 'proj-1', name: 'Riverside Greenway' });
    const { onSaved } = setup();
    toTools();
    fireEvent.click(screen.getByRole('button', { name: /Idea Visualizer/ }));

    expect(screen.queryByLabelText('Location *')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Next/ })).toBeEnabled();
    next();
    fireEvent.click(screen.getByRole('button', { name: /Start project/ }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(saveProjectTools).toHaveBeenCalledWith('proj-1', ['reimagine-a-space'], 'user-1');
    expect(saveProjectToolConfig).not.toHaveBeenCalled();
  });
});

describe('ProjectSetupPage, photos beside the header image', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const photo = (n) => ({ path: `gallery/proj-1/photo-${n}.webp`, url: `https://media.test/gallery/proj-1/photo-${n}.webp` });
  const withPhotos = (...ns) => ({
    id: 'proj-1', ownerId: 'user-1', ownerName: 'Mara Quinn', name: 'Riverside Greenway',
    description: '', locations: [], address: '',
    galleryPaths: ns.map((n) => photo(n).path), gallery: ns.map(photo),
  });
  const file = (name) => new File(['x'], name, { type: 'image/jpeg' });

  it('are not offered until the project is started, since its id names their folder', () => {
    setup();
    toBasics();

    expect(screen.queryByText('Gallery Images')).not.toBeInTheDocument();
  });

  it('adds several at once, after the ones already there', async () => {
    uploadProjectGalleryImage.mockResolvedValueOnce('gallery/proj-1/photo-2.webp')
      .mockResolvedValueOnce('gallery/proj-1/photo-3.webp');
    updateProject.mockResolvedValueOnce(withPhotos(1, 2, 3));
    setup({ project: withPhotos(1) });
    fireEvent.click(screen.getByRole('tab', { name: 'Images and Media' }));

    const input = screen.getByText('Add photos').querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file('a.jpg'), file('b.jpg')] } });

    await waitFor(() => expect(updateProject).toHaveBeenCalledWith('proj-1', { galleryPaths: [
      'gallery/proj-1/photo-1.webp', 'gallery/proj-1/photo-2.webp', 'gallery/proj-1/photo-3.webp',
    ] }));
    expect(await screen.findByText(/^3 of 12/)).toBeInTheDocument();
  });

  it('can be dragged into order, from the keyboard as well as with a pointer', () => {
    setup({ project: withPhotos(1, 2) });
    fireEvent.click(screen.getByRole('tab', { name: 'Images and Media' }));

    const handle = screen.getByRole('button', { name: 'Photo 1 of 2, drag to reorder' });
    expect(handle).toHaveAttribute('aria-roledescription', 'sortable');
    expect(handle).toHaveAttribute('tabindex', '0');
    expect(screen.getByText(/drag to reorder/)).toBeInTheDocument();
  });

  it('moves one later', async () => {
    updateProject.mockResolvedValueOnce(withPhotos(2, 1));
    setup({ project: withPhotos(1, 2) });
    fireEvent.click(screen.getByRole('tab', { name: 'Images and Media' }));

    expect(screen.getByRole('button', { name: 'Move photo 1 earlier' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Move photo 1 later' }));

    await waitFor(() => expect(updateProject).toHaveBeenCalledWith('proj-1',
      { galleryPaths: ['gallery/proj-1/photo-2.webp', 'gallery/proj-1/photo-1.webp'] }));
  });

  it('removes one, and deletes its file once nothing points at it', async () => {
    updateProject.mockResolvedValueOnce(withPhotos(2));
    setup({ project: withPhotos(1, 2) });
    fireEvent.click(screen.getByRole('tab', { name: 'Images and Media' }));

    fireEvent.click(screen.getByRole('button', { name: 'Remove photo 1' }));

    await waitFor(() => expect(removeProjectImageFile).toHaveBeenCalledWith('gallery/proj-1/photo-1.webp'));
    expect(updateProject).toHaveBeenCalledWith('proj-1', { galleryPaths: ['gallery/proj-1/photo-2.webp'] });
  });

  it('shows a photo on its own straight away, and takes it out of that when it is removed', async () => {
    const standalone = { ...withPhotos(1, 2), galleryStandalone: ['gallery/proj-1/photo-2.webp'] };
    updateProject.mockResolvedValueOnce(standalone).mockResolvedValueOnce(withPhotos(1));
    setup({ project: withPhotos(1, 2) });
    fireEvent.click(screen.getByRole('tab', { name: 'Images and Media' }));

    fireEvent.click(screen.getByRole('checkbox', { name: 'Show photo 2 on its own' }));
    await waitFor(() => expect(updateProject).toHaveBeenCalledWith('proj-1',
      { galleryStandalone: ['gallery/proj-1/photo-2.webp'] }));

    fireEvent.click(await screen.findByRole('button', { name: 'Remove photo 2' }));
    await waitFor(() => expect(updateProject).toHaveBeenLastCalledWith('proj-1',
      { galleryPaths: ['gallery/proj-1/photo-1.webp'], galleryStandalone: [] }));
  });

  it('adds only as many as there is room for, and says so', async () => {
    const eleven = withPhotos(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11);
    uploadProjectGalleryImage.mockResolvedValueOnce('gallery/proj-1/photo-12.webp');
    updateProject.mockResolvedValueOnce(withPhotos(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12));
    setup({ project: eleven });
    fireEvent.click(screen.getByRole('tab', { name: 'Images and Media' }));

    const input = screen.getByText('Add photos').querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file('a.jpg'), file('b.jpg')] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('only one more was added');
    expect(uploadProjectGalleryImage).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Add photos')).not.toBeInTheDocument();
  });

  it('saves a caption for each photo with Save changes, keyed by the photo', async () => {
    updateProject.mockResolvedValue(withPhotos(1, 2));
    setup({ project: { ...withPhotos(1, 2), galleryCaptions: {
      'gallery/proj-1/photo-1.webp': 'Before', 'gallery/proj-1/photo-gone.webp': 'Taken out',
    } } });
    fireEvent.click(screen.getByRole('tab', { name: 'Images and Media' }));

    expect(screen.getByRole('textbox', { name: 'Caption for photo 1' })).toHaveValue('Before');
    fireEvent.change(screen.getByRole('textbox', { name: 'Caption for photo 1' }), { target: { value: '  ' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Caption for photo 2' }),
      { target: { value: ' The underpass, 2019 ' } });
    expect(updateProject).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    await waitFor(() => expect(updateProject).toHaveBeenCalledWith('proj-1', expect.objectContaining({
      galleryCaptions: { 'gallery/proj-1/photo-2.webp': 'The underpass, 2019' },
    })));
  });
});

describe('ProjectSetupPage, arranging the project\'s page', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const POLL = { id: 'room-1', tool: 'open-vote', config: { question: 'Car-free?' } };
  const PROJECT = {
    id: 'proj-1', ownerId: 'user-1', ownerName: 'Mara Quinn', name: 'Riverside Greenway',
    summary: 'A park on the old rail line.', description: 'Ask who uses it.', locations: [], address: '',
    gallery: [], galleryPaths: [], pageLayout: [],
  };
  const sectionNames = () => within(screen.getByRole('list', { name: 'Page sections' }))
    .getAllByRole('textbox').map((field) => field.value || field.placeholder);

  beforeEach(() => {
    readProjectTools.mockResolvedValue(['open-vote']);
    readProjectOpenRooms.mockResolvedValue([POLL]);
    readConfiguredProjectTools.mockResolvedValue(new Set());
    updateProject.mockImplementation((id, patch) => Promise.resolve({ ...PROJECT, ...patch }));
  });

  it('lists the sections the page has, in its order, each under its title', async () => {
    setup({ project: { ...PROJECT, pageLayout: [{ key: 'room:room-1', title: 'Car-free square?' }] } });
    fireEvent.click(screen.getByRole('tab', { name: 'Page Layout' }));

    await screen.findByRole('list', { name: 'Page sections' });
    expect(sectionNames()).toEqual(['Car-free square?', 'About the project', 'Goals']);
  });

  it('saves a new order and a new title with the rest of the changes', async () => {
    setup({ project: PROJECT });
    fireEvent.click(screen.getByRole('tab', { name: 'Page Layout' }));
    await screen.findByRole('list', { name: 'Page sections' });

    fireEvent.click(screen.getByRole('button', { name: 'Move We want your opinion up' }));
    fireEvent.change(screen.getByPlaceholderText('We want your opinion'), { target: { value: 'Car-free square?' } });
    expect(sectionNames()).toEqual(['About the project', 'Car-free square?', 'Goals']);
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    await waitFor(() => expect(updateProject).toHaveBeenCalledWith('proj-1', expect.objectContaining({
      pageLayout: [{ key: 'about' }, { key: 'room:room-1', title: 'Car-free square?' }, { key: 'goals' }],
    })));
  });

  it('hides a title, and lists a photo on its own with its title hidden to begin with', async () => {
    const photo = { path: 'gallery/proj-1/photo-1.webp', url: 'https://media.test/photo-1.webp', standalone: true };
    setup({ project: { ...PROJECT, gallery: [photo], galleryPaths: [photo.path], galleryStandalone: [photo.path] } });
    fireEvent.click(screen.getByRole('tab', { name: 'Page Layout' }));
    const list = within(await screen.findByRole('list', { name: 'Page sections' }));

    expect(list.getByText(/A photo on its own/)).toBeInTheDocument();
    const boxes = list.getAllByRole('checkbox', { name: 'Hide title' });
    expect(boxes.map((box) => box.checked)).toEqual([false, false, true, false]);
    fireEvent.click(boxes[1]);
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    await waitFor(() => expect(updateProject).toHaveBeenCalledWith('proj-1', expect.objectContaining({
      pageLayout: [{ key: 'about' }, { key: 'goals', hideTitle: true }, { key: `photo:${photo.path}` },
        { key: 'room:room-1' }],
    })));
  });

  it('goes back to the usual title when one is emptied', async () => {
    setup({ project: { ...PROJECT, pageLayout: [{ key: 'goals', title: 'What we want' }] } });
    fireEvent.click(screen.getByRole('tab', { name: 'Page Layout' }));
    await screen.findByRole('list', { name: 'Page sections' });

    fireEvent.change(screen.getByDisplayValue('What we want'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    await waitFor(() => expect(updateProject).toHaveBeenCalledWith('proj-1', expect.objectContaining({
      pageLayout: [{ key: 'goals' }, { key: 'about' }, { key: 'room:room-1' }],
    })));
  });

  it('never saves over the order when the page could not be loaded', async () => {
    readProjectOpenRooms.mockRejectedValue(new Error('offline'));
    setup({ project: PROJECT });
    fireEvent.click(screen.getByRole('tab', { name: 'Page Layout' }));

    await waitFor(() => expect(readProjectOpenRooms).toHaveBeenCalled());
    expect(screen.queryByRole('list', { name: 'Page sections' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    await waitFor(() => expect(updateProject).toHaveBeenCalled());
    expect(updateProject.mock.calls[0][1]).not.toHaveProperty('pageLayout');
  });

  it('can be dragged, from the keyboard as well as with a pointer', async () => {
    setup({ project: PROJECT });
    fireEvent.click(screen.getByRole('tab', { name: 'Page Layout' }));

    const handle = await screen.findByRole('button', { name: 'Drag About the project to reorder' });
    expect(handle).toHaveAttribute('aria-roledescription', 'sortable');
  });
});
