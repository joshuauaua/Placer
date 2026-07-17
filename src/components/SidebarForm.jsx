import { useState } from 'react';
import { Btn } from './UI';

/**
 * SidebarForm Component
 *
 * Sidebar panel for imagination metadata and social interactions.
 * Allows users to add title, description, problems, and solutions.
 * Includes mock upvote, comment, and share functionality.
 *
 * Props:
 * - t: Theme object (from src/theme.js)
 * - imaginationData: Current imagination data
 * - onSave: Callback when user saves the imagination
 * - onUpvote: Callback when user upvotes
 * - onComment: Callback when user adds a comment
 * - onShare: Callback when user shares
 */
const SidebarForm = ({
  t,
  imaginationData = {},
  onSave,
  onUpvote,
  onComment,
  onShare
}) => {
  const [formData, setFormData] = useState({
    title: imaginationData.title || '',
    description: imaginationData.description || '',
    existingProblems: imaginationData.existingProblems || '',
    proposedSolution: imaginationData.proposedSolution || ''
  });

  const [commentText, setCommentText] = useState('');
  const [showCommentForm, setShowCommentForm] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    if (!formData.title.trim()) {
      alert('Please add a title for your imagination');
      return;
    }

    onSave({
      ...imaginationData,
      ...formData
    });
  };

  const handleAddComment = () => {
    if (!commentText.trim()) return;

    onComment({
      text: commentText,
      author: 'You'
    });

    setCommentText('');
    setShowCommentForm(false);
  };

  const upvoteCount = imaginationData.upvotes || 0;
  const comments = imaginationData.comments || [];

  const labelStyle = { display: 'block', fontSize: 14, fontWeight: 600, color: t.ink, marginBottom: 8 };
  const fieldStyle = {
    width: '100%', padding: '8px 16px', border: `1px solid ${t.line}`,
    borderRadius: 12, outline: 'none', background: t.surface, color: t.ink,
    fontFamily: "'Archivo', sans-serif", fontSize: 15, boxSizing: 'border-box'
  };

  return (
    <div style={{ width: '100%', maxWidth: 384, background: t.surface, boxShadow: t.shadow, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ background: t.primaryBg, color: t.primaryFg, padding: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>Your Imagination</h2>
        <p style={{ color: t.primaryFg, opacity: 0.7, fontSize: 14, marginTop: 4 }}>
          Add details about your placemaking vision
        </p>
      </div>

      {/* Form Content - Scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Title */}
        <div>
          <label style={labelStyle}>
            Title *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="e.g., Green Corner Park Redesign"
            style={fieldStyle}
          />
        </div>

        {/* Description */}
        <div>
          <label style={labelStyle}>
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Describe your vision for this space..."
            rows={4}
            style={{ ...fieldStyle, resize: 'none' }}
          />
        </div>

        {/* Existing Problems */}
        <div>
          <label style={labelStyle}>
            Existing Problems
          </label>
          <textarea
            value={formData.existingProblems}
            onChange={(e) => handleChange('existingProblems', e.target.value)}
            placeholder="What issues does this space currently have?"
            rows={3}
            style={{ ...fieldStyle, resize: 'none' }}
          />
        </div>

        {/* Proposed Solution */}
        <div>
          <label style={labelStyle}>
            Proposed Solution
          </label>
          <textarea
            value={formData.proposedSolution}
            onChange={(e) => handleChange('proposedSolution', e.target.value)}
            placeholder="How will your changes improve this space?"
            rows={3}
            style={{ ...fieldStyle, resize: 'none' }}
          />
        </div>

        {/* Social Interactions Section */}
        <div style={{ borderTop: `1px solid ${t.line}`, paddingTop: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: t.ink, marginBottom: 16 }}>Community</h3>

          {/* Upvote Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <Btn t={t} variant="accent" icon="arrowUp" onClick={onUpvote}>
              Upvote
            </Btn>
            <span style={{ fontSize: 24, fontWeight: 700, color: t.ink }}>
              {upvoteCount}
            </span>
          </div>

          {/* Comments Section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>
                Comments ({comments.length})
              </span>
              <button
                onClick={() => setShowCommentForm(!showCommentForm)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: t.accent, fontSize: 14, fontWeight: 600
                }}
              >
                {showCommentForm ? 'Cancel' : 'Add Comment'}
              </button>
            </div>

            {/* Comment Form */}
            {showCommentForm && (
              <div style={{ marginBottom: 16, padding: 12, background: t.surfaceAlt, borderRadius: 12, border: `1px solid ${t.line}` }}>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Share your thoughts..."
                  rows={3}
                  style={{ ...fieldStyle, resize: 'none', fontSize: 14, background: t.surface }}
                />
                <div style={{ marginTop: 8 }}>
                  <Btn t={t} size="sm" onClick={handleAddComment}>
                    Post Comment
                  </Btn>
                </div>
              </div>
            )}

            {/* Comments List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 256, overflowY: 'auto' }}>
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  style={{ padding: 12, background: t.surfaceAlt, borderRadius: 12, border: `1px solid ${t.line}` }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>
                      {comment.author}
                    </span>
                    <span style={{ fontSize: 12, color: t.inkFaint }}>
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, color: t.inkDim }}>{comment.text}</p>
                </div>
              ))}

              {comments.length === 0 && (
                <p style={{ fontSize: 14, color: t.inkFaint, textAlign: 'center', padding: '16px 0' }}>
                  No comments yet. Be the first to share your thoughts!
                </p>
              )}
            </div>
          </div>

          {/* Share Button */}
          <div style={{ marginTop: 16 }}>
            <Btn t={t} full icon="share" onClick={onShare}>
              Share Imagination
            </Btn>
          </div>
        </div>
      </div>

      {/* Footer - Fixed */}
      <div style={{ borderTop: `1px solid ${t.line}`, padding: 24, background: t.surfaceAlt }}>
        <Btn t={t} full size="lg" onClick={handleSave}>
          Save Imagination
        </Btn>
      </div>
    </div>
  );
};

export default SidebarForm;
