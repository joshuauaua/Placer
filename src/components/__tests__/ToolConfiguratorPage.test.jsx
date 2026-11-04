import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { ToolConfiguratorPage, configuredToolIdFrom } from '../ToolConfiguratorPage';
import { THEME } from '../../theme';
import { listStartedTools, saveStartedTool } from '../../services/startedTools';
import { addCollaborator, isSupabaseConfigured, readCollaborators, readProjectCrumb } from '../../services/projects';

// Only what the top bar reads, for the project's name; with no Supabase project, as
// in a clean checkout, there is none.
vi.mock('../../services/projects', async (importOriginal) => ({
  ...(await importOriginal()),
  isSupabaseConfigured: vi.fn(() => false),
  readProjectCrumb: vi.fn(() => Promise.resolve(null)),
  readCollaborators: vi.fn(() => Promise.resolve([])),
  addCollaborator: vi.fn(() => Promise.resolve({ success: true })),
}));

// The Poll's question, as its setup form in the Configuration panel labels it.
const QUESTION_LABEL = 'The question';
const panelQuestion = () => within(screen.getByRole('complementary', { name: 'Configuration' })).getByLabelText(QUESTION_LABEL);

function renderAt(path, Page = ToolConfiguratorPage, props = {}) {
  const location = memoryLocation({ path, record: true });
  const result = render(
    <Router hook={location.hook}>
      <Page t={THEME} {...props} />
    </Router>
  );
  return { ...result, location };
}

describe('configuredToolIdFrom', () => {
  it('reads the tool from /toolkit/<id>/configure and nothing else', () => {
    expect(configuredToolIdFrom('/toolkit/word-cloud/configure')).toBe('word-cloud');
    expect(configuredToolIdFrom('/toolkit/word-cloud')).toBeNull();
    expect(configuredToolIdFrom('/toolkit/word-cloud/configure/more')).toBeNull();
  });
});

