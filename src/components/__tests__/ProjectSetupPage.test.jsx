import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ProjectSetupPage } from '../ProjectSetupPage';
import { createProject, readProjectTools, saveProjectTools, updateProject } from '../../services/projects';
import { THEME } from '../../theme';
import { TOOLS } from '../../toolkit/tools';

vi.mock('../../services/projects', async (importOriginal) => ({
  // The real PROJECT_TYPES, so the choices on screen are the ones that ship.
  PROJECT_TYPES: (await importOriginal()).PROJECT_TYPES,
  createProject: vi.fn(),
  updateProject: vi.fn(),
  readProjectTools: vi.fn(() => Promise.resolve([])),
  saveProjectTools: vi.fn((projectId, tools) => Promise.resolve(tools)),
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

    expect(screen.getByRole('heading', { level: 1, name: 'Start a project' })).toBeInTheDocument();
    expect(screen.getByText(/brings people together around a place/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Name *')).not.toBeInTheDocument();
  });

  it('asks what kind of project it is, and will not go on without an answer', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Create a new project/ }));

    expect(screen.getByText('Step 2 of 6 · Project type')).toBeInTheDocument();
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

  it('goes back a step without losing what was filled in', () => {
    setup();
    toBasics();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Riverside Greenway' } });

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('radio', { name: /I have a say over a place/ })).toBeChecked();
    next();

    expect(screen.getByLabelText('Name *')).toHaveValue('Riverside Greenway');
  });

  it('starts a project with what was filled in across the six steps', async () => {
    createProject.mockResolvedValue({ id: 'proj-1', name: 'Riverside Greenway' });
    const { onSaved } = setup();

    toBasics();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Riverside Greenway' } });
    fireEvent.change(screen.getByLabelText('Goals'), { target: { value: 'Turn the old rail corridor into a park.' } });
    next();
    expect(screen.getByText('Step 4 of 6 · The place')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pick the suggestion' }));
    next();
    expect(screen.getByText('Step 5 of 6 · Tools')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Budget Ballot/ }));
    fireEvent.click(screen.getByRole('button', { name: /Desire Lines/ }));
    next();
    expect(screen.getByText('Step 6 of 6 · An image')).toBeInTheDocument();
    expect(createProject).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Start project/ }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ id: 'proj-1', name: 'Riverside Greenway' }));
    expect(createProject).toHaveBeenCalledWith({
      ownerId: 'user-1', ownerName: 'Mara Quinn', name: 'Riverside Greenway',
      description: 'Turn the old rail corridor into a park.',
      startDate: null, endDate: null,
      address: 'Folkets Park, Amiralsgatan 35, Malmö', locationPoint: { lat: 55.59, lng: 13.01 },
      locations: ['Malmö, Sweden'],
      projectType: 'steward',
    });
    expect(saveProjectTools).toHaveBeenCalledWith('proj-1', ['budget-ballot', 'desire-lines'], 'user-1');
  });

  it('asks for the place as an address, with no outline to draw', () => {
    setup();
    toBasics();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Riverside Greenway' } });
    next();

    expect(screen.getByLabelText('Address')).toBeInTheDocument();
    expect(screen.queryByText('Location outline')).not.toBeInTheDocument();
  });

  it('keeps an address typed by hand, unpinned, as the place name', async () => {
    createProject.mockResolvedValue({ id: 'proj-1', name: 'Riverside Greenway' });
    setup();

    toBasics();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Riverside Greenway' } });
    next();
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
    next();

    const tools = within(screen.getByRole('list', { name: 'Toolkit tools' })).getAllByRole('button');
    expect(tools).toHaveLength(TOOLS.length);
    const ballot = screen.getByRole('button', { name: /Budget Ballot/ });
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
    next();
    fireEvent.click(screen.getByRole('button', { name: /Budget Ballot/ }));
    next();
    fireEvent.click(screen.getByRole('button', { name: /Start project/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('its tools could not be: network down');
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Budget Ballot/ })).toHaveAttribute('aria-pressed', 'true');

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

    expect(screen.getByText('Step 4 of 6 · The place')).toBeInTheDocument();
    expect(createProject).not.toHaveBeenCalled();
  });

  it('says so when starting the project fails', async () => {
    createProject.mockRejectedValue(new Error('name too long'));
    setup();

    toBasics();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'x'.repeat(200) } });
    next();
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

  it('starts filled in with the project already there, its tools included', async () => {
    readProjectTools.mockResolvedValueOnce(['open-vote']);
    setup({ project: PROJECT });

    expect(screen.getByLabelText('Name *')).toHaveValue('Riverside Greenway');
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-01-01');
    expect(screen.getByLabelText('Address')).toHaveValue('Folkets Park, Amiralsgatan 35, Malmö');
    expect(await screen.findByRole('button', { name: /Open Vote/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('radio', { name: /I want to push for change/ })).toBeChecked();
    expect(screen.getByRole('button', { name: /Save changes/ })).toBeInTheDocument();
  });

  it('is one page, with no cover or steps', () => {
    setup({ project: PROJECT });

    expect(screen.getByRole('heading', { level: 1, name: 'Edit project' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create a new project/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Step \d of 6/)).not.toBeInTheDocument();
  });

  it('keeps the place names of a project whose address was not touched', async () => {
    updateProject.mockResolvedValue(PROJECT);
    setup({ project: { ...PROJECT, address: '', locationPoint: null } });

    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    await waitFor(() => expect(updateProject).toHaveBeenCalled());
    expect(updateProject.mock.calls[0][1]).not.toHaveProperty('locations');
    expect(updateProject.mock.calls[0][1]).not.toHaveProperty('locationShapes');
  });

  it('saves a change to the tools', async () => {
    updateProject.mockResolvedValue(PROJECT);
    readProjectTools.mockResolvedValueOnce(['open-vote']);
    setup({ project: PROJECT });

    fireEvent.click(await screen.findByRole('button', { name: /Budget Ballot/ }));
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    await waitFor(() => expect(saveProjectTools).toHaveBeenCalledWith('proj-1', ['open-vote', 'budget-ballot'], 'user-1'));
  });

  it('never saves over the tools when they could not be loaded', async () => {
    updateProject.mockResolvedValue(PROJECT);
    readProjectTools.mockRejectedValueOnce(new Error('offline'));
    const { onSaved } = setup({ project: PROJECT });

    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(saveProjectTools).not.toHaveBeenCalled();
  });

  it('can change the kind of project', async () => {
    updateProject.mockResolvedValue(PROJECT);
    setup({ project: PROJECT });

    fireEvent.click(screen.getByRole('radio', { name: /Something else/ }));
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    await waitFor(() => expect(updateProject).toHaveBeenCalledWith('proj-1',
      expect.objectContaining({ projectType: 'other' })));
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
