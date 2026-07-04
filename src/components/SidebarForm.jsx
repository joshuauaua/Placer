import { useState } from 'react';

/**
 * SidebarForm Component
 *
 * Sidebar panel for imagination metadata and social interactions.
 * Allows users to add title, description, problems, and solutions.
 * Includes mock upvote, comment, and share functionality.
 *
 * Props:
 * - imaginationData: Current imagination data
 * - onSave: Callback when user saves the imagination
 * - onUpvote: Callback when user upvotes
 * - onComment: Callback when user adds a comment
 * - onShare: Callback when user shares
 */
const SidebarForm = ({
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

  return (
    <div className="w-full lg:w-96 bg-white shadow-lg flex flex-col h-full">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
        <h2 className="text-2xl font-bold">Your Imagination</h2>
        <p className="text-blue-100 text-sm mt-1">
          Add details about your placemaking vision
        </p>
      </div>

      {/* Form Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Title *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="e.g., Green Corner Park Redesign"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Describe your vision for this space..."
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all"
          />
        </div>

        {/* Existing Problems */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Existing Problems
          </label>
          <textarea
            value={formData.existingProblems}
            onChange={(e) => handleChange('existingProblems', e.target.value)}
            placeholder="What issues does this space currently have?"
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all"
          />
        </div>

        {/* Proposed Solution */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Proposed Solution
          </label>
          <textarea
            value={formData.proposedSolution}
            onChange={(e) => handleChange('proposedSolution', e.target.value)}
            placeholder="How will your changes improve this space?"
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all"
          />
        </div>

        {/* Social Interactions Section */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Community</h3>

          {/* Upvote Button */}
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={onUpvote}
              className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-2 rounded-lg font-semibold transition-all duration-200 shadow-md"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 15l7-7 7 7"
                />
              </svg>
              Upvote
            </button>
            <span className="text-2xl font-bold text-gray-700">
              {upvoteCount}
            </span>
          </div>

          {/* Comments Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-700">
                Comments ({comments.length})
              </span>
              <button
                onClick={() => setShowCommentForm(!showCommentForm)}
                className="text-blue-600 hover:text-blue-700 text-sm font-semibold"
              >
                {showCommentForm ? 'Cancel' : 'Add Comment'}
              </button>
            </div>

            {/* Comment Form */}
            {showCommentForm && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Share your thoughts..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none text-sm"
                />
                <button
                  onClick={handleAddComment}
                  className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-200"
                >
                  Post Comment
                </button>
              </div>
            )}

            {/* Comments List */}
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-800">
                      {comment.author}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{comment.text}</p>
                </div>
              ))}

              {comments.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No comments yet. Be the first to share your thoughts!
                </p>
              )}
            </div>
          </div>

          {/* Share Button */}
          <button
            onClick={onShare}
            className="w-full mt-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-md flex items-center justify-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            Share Imagination
          </button>
        </div>
      </div>

      {/* Footer - Fixed */}
      <div className="border-t border-gray-200 p-6 bg-gray-50">
        <button
          onClick={handleSave}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-lg font-bold text-lg transition-all duration-200 shadow-lg"
        >
          Save Imagination
        </button>
      </div>
    </div>
  );
};

export default SidebarForm;