describe('ToolConfiguratorPage', () => {
  it('has a top bar with the tool, Preview and Publish, a canvas, and the tool’s own configuration', () => {
    renderAt('/toolkit/budget-ballot/configure');

    const bar = screen.getByRole('banner', { name: 'Configure a tool' });
    expect(within(bar).getByRole('textbox', { name: 'Tool name' })).toHaveValue('Co-Budget');
    // Its name only: the category is not shown here.
    expect(within(bar).queryByText('Plan')).toBeNull();
    expect(within(bar).getAllByRole('button').map((b) => b.getAttribute('aria-label')))
      .toEqual(['Back to the dashboard', 'Add a collaborator', 'Tool settings', 'Preview', 'Publish']);

    expect(screen.getByRole('main', { name: 'Canvas' })).toBeInTheDocument();
    const panel = screen.getByRole('complementary', { name: 'Configuration' });
    expect(within(panel).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Budget', 'Posts']);
  });

  it('shows the setup on the canvas as it changes, and what is wrong with it while it cannot be used', () => {
    renderAt('/toolkit/budget-ballot/configure');
    const canvas = screen.getByRole('main', { name: 'Canvas' });
    const budget = screen.getByLabelText('Total budget');

    fireEvent.change(budget, { target: { value: '90000' } });
    expect(within(canvas).getAllByText('€90,000').length).toBeGreaterThan(0);

    fireEvent.change(budget, { target: { value: '' } });
    expect(screen.getByText(/Set a budget as a whole number/)).toBeInTheDocument();
    // The canvas keeps the last setup the tool would take rather than an unusable one.
    expect(within(canvas).getAllByText('€90,000').length).toBeGreaterThan(0);
  });

  it('has no Slides panel for a tool that runs as one', () => {
    renderAt('/toolkit/budget-ballot/configure');

    expect(screen.queryByRole('navigation', { name: 'Slides' })).toBeNull();
  });

  it('starts a tool with slides on one, and each slide added keeps a setup of its own', () => {
    renderAt('/toolkit/open-vote/configure');
    const slides = screen.getByRole('navigation', { name: 'Slides' });
    const question = panelQuestion;

    expect(within(slides).getAllByRole('button', { name: /^Slide \d$/ })).toHaveLength(1);
    // Nothing to remove while there is only one.
    expect(within(slides).queryByRole('button', { name: /^Remove/ })).toBeNull();
    fireEvent.change(question(), { target: { value: 'Trees or benches?' } });

    fireEvent.click(within(slides).getByRole('button', { name: 'Add slide' }));
    expect(within(slides).getByRole('button', { name: 'Slide 2' })).toHaveAttribute('aria-current', 'true');
    expect(question()).not.toHaveValue('Trees or benches?');
    fireEvent.change(question(), { target: { value: 'More light?' } });

    fireEvent.click(within(slides).getByRole('button', { name: 'Slide 1' }));
    expect(question()).toHaveValue('Trees or benches?');
    fireEvent.click(within(slides).getByRole('button', { name: 'Slide 2' }));
    expect(question()).toHaveValue('More light?');
  });

  it('removes a slide, putting the one before it on the canvas', () => {
    renderAt('/toolkit/open-vote/configure');
    const slides = screen.getByRole('navigation', { name: 'Slides' });

    fireEvent.change(panelQuestion(), { target: { value: 'Trees or benches?' } });
    fireEvent.click(within(slides).getByRole('button', { name: 'Add slide' }));
    fireEvent.click(within(slides).getByRole('button', { name: 'Remove slide 2' }));

    expect(within(slides).getAllByRole('button', { name: /^Slide \d$/ })).toHaveLength(1);
    expect(within(slides).getByRole('button', { name: 'Slide 1' })).toHaveAttribute('aria-current', 'true');
    expect(panelQuestion()).toHaveValue('Trees or benches?');
  });

  it('keeps a tool once something in it changes, not before, and gives its address the id', () => {
    localStorage.clear();
    const { location } = renderAt('/toolkit/open-vote/configure', ToolConfiguratorPage, { accountId: 'acc' });
    expect(listStartedTools('acc')).toEqual([]);

    fireEvent.change(panelQuestion(), { target: { value: 'Trees or benches?' } });
    const [kept] = listStartedTools('acc');
    expect(kept.tool).toBe('open-vote');
    expect(kept.slides[0].setup.question).toBe('Trees or benches?');
    expect(location.history.at(-1)).toBe(`/toolkit/open-vote/configure?draft=${kept.id}`);
  });

  it('opens a started tool again from its id, slides and all', () => {
    localStorage.clear();
    saveStartedTool('acc', { id: 'poll-1', tool: 'open-vote', slides: [
      { id: 's1', setup: { question: 'Trees or benches?', answers: ['Trees', 'Benches'] } },
      { id: 's2', setup: { question: 'More light?', answers: ['Yes', 'No'] } },
    ] });
    renderAt('/toolkit/open-vote/configure?draft=poll-1', ToolConfiguratorPage, { accountId: 'acc' });

    expect(within(screen.getByRole('navigation', { name: 'Slides' })).getAllByRole('button', { name: /^Slide \d$/ }))
      .toHaveLength(2);
    expect(panelQuestion()).toHaveValue('Trees or benches?');
  });

  it('says when a tool has nothing to configure', () => {
    renderAt('/toolkit/fifteen-minute/configure');

    expect(screen.getByText(/nothing to configure/)).toBeInTheDocument();
  });

  it('shows the collaborators’ avatars in the top bar: for now, whoever is signed in', () => {
    renderAt('/toolkit/word-cloud/configure', ToolConfiguratorPage, { profile: { id: 'p1', name: 'Ada Lovelace' } });

    const bar = screen.getByRole('banner', { name: 'Configure a tool' });
    expect(within(bar).getByRole('group', { name: 'Collaborators: Ada Lovelace' })).toHaveTextContent('AL');
  });

  it('has no avatars with nobody signed in', () => {
    renderAt('/toolkit/word-cloud/configure');

    expect(screen.queryByRole('group', { name: /Collaborators/ })).toBeNull();
  });

  it('opens the tool’s settings from the three dots, each saying it is not built yet', () => {
    renderAt('/toolkit/word-cloud/configure');
    const dots = screen.getByRole('button', { name: 'Tool settings' });

    fireEvent.click(dots);
    expect(dots).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent))
      .toEqual(['Rename', 'Duplicate', 'Manage collaborators', 'Delete tool']);

    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete tool' }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Delete tool is not built yet.');

    fireEvent.click(dots);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('says Publish is not built yet', () => {
    renderAt('/toolkit/word-cloud/configure');

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(screen.getByRole('status')).toHaveTextContent('Publishing is not built yet.');
  });

  it('previews the slide on a desktop and a phone, side by side, and closes', () => {
    renderAt('/toolkit/word-cloud/configure');
    fireEvent.change(screen.getByLabelText('The prompt'), { target: { value: 'One word for the square?' } });

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    const dialog = screen.getByRole('dialog', { name: 'Preview: Word Cloud' });
    const desktop = within(dialog).getByTitle('Desktop preview');
    const phone = within(dialog).getByTitle('Phone preview');
    expect(desktop).toHaveAttribute('src', '/toolkit/word-cloud/preview-frame');
    expect(desktop).toHaveAttribute('width', '1280');
    expect(phone).toHaveAttribute('width', '390');
    // Desktop first, on the left.
    expect(desktop.compareDocumentPosition(phone) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The frames read the slide off the opening window.
    expect(window.__placerToolPreview).toEqual({ toolId: 'word-cloud',
      setup: expect.objectContaining({ prompt: 'One word for the square?' }) });

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Preview: Word Cloud' })).toBeNull();
  });

  it('goes back to the dashboard, and offers it for a tool that does not exist', () => {
    const { location } = renderAt('/toolkit/no-such-tool/configure');

    expect(screen.getByText('There is no tool here to configure.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back to the dashboard' }));
    expect(location.history.at(-1)).toBe('/dashboard');
  });
});

