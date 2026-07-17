/* PLOT — Admin Dashboard */

import { useState } from 'react';
import { Icon } from './Icon';
import { Btn } from './UI';

function StatCard({ icon, label, value, change, color, t }) {
  const cardColor = color || t.accent;
  return (
    <div style={{
      background: t.surface,
      border: `1px solid ${t.line}`,
      borderRadius: 12,
      padding: 24,
      boxShadow: t.shadow
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 10,
          background: cardColor + '15',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Icon name={icon} size={24} stroke={2} style={{ color: cardColor }} />
        </div>
        {change && (
          <span style={{
            fontSize: 13,
            fontWeight: 700,
            color: change.startsWith('+') ? '#3E9D4E' : '#D6452F'
          }}>
            {change}
          </span>
        )}
      </div>
      <div style={{ fontSize: 32, fontWeight: 900, color: t.ink, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 14, color: t.inkDim, fontWeight: 600 }}>
        {label}
      </div>
    </div>
  );
}

export function AdminDashboard({ t }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [newArticle, setNewArticle] = useState({
    title: '',
    excerpt: '',
    tags: [],
    icon: 'layers',
    color: '#3E9D4E',
    readTime: '5 min read'
  });

  // Mock Analytics Data
  const analytics = {
    totalVisits: 15847,
    uniqueVisitors: 8234,
    pageViews: 42891,
    avgSessionTime: '4m 32s',
    bounceRate: '32.5%',
    newUsers: 1245,
    returningUsers: 6989,
    topPages: [
      { page: '/explore', views: 12453, percentage: 29 },
      { page: '/', views: 10234, percentage: 24 },
      { page: '/resources', views: 8932, percentage: 21 },
      { page: '/about', views: 6821, percentage: 16 },
      { page: '/survey', views: 4451, percentage: 10 }
    ],
    weeklyVisits: [
      { day: 'Mon', visits: 2145 },
      { day: 'Tue', visits: 2389 },
      { day: 'Wed', visits: 2567 },
      { day: 'Thu', visits: 2834 },
      { day: 'Fri', visits: 2198 },
      { day: 'Sat', visits: 1876 },
      { day: 'Sun', visits: 1838 }
    ]
  };

  // Mock Survey Responses
  const surveyResponses = [
    {
      id: 1,
      submittedAt: '2026-07-03 14:32',
      responses: {
        q1: 'Several times a week',
        q2: 'More green spaces and parks',
        q3: 'Somewhat comfortable',
        q10: '25-34',
        q11: 'Urban residential'
      }
    },
    {
      id: 2,
      submittedAt: '2026-07-03 11:15',
      responses: {
        q1: 'Daily',
        q2: 'Better pedestrian infrastructure',
        q3: 'Very comfortable - I understand how to participate',
        q10: '35-44',
        q11: 'Urban downtown/city center'
      }
    },
    {
      id: 3,
      submittedAt: '2026-07-02 16:48',
      responses: {
        q1: 'Once a week',
        q2: 'Public art and cultural spaces',
        q3: 'Neutral',
        q10: '18-24',
        q11: 'Suburban'
      }
    },
    {
      id: 4,
      submittedAt: '2026-07-02 09:22',
      responses: {
        q1: 'Several times a week',
        q2: 'Improved lighting and safety',
        q3: 'Somewhat uncomfortable',
        q10: '45-54',
        q11: 'Mixed-use area'
      }
    }
  ];

  const surveyStats = {
    totalResponses: 127,
    completionRate: '84%',
    avgTimeToComplete: '3m 42s',
    topAnswers: {
      visitFrequency: { answer: 'Several times a week', count: 45 },
      improvement: { answer: 'More green spaces and parks', count: 52 },
      ageGroup: { answer: '25-34', count: 38 },
      neighborhood: { answer: 'Urban residential', count: 41 }
    }
  };

  // Mock User Data
  const userStats = {
    totalUsers: 8234,
    activeUsers: 3456,
    newThisMonth: 1245,
    activeProjects: 567,
    totalProjects: 2341,
    avgProjectsPerUser: 2.8
  };

  const recentUsers = [
    { id: 1, name: 'Emma Larsson', email: 'emma.l@email.com', joined: '2026-07-03', projects: 3 },
    { id: 2, name: 'Erik Andersson', email: 'erik.a@email.com', joined: '2026-07-03', projects: 1 },
    { id: 3, name: 'Sofia Berg', email: 'sofia.b@email.com', joined: '2026-07-02', projects: 5 },
    { id: 4, name: 'Lars Nilsson', email: 'lars.n@email.com', joined: '2026-07-02', projects: 2 }
  ];

  const availableIcons = ['layers', 'tree', 'users', 'award', 'box', 'book', 'heart', 'trendingUp'];
  const availableColors = ['#3E9D4E', '#2F7BD6', '#7A52E0', '#E08A2B', '#D4407E', '#16766B', '#D6452F'];

  const handleAddArticle = (e) => {
    e.preventDefault();
    alert('Article added successfully! (In production, this would save to database)');
    setNewArticle({
      title: '',
      excerpt: '',
      tags: [],
      icon: 'layers',
      color: '#3E9D4E',
      readTime: '5 min read'
    });
  };

  const handleAddTag = (tag) => {
    if (tag && !newArticle.tags.includes(tag)) {
      setNewArticle({ ...newArticle, tags: [...newArticle.tags, tag] });
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setNewArticle({ ...newArticle, tags: newArticle.tags.filter(tag => tag !== tagToRemove) });
  };

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: t.page
    }}>
      {/* Header */}
      <div style={{
        background: t.surface,
        borderBottom: `1px solid ${t.line}`,
        padding: '20px 32px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 className="plot-disp" style={{
              fontSize: 28,
              fontWeight: 900,
              color: t.ink,
              letterSpacing: '-0.02em',
              marginBottom: 4
            }}>
              Admin Dashboard
            </h1>
            <p style={{ fontSize: 14, color: t.inkDim }}>
              Manage your platform, users, and content
            </p>
          </div>
          <div style={{
            padding: '8px 16px',
            background: t.accent + '15',
            borderRadius: 8,
            border: `1px solid ${t.accent}`,
            fontSize: 13,
            fontWeight: 700,
            color: t.ink
          }}>
            <Icon name="shield" size={16} stroke={2} style={{ display: 'inline', marginRight: 6 }} />
            Admin Access
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { key: 'overview', label: 'Overview', icon: 'grid' },
            { key: 'analytics', label: 'Analytics', icon: 'trendingUp' },
            { key: 'survey', label: 'Survey Responses', icon: 'clipboard' },
            { key: 'users', label: 'Users', icon: 'users' },
            { key: 'content', label: 'Content', icon: 'edit' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: 'none',
                background: activeTab === tab.key ? t.accent : 'transparent',
                color: activeTab === tab.key ? t.accentInk : t.inkDim,
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <Icon name={tab.icon} size={16} stroke={2} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 32
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 20,
                marginBottom: 32
              }}>
                <StatCard t={t} icon="users" label="Total Users" value={userStats.totalUsers.toLocaleString()} change="+12.5%" />
                <StatCard t={t} icon="eye" label="Total Visits" value={analytics.totalVisits.toLocaleString()} change="+8.3%" />
                <StatCard t={t} icon="clipboard" label="Survey Responses" value={surveyStats.totalResponses} change="+15.2%" />
                <StatCard t={t} icon="fileText" label="Active Projects" value={userStats.activeProjects} change="+5.7%" />
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr',
                gap: 24
              }}>
                {/* Weekly Traffic */}
                <div style={{
                  background: t.surface,
                  border: `1px solid ${t.line}`,
                  borderRadius: 12,
                  padding: 24,
                  boxShadow: t.shadow
                }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: t.ink, marginBottom: 20 }}>
                    Weekly Traffic
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 200 }}>
                    {analytics.weeklyVisits.map(day => (
                      <div key={day.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: '100%',
                          height: (day.visits / 3000) * 200,
                          background: t.accent,
                          borderRadius: '4px 4px 0 0',
                          position: 'relative'
                        }}>
                          <span style={{
                            position: 'absolute',
                            top: -24,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            fontSize: 12,
                            fontWeight: 700,
                            color: t.ink
                          }}>
                            {day.visits}
                          </span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: t.inkDim }}>
                          {day.day}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Stats */}
                <div style={{
                  background: t.surface,
                  border: `1px solid ${t.line}`,
                  borderRadius: 12,
                  padding: 24,
                  boxShadow: t.shadow
                }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: t.ink, marginBottom: 20 }}>
                    Quick Stats
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 13, color: t.inkDim, marginBottom: 4 }}>Avg Session Time</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: t.ink }}>{analytics.avgSessionTime}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: t.inkDim, marginBottom: 4 }}>Bounce Rate</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: t.ink }}>{analytics.bounceRate}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: t.inkDim, marginBottom: 4 }}>New Users (30d)</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: t.ink }}>{userStats.newThisMonth}</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ANALYTICS TAB */}
          {activeTab === 'analytics' && (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 20,
                marginBottom: 32
              }}>
                <StatCard t={t} icon="eye" label="Page Views" value={analytics.pageViews.toLocaleString()} />
                <StatCard t={t} icon="users" label="Unique Visitors" value={analytics.uniqueVisitors.toLocaleString()} />
                <StatCard t={t} icon="userPlus" label="New Users" value={analytics.newUsers.toLocaleString()} />
                <StatCard t={t} icon="userCheck" label="Returning Users" value={analytics.returningUsers.toLocaleString()} />
              </div>

              {/* Top Pages */}
              <div style={{
                background: t.surface,
                border: `1px solid ${t.line}`,
                borderRadius: 12,
                padding: 24,
                boxShadow: t.shadow
              }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: t.ink, marginBottom: 20 }}>
                  Top Pages
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {analytics.topPages.map((page, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 100, fontSize: 14, fontWeight: 600, color: t.ink }}>
                        {page.page}
                      </div>
                      <div style={{ flex: 1, height: 32, background: t.chrome, borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                        <div style={{
                          width: `${page.percentage}%`,
                          height: '100%',
                          background: t.accent,
                          transition: 'width 0.3s'
                        }} />
                        <span style={{
                          position: 'absolute',
                          right: 12,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: 13,
                          fontWeight: 700,
                          color: t.ink
                        }}>
                          {page.views.toLocaleString()} views
                        </span>
                      </div>
                      <div style={{ width: 60, textAlign: 'right', fontSize: 14, fontWeight: 700, color: t.inkDim }}>
                        {page.percentage}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* SURVEY TAB */}
          {activeTab === 'survey' && (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 20,
                marginBottom: 32
              }}>
                <StatCard t={t} icon="clipboard" label="Total Responses" value={surveyStats.totalResponses} />
                <StatCard t={t} icon="checkCircle" label="Completion Rate" value={surveyStats.completionRate} />
                <StatCard t={t} icon="clock" label="Avg Time" value={surveyStats.avgTimeToComplete} />
              </div>

              {/* Top Answers */}
              <div style={{
                background: t.surface,
                border: `1px solid ${t.line}`,
                borderRadius: 12,
                padding: 24,
                marginBottom: 24,
                boxShadow: t.shadow
              }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: t.ink, marginBottom: 20 }}>
                  Most Common Answers
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  {Object.entries(surveyStats.topAnswers).map(([key, data]) => (
                    <div key={key} style={{ padding: 16, background: t.chrome, borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: t.inkDim, marginBottom: 8, textTransform: 'uppercase', fontWeight: 700 }}>
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, marginBottom: 4 }}>
                        {data.answer}
                      </div>
                      <div style={{ fontSize: 13, color: t.inkDim }}>
                        {data.count} responses
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Responses */}
              <div style={{
                background: t.surface,
                border: `1px solid ${t.line}`,
                borderRadius: 12,
                padding: 24,
                boxShadow: t.shadow
              }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: t.ink, marginBottom: 20 }}>
                  Recent Responses
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {surveyResponses.map(response => (
                    <div key={response.id} style={{
                      padding: 16,
                      background: t.chrome,
                      borderRadius: 8,
                      border: `1px solid ${t.line}`
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>
                          Response #{response.id}
                        </span>
                        <span style={{ fontSize: 13, color: t.inkDim }}>
                          {response.submittedAt}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                        <div>
                          <span style={{ color: t.inkDim }}>Visit Frequency:</span>{' '}
                          <span style={{ fontWeight: 600, color: t.ink }}>{response.responses.q1}</span>
                        </div>
                        <div>
                          <span style={{ color: t.inkDim }}>Age Group:</span>{' '}
                          <span style={{ fontWeight: 600, color: t.ink }}>{response.responses.q10}</span>
                        </div>
                        <div>
                          <span style={{ color: t.inkDim }}>Priority:</span>{' '}
                          <span style={{ fontWeight: 600, color: t.ink }}>{response.responses.q2}</span>
                        </div>
                        <div>
                          <span style={{ color: t.inkDim }}>Neighborhood:</span>{' '}
                          <span style={{ fontWeight: 600, color: t.ink }}>{response.responses.q11}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* USERS TAB */}
          {activeTab === 'users' && (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 20,
                marginBottom: 32
              }}>
                <StatCard t={t} icon="users" label="Total Users" value={userStats.totalUsers.toLocaleString()} />
                <StatCard t={t} icon="userCheck" label="Active Users" value={userStats.activeUsers.toLocaleString()} />
                <StatCard t={t} icon="userPlus" label="New This Month" value={userStats.newThisMonth.toLocaleString()} />
                <StatCard t={t} icon="fileText" label="Total Projects" value={userStats.totalProjects.toLocaleString()} />
              </div>

              {/* Recent Users */}
              <div style={{
                background: t.surface,
                border: `1px solid ${t.line}`,
                borderRadius: 12,
                padding: 24,
                boxShadow: t.shadow
              }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: t.ink, marginBottom: 20 }}>
                  Recent Users
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${t.line}` }}>
                      <th style={{ textAlign: 'left', padding: '12px 0', fontSize: 13, fontWeight: 700, color: t.inkDim, textTransform: 'uppercase' }}>Name</th>
                      <th style={{ textAlign: 'left', padding: '12px 0', fontSize: 13, fontWeight: 700, color: t.inkDim, textTransform: 'uppercase' }}>Email</th>
                      <th style={{ textAlign: 'left', padding: '12px 0', fontSize: 13, fontWeight: 700, color: t.inkDim, textTransform: 'uppercase' }}>Joined</th>
                      <th style={{ textAlign: 'left', padding: '12px 0', fontSize: 13, fontWeight: 700, color: t.inkDim, textTransform: 'uppercase' }}>Projects</th>
                      <th style={{ textAlign: 'right', padding: '12px 0', fontSize: 13, fontWeight: 700, color: t.inkDim, textTransform: 'uppercase' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentUsers.map(user => (
                      <tr key={user.id} style={{ borderBottom: `1px solid ${t.line}` }}>
                        <td style={{ padding: '16px 0', fontSize: 14, fontWeight: 600, color: t.ink }}>{user.name}</td>
                        <td style={{ padding: '16px 0', fontSize: 14, color: t.inkDim }}>{user.email}</td>
                        <td style={{ padding: '16px 0', fontSize: 14, color: t.inkDim }}>{user.joined}</td>
                        <td style={{ padding: '16px 0', fontSize: 14, fontWeight: 700, color: t.ink }}>{user.projects}</td>
                        <td style={{ padding: '16px 0', textAlign: 'right' }}>
                          <button style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            border: `1px solid ${t.line}`,
                            background: 'transparent',
                            color: t.ink,
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}>
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* CONTENT TAB */}
          {activeTab === 'content' && (
            <div style={{
              background: t.surface,
              border: `1px solid ${t.line}`,
              borderRadius: 12,
              padding: 32,
              boxShadow: t.shadow
            }}>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: t.ink, marginBottom: 8 }}>
                Add New Article
              </h3>
              <p style={{ fontSize: 14, color: t.inkDim, marginBottom: 32 }}>
                Create a new article for the Resources page
              </p>

              <form onSubmit={handleAddArticle}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Title */}
                  <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
                      Article Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={newArticle.title}
                      onChange={(e) => setNewArticle({ ...newArticle, title: e.target.value })}
                      placeholder="e.g., How to Design Better Public Spaces"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: 15,
                        border: `1.5px solid ${t.line}`,
                        borderRadius: 8,
                        background: t.chrome,
                        color: t.ink,
                        fontFamily: "'Archivo', sans-serif",
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Excerpt */}
                  <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
                      Excerpt *
                    </label>
                    <textarea
                      required
                      value={newArticle.excerpt}
                      onChange={(e) => setNewArticle({ ...newArticle, excerpt: e.target.value })}
                      placeholder="Brief description of the article..."
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: 15,
                        border: `1.5px solid ${t.line}`,
                        borderRadius: 8,
                        background: t.chrome,
                        color: t.ink,
                        fontFamily: "'Archivo', sans-serif",
                        outline: 'none',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  {/* Tags */}
                  <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
                      Tags
                    </label>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                      {newArticle.tags.map(tag => (
                        <span key={tag} style={{
                          padding: '6px 12px',
                          background: t.accent,
                          color: t.accentInk,
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: t.accentInk,
                              cursor: 'pointer',
                              padding: 0,
                              display: 'flex'
                            }}
                          >
                            <Icon name="x" size={14} stroke={2.5} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {['Guide', 'Research', 'Tutorial', 'Case Study', 'Community', 'Design', 'Education', 'Data'].map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleAddTag(tag)}
                          disabled={newArticle.tags.includes(tag)}
                          style={{
                            padding: '6px 12px',
                            background: newArticle.tags.includes(tag) ? t.line : t.chrome,
                            border: `1px solid ${t.line}`,
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 600,
                            color: newArticle.tags.includes(tag) ? t.inkDim : t.ink,
                            cursor: newArticle.tags.includes(tag) ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Icon & Color */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
                        Icon
                      </label>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {availableIcons.map(icon => (
                          <button
                            key={icon}
                            type="button"
                            onClick={() => setNewArticle({ ...newArticle, icon })}
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 8,
                              border: `2px solid ${newArticle.icon === icon ? t.accent : t.line}`,
                              background: newArticle.icon === icon ? t.accent + '15' : t.chrome,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            <Icon name={icon} size={20} stroke={2} style={{ color: t.ink }} />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
                        Color
                      </label>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {availableColors.map(color => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setNewArticle({ ...newArticle, color })}
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 8,
                              border: `2px solid ${newArticle.color === color ? t.ink : t.line}`,
                              background: color,
                              cursor: 'pointer'
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Read Time */}
                  <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
                      Read Time
                    </label>
                    <input
                      type="text"
                      value={newArticle.readTime}
                      onChange={(e) => setNewArticle({ ...newArticle, readTime: e.target.value })}
                      placeholder="e.g., 5 min read"
                      style={{
                        width: 200,
                        padding: '12px 16px',
                        fontSize: 15,
                        border: `1.5px solid ${t.line}`,
                        borderRadius: 8,
                        background: t.chrome,
                        color: t.ink,
                        fontFamily: "'Archivo', sans-serif",
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Preview */}
                  <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
                      Preview
                    </label>
                    <div style={{
                      background: t.chrome,
                      border: `1px solid ${t.line}`,
                      borderRadius: 12,
                      overflow: 'hidden',
                      maxWidth: 400
                    }}>
                      <div style={{
                        height: 160,
                        background: `linear-gradient(135deg, ${newArticle.color}BB 0%, ${newArticle.color} 100%)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Icon name={newArticle.icon} size={48} stroke={2} style={{ color: '#fff', opacity: 0.9 }} />
                      </div>
                      <div style={{ padding: 16 }}>
                        <h4 style={{ fontSize: 16, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
                          {newArticle.title || 'Article Title'}
                        </h4>
                        <p style={{ fontSize: 13, color: t.inkDim, marginBottom: 12 }}>
                          {newArticle.excerpt || 'Article excerpt will appear here...'}
                        </p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {newArticle.tags.map(tag => (
                            <span key={tag} style={{
                              padding: '4px 8px',
                              background: t.line,
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              color: t.ink
                            }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div style={{ display: 'flex', gap: 12, paddingTop: 16 }}>
                    <Btn t={t} variant="accent" icon="check" style={{ height: 48 }}>
                      Publish Article
                    </Btn>
                    <Btn t={t} variant="ghost" style={{ height: 48 }}>
                      Save Draft
                    </Btn>
                  </div>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
