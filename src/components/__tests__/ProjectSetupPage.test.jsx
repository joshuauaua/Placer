import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectSetupPage } from '../ProjectSetupPage';
import { createProject, updateProject } from '../../services/projects';
import { THEME } from '../../theme';

vi.mock('../../services/projects', async (importOriginal) => ({
  // The real PROJECT_TYPES, so the choices on screen are the ones that ship.
  PROJECT_TYPES: (await importOriginal()).PROJECT_TYPES,
  createProject: vi.fn(),
  updateProject: vi.fn(),
}));

// LocationMapPicker needs a real Google Maps script this suite has no business loading —
// its own tests cover it. Stubbed to a stand-in that just proves ProjectSetupPage wires
// its onChange through to the saved patch, the same way MapContainer's tests are stubbed
// out wherever they are not the thing under test.
vi.mock('../LocationMapPicker', () => ({
  LocationMapPicker: ({ onChange }) => (
    <button type="button" onClick={() => onChange([{ path: [{ lat: 1, lng: 2 }, { lat: 1, lng: 3 }, { lat: 2, lng: 3 }] }])}>
      Draw shape
    </button>
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
    fireEvent.change(screen.getByLabelText('Goals'), { target: { value: 'Turn the old rail corridor into a park.' } });
    next();
    expect(screen.getByText('Step 4 of 5 · The place')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Locations'), { target: { value: 'Malmö\nFolkets Park' } });
    fireEvent.click(screen.getByRole('button', { name: 'Draw shape' }));
    next();
    expect(screen.getByText('Step 5 of 5 · An image')).toBeInTheDocument();
    expect(createProject).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Start project/ }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ id: 'proj-1', name: 'Riverside Greenway' }));
    expect(createProject).toHaveBeenCalledWith({
      ownerId: 'user-1', ownerName: 'Mara Quinn', name: 'Riverside Greenway',
      description: 'Turn the old rail corridor into a park.',
      startDate: null, endDate: null, locations: ['Malmö', 'Folkets Park'],
      locationShapes: [{ path: [{ lat: 1, lng: 2 }, { lat: 1, lng: 3 }, { lat: 2, lng: 3 }] }],
      projectType: 'steward',
    });
  });

  it('moves on a step, rather than starting the project, when Enter is pressed in a field', () => {
    setup();
    toBasics();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Riverside Greenway' } });

    fireEvent.submit(screen.getByLabelText('Name *').closest('form'));

    expect(screen.getByText('Step 4 of 5 · The place')).toBeInTheDocument();
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
  };

  it('starts filled in with the project already there', () => {
    setup({ project: PROJECT });

    expect(screen.getByLabelText('Name *')).toHaveValue('Riverside Greenway');
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-01-01');
    expect(screen.getByLabelText('Locations')).toHaveValue('Malmö\nFolkets Park');
    expect(screen.getByRole('radio', { name: /I want to push for change/ })).toBeChecked();
    expect(screen.getByRole('button', { name: /Save changes/ })).toBeInTheDocument();
  });

  it('is one page, with no cover or steps', () => {
    setup({ project: PROJECT });

    expect(screen.getByRole('heading', { level: 1, name: 'Edit project' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create a new project/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Step \d of 5/)).not.toBeInTheDocument();
  });

  it('can change the kind of project', async () => {
    updateProject.mockResolvedValue(PROJECT);
    setup({ project: PROJECT });

    fireEvent.click(screen.getByRole('radio', { name: /Something else/ }));
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    await waitFor(() => expect(updateProject).toHaveBeenCalledWith('proj-1',
      expect.objectContaining({ projectType: 'other' })));
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
