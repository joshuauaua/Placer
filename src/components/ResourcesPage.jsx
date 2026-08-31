/* PLACER — Resources Page */

import { useState } from 'react';
import { Icon } from './Icon';
import { Chip } from './UI';

export function ResourcesPage({ t }) {
  const posts = [
    {
      id: 1,
      title: 'How to Design Better Public Spaces',
      excerpt: 'Essential principles for creating vibrant, accessible community areas that serve everyone.',
      image: { bg: '#3E9D4E', icon: 'layers' },
      tags: ['Guide', 'Design'],
      date: 'June 15, 2026',
      readTime: '5 min read'
    },
    {
      id: 2,
      title: 'The Impact of Street Trees on Urban Life',
      excerpt: 'Research shows how trees reduce heat, improve air quality, and boost property values.',
      image: { bg: '#2F7BD6', icon: 'tree' },
      tags: ['Research', 'Environment'],
      date: 'June 10, 2026',
      readTime: '8 min read'
    },
    {
      id: 3,
      title: 'Community Engagement Best Practices',
      excerpt: 'Learn how to gather meaningful feedback and build consensus around urban improvements.',
      image: { bg: '#7A52E0', icon: 'users' },
      tags: ['Guide', 'Community'],
      date: 'June 5, 2026',
      readTime: '6 min read'
    },
    {
      id: 4,
      title: 'Case Study: Transforming a Neighborhood Park',
      excerpt: 'How one community used PLACER to redesign their local park and secure funding.',
      image: { bg: '#E08A2B', icon: 'award' },
      tags: ['Case Study', 'Success Story'],
      date: 'May 28, 2026',
      readTime: '10 min read'
    },
    {
      id: 5,
      title: 'Getting Started with Asset Placement',
      excerpt: 'A beginner-friendly tutorial on visualizing improvements with PLACER\'s asset library.',
      image: { bg: '#D4407E', icon: 'box' },
      tags: ['Tutorial', 'Basics'],
      date: 'May 20, 2026',
      readTime: '4 min read'
    },
    {
      id: 6,
      title: 'Urban Planning 101: The Basics',
      excerpt: 'Understanding zoning, permits, and the approval process for public space changes.',
      image: { bg: '#16766B', icon: 'book' },
      tags: ['Education', 'Planning'],
      date: 'May 15, 2026',
      readTime: '7 min read'
    },
    {
      id: 7,
      title: 'Accessible Design for All',
      excerpt: 'Why universal design principles matter and how to incorporate them into your proposals.',
      image: { bg: '#D6452F', icon: 'heart' },
      tags: ['Guide', 'Accessibility'],
      date: 'May 8, 2026',
      readTime: '6 min read'
    },
    {
      id: 8,
      title: 'Measuring Success: Before & After',
      excerpt: 'Tools and metrics for tracking the real-world impact of community-led improvements.',
      image: { bg: '#3E9D4E', icon: 'trendingUp' },
      tags: ['Research', 'Data'],
      date: 'May 1, 2026',
      readTime: '9 min read'
    },
  ];

  const [selectedTag, setSelectedTag] = useState(null);
  const allTags = ['All', 'Guide', 'Research', 'Tutorial', 'Case Study', 'Community', 'Design', 'Education'];

  const filteredPosts = selectedTag && selectedTag !== 'All'
    ? posts.filter(post => post.tags.includes(selectedTag))
    : posts;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      background: t.page,
      padding: '48px 40px'
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <h1 className="placer-disp" style={{
            fontSize: 48,
            fontWeight: 900,
            color: t.ink,
            letterSpacing: '-0.03em',
            marginBottom: 16
          }}>
            Resources
          </h1>
          <p style={{
            fontSize: 18,
            color: t.inkDim,
            lineHeight: 1.6,
            maxWidth: 680
          }}>
            Guides, case studies, and insights to help you reimagine your community spaces.
          </p>
        </div>

        {/* Filter Tags */}
        <div style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 40,
          paddingBottom: 32,
          borderBottom: `1px solid ${t.line}`
        }}>
          {allTags.map(tag => (
            <Chip
              key={tag}
              t={t}
              active={selectedTag === tag || (tag === 'All' && !selectedTag)}
              onClick={() => setSelectedTag(tag === 'All' ? null : tag)}
            >
              {tag}
            </Chip>
          ))}
        </div>

        {/* Posts Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 24
        }}>
          {filteredPosts.map(post => (
            <article
              key={post.id}
              style={{
                background: t.surface,
                borderRadius: 12,
                border: `1px solid ${t.line}`,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: t.shadow
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = t.shadow;
              }}
            >
              {/* Post Image */}
              <div style={{
                width: '100%',
                height: 200,
                background: `linear-gradient(135deg, ${post.image.bg}BB 0%, ${post.image.bg} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}>
                <Icon name={post.image.icon} size={56} stroke={2} style={{ color: '#fff', opacity: 0.9 }} />

                {/* Tags overlay */}
                <div style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  display: 'flex',
                  gap: 6
                }}>
                  {post.tags.map(tag => (
                    <span key={tag} style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: 'rgba(255,255,255,0.95)',
                      fontSize: 11,
                      fontWeight: 700,
                      color: post.image.bg,
                      backdropFilter: 'blur(8px)'
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Post Content */}
              <div style={{ padding: 24 }}>
                <h3 style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: t.ink,
                  marginBottom: 12,
                  lineHeight: 1.3
                }}>
                  {post.title}
                </h3>

                <p style={{
                  fontSize: 14,
                  color: t.inkDim,
                  lineHeight: 1.6,
                  marginBottom: 16
                }}>
                  {post.excerpt}
                </p>

                {/* Meta info */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 12,
                  color: t.inkDim
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="calendar" size={14} stroke={2} />
                    {post.date}
                  </span>
                  <span>•</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="clock" size={14} stroke={2} />
                    {post.readTime}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Empty State */}
        {filteredPosts.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '80px 20px',
            color: t.inkDim
          }}>
            <Icon name="inbox" size={48} stroke={1.5} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <p style={{ fontSize: 16 }}>No resources found for this filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ResourcesPage;
