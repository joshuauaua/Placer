/* PLACER — one project, as a card that opens it. Shared by the profile and the
 * Projects page, which both list the projects an account owns or collaborates on. */

export function ProjectCard({ t, project, onOpen }) {
  return (
    <button onClick={() => onOpen(project.id)} style={{ textAlign: 'left', padding: 20,
      background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12, boxShadow: t.shadow,
      cursor: 'pointer', fontFamily: 'var(--placer-font)', overflow: 'hidden' }}>
      {/* Edge to edge across the top, so the negative margins undo the card's padding. */}
      {project.image && (
        <img src={project.image} alt="" style={{ display: 'block', width: 'calc(100% + 40px)',
          margin: '-20px -20px 16px', aspectRatio: '16 / 9', objectFit: 'cover' }} />
      )}
      <h3 style={{ fontSize: 17, fontWeight: 700, color: t.ink, marginBottom: 6 }}>{project.name}</h3>
      {project.description && (
        <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {project.description}
        </p>
      )}
    </button>
  );
}

export default ProjectCard;