describe('ToolConfiguratorPage, its top bar', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(isSupabaseConfigured).mockReturnValue(false);
    vi.mocked(readProjectCrumb).mockResolvedValue(null);
  });

  const nameField = () => screen.getByRole('textbox', { name: 'Tool name' });

  it('lets this tool be renamed, keeps the name, and goes back to the tool\'s own when emptied', () => {
    renderAt('/toolkit/open-vote/configure', ToolConfiguratorPage, { accountId: 'acc' });

    fireEvent.change(nameField(), { target: { value: '  Tuesday workshop poll ' } });
    fireEvent.blur(nameField());
    expect(nameField()).toHaveValue('Tuesday workshop poll');
    expect(listStartedTools('acc')[0].name).toBe('Tuesday workshop poll');

    fireEvent.change(nameField(), { target: { value: '   ' } });
    fireEvent.keyDown(nameField(), { key: 'Enter' });
    fireEvent.blur(nameField());
    expect(nameField()).toHaveValue('Poll');
    expect(listStartedTools('acc')[0].name).toBeNull();
  });

  it('says when the tool is not in a project', () => {
    renderAt('/toolkit/open-vote/configure');

    expect(screen.getByRole('banner', { name: 'Configure a tool' })).toHaveTextContent('Not in a project');
  });

  it('names the project it was added to, under its own name, and keeps it with the tool', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(readProjectCrumb).mockResolvedValue({ name: 'Möllan', canEdit: true });
    renderAt('/toolkit/open-vote/configure?project=proj-1', ToolConfiguratorPage, { accountId: 'acc' });

    expect(await screen.findByText('In Möllan')).toBeInTheDocument();
    expect(readProjectCrumb).toHaveBeenCalledWith('proj-1');
    fireEvent.click(screen.getByRole('switch', { name: /Live/ }));
    expect(listStartedTools('acc')[0].projectId).toBe('proj-1');
  });

  it('runs a tool for a group Live to begin with, and switches it to Self-paced', () => {
    renderAt('/toolkit/open-vote/configure', ToolConfiguratorPage, { accountId: 'acc' });
    const live = screen.getByRole('switch', { name: /Live/ });

    expect(live).toHaveAttribute('aria-checked', 'true');
    expect(live).toHaveTextContent('With a group');
    fireEvent.click(live);
    expect(live).toHaveAttribute('aria-checked', 'false');
    expect(live).toHaveTextContent('Self-paced, by link');
    expect(listStartedTools('acc')[0].live).toBe(false);
  });

  it('starts a tool with no room Self-paced', () => {
    renderAt('/toolkit/street-mixer/configure');

    expect(screen.getByRole('switch', { name: /Live/ })).toHaveAttribute('aria-checked', 'false');
  });

  it('opens a kept tool with its name, project and setting', () => {
    saveStartedTool('acc', { id: 'poll-9', tool: 'open-vote', name: 'Market vote', projectId: null, live: false,
      slides: [{ id: 's1', setup: { question: 'Trees?', answers: ['Yes', 'No'] } }] });
    renderAt('/toolkit/open-vote/configure?draft=poll-9', ToolConfiguratorPage, { accountId: 'acc' });

    expect(nameField()).toHaveValue('Market vote');
    expect(screen.getByRole('switch', { name: /Live/ })).toHaveAttribute('aria-checked', 'false');
  });
});

describe('ToolConfiguratorPage, its canvas', () => {
  beforeEach(() => localStorage.clear());

  it('is a live preview, with nothing in it to use', () => {
    renderAt('/toolkit/word-cloud/configure');
    const canvas = screen.getByRole('main', { name: 'Canvas' });

    // No label on it: the preview speaks for itself.
    expect(within(canvas).queryByText('Live preview')).toBeNull();
    expect(canvas.querySelector('.placer-configurator-frame')).toHaveAttribute('inert');
  });

  it('never shows a tool\'s own editors, even before its setup is one it would take', () => {
    renderAt('/toolkit/word-cloud/configure');
    const canvas = screen.getByRole('main', { name: 'Canvas' });

    // Word Cloud, handed no setup, offers its own prompt and timer to fill in.
    expect(within(canvas).queryByPlaceholderText('One word for this place?')).toBeNull();
    expect(within(canvas).queryByRole('combobox')).toBeNull();
  });
});

