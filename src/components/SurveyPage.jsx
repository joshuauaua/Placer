/* PLOT — Survey Page */

import { useState } from 'react';
import { Icon } from './Icon';
import { Btn } from './UI';
import posthog from 'posthog-js';

export function SurveyPage({ t }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const questions = [
    {
      id: 1,
      question: "How often do you visit public spaces in your neighborhood?",
      options: [
        "Daily",
        "Several times a week",
        "Once a week",
        "Once a month",
        "Rarely or never"
      ]
    },
    {
      id: 2,
      question: "What type of public space improvement would benefit your community most?",
      options: [
        "More green spaces and parks",
        "Better pedestrian infrastructure",
        "Public art and cultural spaces",
        "Improved lighting and safety",
        "Community gathering spaces"
      ]
    },
    {
      id: 3,
      question: "How comfortable are you with current urban planning processes?",
      options: [
        "Very comfortable - I understand how to participate",
        "Somewhat comfortable",
        "Neutral",
        "Somewhat uncomfortable",
        "Very uncomfortable - I don't know where to start"
      ]
    },
    {
      id: 4,
      question: "What's your primary motivation for wanting to improve public spaces?",
      options: [
        "Environmental sustainability",
        "Community building and social connection",
        "Safety and accessibility",
        "Economic development",
        "Personal enjoyment and quality of life"
      ]
    },
    {
      id: 5,
      question: "How important is visual representation when proposing changes?",
      options: [
        "Extremely important",
        "Very important",
        "Moderately important",
        "Slightly important",
        "Not important"
      ]
    },
    {
      id: 6,
      question: "Which urban element would you most like to see more of?",
      options: [
        "Street trees and vegetation",
        "Seating areas and benches",
        "Bike lanes and cycling infrastructure",
        "Public transit stops and shelters",
        "Water features and fountains"
      ]
    },
    {
      id: 7,
      question: "How do you currently share ideas about community improvements?",
      options: [
        "Social media and online forums",
        "Community meetings and town halls",
        "Direct contact with local officials",
        "Neighborhood associations",
        "I don't currently share ideas"
      ]
    },
    {
      id: 8,
      question: "What's the biggest barrier to community engagement in planning?",
      options: [
        "Lack of time",
        "Complex processes and jargon",
        "Not knowing how to get involved",
        "Feeling like my voice won't matter",
        "No barriers - I'm actively engaged"
      ]
    },
    {
      id: 9,
      question: "How likely are you to support a community-proposed project?",
      options: [
        "Very likely - I actively support local initiatives",
        "Somewhat likely",
        "Neutral - depends on the project",
        "Somewhat unlikely",
        "Very unlikely"
      ]
    },
    {
      id: 10,
      question: "What age group do you belong to?",
      options: [
        "Under 18",
        "18-24",
        "25-34",
        "35-44",
        "45-54",
        "55-64",
        "65 or older"
      ]
    },
    {
      id: 11,
      question: "How would you describe your neighborhood?",
      options: [
        "Urban downtown/city center",
        "Urban residential",
        "Suburban",
        "Rural",
        "Mixed-use area"
      ]
    },
    {
      id: 12,
      question: "What feature would make you use a urban planning tool like PLOT?",
      options: [
        "Easy-to-use interface",
        "Ability to see realistic visualizations",
        "Community voting and feedback",
        "Connection to local government",
        "Mobile app accessibility"
      ]
    }
  ];

  const handleAnswer = (optionIndex) => {
    setAnswers({
      ...answers,
      [currentQuestion]: optionIndex
    });
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSubmit = () => {
    posthog.capture('survey_submitted', {
      questions_answered: Object.keys(answers).length,
      total_questions: questions.length,
    });
    setSubmitted(true);
  };

  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const isAnswered = answers[currentQuestion] !== undefined;
  const allAnswered = Object.keys(answers).length === questions.length;

  if (submitted) {
    return (
      <div style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${t.page} 0%, ${t.chrome} 100%)`,
        padding: 20
      }}>
        <div style={{
          maxWidth: 600,
          textAlign: 'center',
          padding: 60,
          background: t.surface,
          borderRadius: 16,
          border: `1px solid ${t.line}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            width: 80,
            height: 80,
            background: t.accent,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px'
          }}>
            <Icon name="check" size={44} stroke={3} style={{ color: t.accentInk }} />
          </div>

          <h1 className="plot-disp" style={{
            fontSize: 36,
            fontWeight: 900,
            color: t.ink,
            letterSpacing: '-0.02em',
            marginBottom: 16
          }}>
            Thank You!
          </h1>

          <p style={{
            fontSize: 18,
            color: t.inkDim,
            lineHeight: 1.6,
            marginBottom: 32
          }}>
            Your responses have been recorded. Thank you for helping us understand
            how to better serve our community.
          </p>

          <Btn t={t} variant="accent" size="lg" onClick={() => window.location.href = '/'}>
            Return to Home
          </Btn>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];

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
        padding: '24px 32px',
        borderBottom: `1px solid ${t.line}`,
        background: t.surface
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 className="plot-disp" style={{
              fontSize: 24,
              fontWeight: 800,
              color: t.ink,
              letterSpacing: '-0.02em'
            }}>
              Community Survey
            </h2>
            <span className="plot-mono" style={{
              fontSize: 13,
              fontWeight: 600,
              color: t.inkDim
            }}>
              {currentQuestion + 1} / {questions.length}
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{
            width: '100%',
            height: 6,
            background: t.chrome,
            borderRadius: 999,
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: t.accent,
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      </div>

      {/* Question Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '48px 32px'
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <h1 style={{
            fontSize: 28,
            fontWeight: 700,
            color: t.ink,
            lineHeight: 1.4,
            marginBottom: 40
          }}>
            {currentQ.question}
          </h1>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {currentQ.options.map((option, index) => {
              const isSelected = answers[currentQuestion] === index;
              return (
                <button
                  key={index}
                  onClick={() => handleAnswer(index)}
                  style={{
                    padding: '20px 24px',
                    borderRadius: 12,
                    border: `2px solid ${isSelected ? t.accent : t.line}`,
                    background: isSelected ? (t.mapMode === 'dark' ? 'rgba(215,251,54,.08)' : t.accent + '15') : t.surface,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = t.lineStrong;
                      e.currentTarget.style.background = t.surfaceAlt;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = t.line;
                      e.currentTarget.style.background = t.surface;
                    }
                  }}
                >
                  {/* Radio indicator */}
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    border: `2px solid ${isSelected ? t.accent : t.lineStrong}`,
                    background: isSelected ? t.accent : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: '0 0 auto'
                  }}>
                    {isSelected && (
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: t.accentInk
                      }} />
                    )}
                  </div>

                  <span style={{
                    fontSize: 16,
                    fontWeight: isSelected ? 600 : 500,
                    color: t.ink
                  }}>
                    {option}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div style={{
        padding: '24px 32px',
        borderTop: `1px solid ${t.line}`,
        background: t.surface
      }}>
        <div style={{
          maxWidth: 800,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Btn
            t={t}
            variant="ghost"
            onClick={handlePrevious}
            disabled={currentQuestion === 0}
            icon="arrowLeft"
          >
            Previous
          </Btn>

          {currentQuestion === questions.length - 1 ? (
            <Btn
              t={t}
              variant="accent"
              onClick={handleSubmit}
              disabled={!allAnswered}
              icon="check"
            >
              Submit Survey
            </Btn>
          ) : (
            <Btn
              t={t}
              variant="accent"
              onClick={handleNext}
              disabled={!isAnswered}
              icon="arrowRight"
            >
              Next Question
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

export default SurveyPage;
