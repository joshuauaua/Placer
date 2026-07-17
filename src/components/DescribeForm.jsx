/* PLOT — Describe Your Imagination Form */

import { useState } from 'react';
import { Icon } from './Icon';
import { Btn, Chip } from './UI';

export function DescribeForm({ t, designData, onBack, onSubmit }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableCategories = [
    'Green Space',
    'Public Seating',
    'Art & Culture',
    'Play & Recreation',
    'Safety & Lighting',
    'Accessibility',
    'Pedestrian',
    'Cycling',
    'Community',
    'Sustainability'
  ];

  const handleToggleCategory = (category) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter(c => c !== category));
    } else {
      setSelectedCategories([...selectedCategories, category]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Prepare the full project data
    const projectData = {
      ...designData,
      title,
      description,
      categories: selectedCategories,
      submittedAt: new Date().toISOString()
    };

    console.log('Submitting project:', projectData);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    onSubmit(projectData);
    setIsSubmitting(false);
  };

  const isValid = title.trim().length > 0 && description.trim().length > 0 && selectedCategories.length > 0;

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
        background: t.chrome,
        borderBottom: `1px solid ${t.line}`,
        padding: '20px 32px'
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 8,
              border: `1.5px solid ${t.line}`,
              background: t.surface,
              color: t.ink,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            <Icon name="arrowLeft" size={18} stroke={2} />
            Back to Canvas
          </button>

          <div style={{ flex: 1 }}>
            <h1 className="plot-disp" style={{
              fontSize: 24,
              fontWeight: 900,
              color: t.ink,
              letterSpacing: '-0.02em'
            }}>
              Describe Your Imagination
            </h1>
          </div>

          <div style={{
            padding: '8px 16px',
            background: t.surfaceAlt,
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            color: t.inkDim
          }}>
            Step 2 of 3
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '40px 32px'
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: 32 }}>
              {/* Left Column - Form Fields */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 32 }}>

                {/* Project Title */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: 16,
                    fontWeight: 700,
                    color: t.ink,
                    marginBottom: 8
                  }}>
                    Project Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Revitalizing Södermalm Square"
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      fontSize: 16,
                      border: `1.5px solid ${t.line}`,
                      borderRadius: 10,
                      background: t.surface,
                      color: t.ink,
                      fontFamily: "'Archivo', sans-serif",
                      outline: 'none'
                    }}
                  />
                  <p style={{
                    fontSize: 13,
                    color: t.inkDim,
                    marginTop: 8
                  }}>
                    Give your project a clear, descriptive name
                  </p>
                </div>

                {/* Categories */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: 16,
                    fontWeight: 700,
                    color: t.ink,
                    marginBottom: 8
                  }}>
                    Categories * <span style={{ fontSize: 14, fontWeight: 600, color: t.inkDim }}>
                      ({selectedCategories.length} selected)
                    </span>
                  </label>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 10
                  }}>
                    {availableCategories.map(category => (
                      <Chip
                        key={category}
                        t={t}
                        active={selectedCategories.includes(category)}
                        onClick={() => handleToggleCategory(category)}
                      >
                        {category}
                      </Chip>
                    ))}
                  </div>
                  <p style={{
                    fontSize: 13,
                    color: t.inkDim,
                    marginTop: 8
                  }}>
                    Select all categories that apply to your project
                  </p>
                </div>

                {/* Description */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: 16,
                    fontWeight: 700,
                    color: t.ink,
                    marginBottom: 8
                  }}>
                    Description *
                  </label>
                  <textarea
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your vision for this space. What improvements are you proposing? Why are they important? How will they benefit the community?"
                    rows={8}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      fontSize: 15,
                      border: `1.5px solid ${t.line}`,
                      borderRadius: 10,
                      background: t.surface,
                      color: t.ink,
                      fontFamily: "'Archivo', sans-serif",
                      outline: 'none',
                      resize: 'vertical',
                      lineHeight: 1.6
                    }}
                  />
                  <p style={{
                    fontSize: 13,
                    color: t.inkDim,
                    marginTop: 8
                  }}>
                    {description.length} characters • Aim for at least 100 characters
                  </p>
                </div>

                {/* Project Stats */}
                <div style={{
                  padding: 20,
                  background: t.surface,
                  border: `1px solid ${t.line}`,
                  borderRadius: 12,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 20
                }}>
                  <div>
                    <div style={{ fontSize: 13, color: t.inkDim, marginBottom: 4 }}>
                      Assets Placed
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: t.ink }}>
                      {designData?.assetCount || 0}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: t.inkDim, marginBottom: 4 }}>
                      Location
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>
                      {designData?.originalView?.position?.lat?.toFixed(4)}, {designData?.originalView?.position?.lng?.toFixed(4)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: t.inkDim, marginBottom: 4 }}>
                      Created
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>
                      {new Date().toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div style={{
                  display: 'flex',
                  gap: 12,
                  paddingTop: 16
                }}>
                  <Btn
                    t={t}
                    variant="accent"
                    size="lg"
                    icon={isSubmitting ? "loader" : "check"}
                    disabled={!isValid || isSubmitting}
                    style={{ flex: 1, height: 52 }}
                  >
                    {isSubmitting ? 'Publishing...' : 'Publish Project'}
                  </Btn>
                  <Btn
                    t={t}
                    variant="outline"
                    size="lg"
                    icon="save"
                    disabled={isSubmitting}
                    style={{ width: 160, height: 52 }}
                    onClick={(e) => {
                      e.preventDefault();
                      alert('Draft saved locally!');
                    }}
                  >
                    Save Draft
                  </Btn>
                </div>
              </div>

              {/* Right Column - Preview */}
              <div style={{ width: 380 }}>
                <div style={{
                  position: 'sticky',
                  top: 0
                }}>
                  <div style={{
                    background: t.surface,
                    border: `1px solid ${t.line}`,
                    borderRadius: 12,
                    overflow: 'hidden',
                    boxShadow: t.shadow
                  }}>
                    <div style={{ padding: 16, borderBottom: `1px solid ${t.line}` }}>
                      <h3 style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: t.ink,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}>
                        <Icon name="eye" size={18} stroke={2} />
                        Preview
                      </h3>
                    </div>

                    {/* Image Preview */}
                    {designData?.editedImage && (
                      <div style={{ position: 'relative' }}>
                        <img
                          src={designData.editedImage}
                          alt="Project preview"
                          style={{
                            width: '100%',
                            height: 240,
                            objectFit: 'cover',
                            display: 'block'
                          }}
                        />
                        <div style={{
                          position: 'absolute',
                          top: 12,
                          right: 12,
                          padding: '6px 12px',
                          background: 'rgba(0,0,0,0.8)',
                          color: '#fff',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700
                        }}>
                          {designData.assetCount || 0} assets
                        </div>
                      </div>
                    )}

                    {/* Preview Content */}
                    <div style={{ padding: 20 }}>
                      <h4 style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: t.ink,
                        marginBottom: 12
                      }}>
                        {title || 'Untitled Project'}
                      </h4>

                      {selectedCategories.length > 0 && (
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 6,
                          marginBottom: 12
                        }}>
                          {selectedCategories.map(cat => (
                            <span key={cat} style={{
                              padding: '4px 10px',
                              background: t.accent + '20',
                              color: t.ink,
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 700
                            }}>
                              {cat}
                            </span>
                          ))}
                        </div>
                      )}

                      <p style={{
                        fontSize: 14,
                        color: t.inkDim,
                        lineHeight: 1.6
                      }}>
                        {description || 'Add a description to explain your vision for this space...'}
                      </p>

                      {!isValid && (
                        <div style={{
                          marginTop: 16,
                          padding: 12,
                          background: '#FEF3C7',
                          border: '1px solid #F59E0B',
                          borderRadius: 8,
                          fontSize: 13,
                          color: '#92400E'
                        }}>
                          <strong>Required:</strong> Title, at least one category, and description
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