describe('ToolConfiguratorPage, Word Cloud\'s slide', () => {
  beforeEach(() => localStorage.clear());

  it('shows only the cloud, titled with the question, and nothing else of the tool', () => {
    renderAt('/toolkit/word-cloud/configure');
    const canvas = screen.getByRole('main', { name: 'Canvas' });
    // Before there is a question, the one suggested for it holds its place.
    expect(within(canvas).getByRole('heading', { level: 2, name: 'What do you want to find out?' })).toBeInTheDocument();
    // On the frame's card itself, with no card of its own inside it.
    const slide = within(canvas).getByRole('region', { name: 'Word cloud' });
    expect(slide.style.boxShadow).toBe('');
    expect(slide.style.border).toBe('');

    fireEvent.change(screen.getByLabelText('The prompt'), { target: { value: 'One word for the square?' } });

    expect(within(canvas).getByRole('heading', { level: 2, name: 'One word for the square?' })).toBeInTheDocument();
    for (const gone of ['Your cloud', 'Add your words', 'Answers', 'How it works']) {
      expect(within(canvas).queryByText(gone)).toBeNull();
    }
    expect(within(canvas).queryByRole('button', { name: /full screen/i })).toBeNull();
    expect(within(canvas).queryByText(/on your profile/i)).toBeNull();
  });
});

describe('ToolConfiguratorPage, Word Cloud\'s configuration', () => {
  beforeEach(() => localStorage.clear());

  it('is just the prompt\'s field, under PROMPT, then Words per person and Timer', () => {
    renderAt('/toolkit/word-cloud/configure');
    const panel = within(screen.getByRole('complementary', { name: 'Configuration' }));

    expect(panel.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Prompt']);
    const prompt = panel.getByRole('textbox', { name: 'The prompt' });
    expect(prompt).toHaveAttribute('placeholder', 'What do you want to find out?');
    expect(panel.getByLabelText('Words per person')).toBeInTheDocument();
    expect(panel.getByLabelText('Timer')).toBeInTheDocument();
    for (const gone of [/shown above the cloud/, /sharpest cloud/, /nobody can add more words/]) {
      expect(panel.queryByText(gone)).toBeNull();
    }
  });
});

describe('ToolConfiguratorPage, adding a collaborator', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(isSupabaseConfigured).mockReturnValue(false);
    vi.mocked(readProjectCrumb).mockResolvedValue(null);
  });

  it('says collaborators join through a project, for a tool that is not in one', () => {
    renderAt('/toolkit/open-vote/configure');

    fireEvent.click(screen.getByRole('button', { name: 'Add a collaborator' }));

    expect(screen.getByRole('dialog', { name: 'Invite a collaborator' }))
      .toHaveTextContent('Collaborators join through a project');
    expect(screen.queryByRole('textbox', { name: 'Their email' })).toBeNull();
  });

  it('invites somebody to the tool\'s project by email', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(readProjectCrumb).mockResolvedValue({ name: 'Möllan', canEdit: true });
    vi.mocked(readCollaborators).mockResolvedValue([]);
    vi.mocked(addCollaborator).mockResolvedValue({ success: true });
    renderAt('/toolkit/open-vote/configure?project=proj-1');
    await screen.findByText('In Möllan');

    fireEvent.click(screen.getByRole('button', { name: 'Add a collaborator' }));
    const dialog = screen.getByRole('dialog', { name: 'Invite a collaborator' });
    expect(dialog).toHaveTextContent('They join Möllan');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Their email' }), { target: { value: 'Ines@Example.org' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Invite' }));

    expect(await within(dialog).findByRole('status')).toHaveTextContent('Invited ines@example.org');
    expect(addCollaborator).toHaveBeenCalledWith('proj-1', 'ines@example.org');
  });

  it('shows the project\'s collaborators among the avatars', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(readProjectCrumb).mockResolvedValue({ name: 'Möllan', canEdit: true });
    vi.mocked(readCollaborators).mockResolvedValue([{ userId: 'u-2', displayName: 'Ines Berg', email: 'ines@example.org' }]);
    renderAt('/toolkit/open-vote/configure?project=proj-1', ToolConfiguratorPage,
      { accountId: 'u-1', profile: { id: 'u-1', name: 'Mara Quinn' } });

    expect(await screen.findByRole('group', { name: 'Collaborators: Mara Quinn, Ines Berg' })).toBeInTheDocument();
  });
});
