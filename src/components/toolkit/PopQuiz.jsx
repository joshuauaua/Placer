/* PLACER — Toolkit: Pop Quiz.
 *
 * A quiz a room plays together: everybody picks a nickname, the facilitator puts the
 * questions up one at a time, and a right answer scores more the sooner it comes. A
 * question is four choices, A to D, or a blank to fill in, and anybody can skip one.
 *
 * Three screens share the parts below, depending on who is looking:
 *
 *   - outside a room, the quiz is written here and played alone, to try it out: the
 *     same questions, clock and scoring, with nobody to keep pace with
 *   - in a room, somebody who joined picks a nickname and answers what the facilitator
 *     has put up; their nickname and answers are their contribution
 *   - in a room, the facilitator — the browser that opened it — does not play. They
 *     start the quiz, show each answer and move on, and that pace is their contribution
 *
 * A room's quiz is its setup (`room.config`, see `setup` in toolkit/tools.js), written
 * before the room opened. The rules, the scoring and the pace are in src/lib/popQuiz.js.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Panel } from '../ToolLayout';
import { Btn } from '../UI';
import { Icon } from '../Icon';
import { QuestionsEditor, TimeField } from './PopQuizSetup';
import { rememberAnswer, rememberedAnswer } from '../../toolkit/rooms';
import {
  LETTERS, MAX_BLANK_LENGTH, MAX_NICKNAME_LENGTH, answerTo, answeredCount, cleanNickname, elapsed,
  emptyQuizState, paceAt, paceShown, pointsFor, quizQuestions, quizSeconds, quizSetupProblems, quizStage,
  sampleQuiz, scoreOf, withAnswer,
} from '../../lib/popQuiz';

const RIGHT = '#1E7B3A';
const WRONG = '#B3261E';

/** The time now, kept ticking while `active`, for a clock that has to move. */
function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, [active]);
  return now;
}

/** Where a quiz is right now, re-read as its clock runs. */
function useStage(pace, config) {
  // Ticking whenever a question might be open; quizStage decides whether it still is.
  const now = useNow(Boolean(pace) && !pace.shown && pace.q < quizQuestions(config).length);
  // The pace can change between ticks, and must not be read against a stale clock.
  return quizStage(pace, config, Math.max(now, pace?.at ?? 0));
}

/** The first thing anybody playing is asked: what to be called on the scoreboard. */
function NicknameForm({ t, onSubmit, action = 'Join the quiz' }) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const nickname = cleanNickname(draft);

  return (
    <Panel t={t} title="Pick a nickname">
      <form onSubmit={(event) => { event.preventDefault(); if (nickname) onSubmit(nickname); }}
        style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
        <label htmlFor={`${id}-nickname`} style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.5 }}>
          It is what you are called on the scoreboard, so everybody will see it.
        </label>
        <input
          id={`${id}-nickname`}
          aria-label="Nickname"
          type="text"
          maxLength={MAX_NICKNAME_LENGTH}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          autoComplete="off"
          style={{ height: 52, padding: '0 14px', borderRadius: 12, border: `1px solid ${t.lineStrong}`,
            background: t.surface, color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 18, fontWeight: 700 }} />
        <div>
          <Btn t={t} type="submit" variant="primary" disabled={!nickname}>{action}</Btn>
        </div>
      </form>
    </Panel>
  );
}

/** What a closed question tells the person who answered it. */
function Outcome({ t, question, answer, seconds }) {
  const points = pointsFor(question, answer, seconds);
  const right = question.kind === 'blank' ? question.answer : `${LETTERS[question.correct]}, ${question.choices[question.correct]}`;

  let line;
  if (points > 0) line = <><strong style={{ color: RIGHT }}>Right!</strong> +{points} points.</>;
  else if (!answer) line = <><strong style={{ color: t.ink }}>Time ran out.</strong> The answer was {right}.</>;
  else if (answer.skipped) line = <><strong style={{ color: t.ink }}>Skipped.</strong> The answer was {right}.</>;
  else line = <><strong style={{ color: WRONG }}>Not this time.</strong> The answer was {right}.</>;

  return <p role="status" style={{ fontSize: 16, color: t.inkDim, margin: 0, lineHeight: 1.5 }}>{line}</p>;
}

function Choices({ t, question, answer, open, closed, canAnswer, onAnswer }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
      {question.choices.map((choice, index) => {
        const picked = answer?.value === index;
        const right = closed && question.correct === index;
        const wrong = closed && picked && !right;
        const edge = right ? RIGHT : wrong ? WRONG : picked ? t.ink : t.lineStrong;
        return (
          <button key={index} type="button" className={open && canAnswer && !answer ? 'placer-btn placer-btn-secondary' : undefined}
            aria-pressed={picked} disabled={!open || !canAnswer || Boolean(answer)}
            onClick={() => onAnswer(index)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 64, padding: '10px 14px', textAlign: 'left',
              borderRadius: 12, border: `2px solid ${edge}`, background: picked && !closed ? t.surfaceAlt : t.surface,
              color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 16, fontWeight: 600,
              cursor: open && canAnswer && !answer ? 'pointer' : 'default' }}>
            <span aria-hidden="true" className="placer-mono" style={{ width: 28, height: 28, borderRadius: 8, flex: '0 0 auto',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
              background: right ? RIGHT : wrong ? WRONG : t.surfaceAlt, color: right || wrong ? '#FFFFFF' : t.ink }}>
              {LETTERS[index]}
            </span>
            <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
              <span className="placer-visually-hidden">{LETTERS[index]}: </span>{choice}
            </span>
            {right && <Icon name="check" size={18} stroke={2.4} />}
            {right && <span className="placer-visually-hidden"> (the right answer)</span>}
          </button>
        );
      })}
    </div>
  );
}

function Blank({ t, answer, open, canAnswer, onAnswer }) {
  const [draft, setDraft] = useState('');
  if (!canAnswer) return null;
  if (answer && !answer.skipped) {
    return (
      <p style={{ fontSize: 16, color: t.inkDim, margin: 0 }}>
        You answered <strong style={{ color: t.ink }}>{String(answer.value)}</strong>.
      </p>
    );
  }
  if (!open || answer) return null;

  return (
    <form onSubmit={(event) => { event.preventDefault(); if (draft.trim()) onAnswer(draft.trim()); }}
      style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 520 }}>
      <input
        aria-label="Your answer"
        type="text"
        maxLength={MAX_BLANK_LENGTH}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        autoComplete="off"
        placeholder="Fill in the blank"
        style={{ flex: 1, minWidth: 0, height: 52, padding: '0 14px', borderRadius: 12,
          border: `1px solid ${t.lineStrong}`, background: t.surface, color: t.ink,
          fontFamily: 'var(--placer-font)', fontSize: 18, fontWeight: 700 }} />
      <Btn t={t} type="submit" variant="primary" disabled={!draft.trim()}>Answer</Btn>
    </form>
  );
}

/**
 * One question: asked while it is open, and marked once it has closed. `canAnswer` is
 * false for the facilitator, who sees it as the room does but takes no part.
 */
function QuestionCard({ t, config, index, left, closed, answer = null, canAnswer = true, onAnswer, children }) {
  const questions = quizQuestions(config);
  const question = questions[index];
  const seconds = quizSeconds(config);
  const open = !closed;

  return (
    <Panel t={t} title={`Question ${index + 1} of ${questions.length}`} aside={open && (
      <span role="timer" aria-label="Time left" className="placer-mono"
        style={{ fontSize: 20, fontWeight: 700, color: left <= 5 ? WRONG : t.ink }}>
        {left}
      </span>
    )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <p className="placer-disp" style={{ margin: 0, fontSize: 'clamp(22px, 3.2vw, 32px)', fontWeight: 700,
          color: t.ink, lineHeight: 1.25, letterSpacing: '-0.02em', overflowWrap: 'anywhere' }}>
          {question.text}
        </p>

        {question.kind === 'blank' ? (
          // Keyed by the question, so a half-typed answer does not carry into the next one.
          <Blank key={index} t={t} answer={answer} open={open} canAnswer={canAnswer} onAnswer={onAnswer} />
        ) : (
          <Choices t={t} question={question} answer={answer} open={open} closed={closed} canAnswer={canAnswer}
            onAnswer={onAnswer} />
        )}

        {canAnswer && open && !answer && (
          <div>
            <Btn t={t} variant="ghost" size="sm" onClick={() => onAnswer(null)}>Skip this question</Btn>
          </div>
        )}
        {canAnswer && open && answer && (
          <p role="status" style={{ fontSize: 15, color: t.inkDim, margin: 0 }}>
            {answer.skipped ? 'Skipped.' : 'Answer locked in.'} The answer is shown when the time is up.
          </p>
        )}
        {closed && canAnswer && <Outcome t={t} question={question} answer={answer} seconds={seconds} />}
        {closed && !canAnswer && question.kind === 'blank' && (
          <p style={{ fontSize: 16, color: t.inkDim, margin: 0 }}>
            The answer is <strong style={{ color: RIGHT }}>{question.answer}</strong>.
          </p>
        )}
        {children}
      </div>
    </Panel>
  );
}

/** The players in order of score, with whoever is looking picked out. */
function Scoreboard({ t, players, me = null, title = 'Scoreboard' }) {
  return (
    <Panel t={t} title={title}>
      {players.length === 0 ? (
        <p style={{ fontSize: 14, color: t.inkDim, margin: 0 }}>Nobody has joined yet.</p>
      ) : (
        <ol aria-label={title} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {players.map((player, index) => (
            <li key={`${player.nickname}-${index}`} style={{ display: 'flex', alignItems: 'baseline', gap: 12,
              padding: '8px 0', borderBottom: `1px solid ${t.line}` }}>
              <span className="placer-mono" style={{ width: 24, fontSize: 12, color: t.inkDim }}>{index + 1}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: player.nickname === me ? 700 : 600,
                color: t.ink, overflowWrap: 'anywhere' }}>
                {player.nickname}{player.nickname === me && <span style={{ color: t.inkDim, fontWeight: 500 }}> (you)</span>}
              </span>
              <span className="placer-mono" style={{ fontSize: 12, color: t.inkDim }}>{player.correct} right</span>
              <span className="placer-mono" style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>{player.score}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

/** An answer as it is recorded: skipped, or what was given and how long it took. */
const record = (value, pace, config) => (value === null ? { skipped: true } : { value, ms: elapsed(pace, config) });

/** Somebody who joined a room: a nickname, then whatever the facilitator has put up. */
function PlayerGame({ t, room }) {
  const config = room.config;
  // What this browser has answered is kept (toolkit/rooms' rememberAnswer), so a
  // refresh half way through does not cost somebody their nickname or their score.
  const [mine, setMine] = useState(() => {
    const kept = rememberedAnswer(room.roomId);
    return kept && typeof kept.nickname === 'string' && kept.answers && typeof kept.answers === 'object'
      ? { nickname: kept.nickname, answers: kept.answers } : emptyQuizState();
  });
  const roomRef = useRef(room);
  roomRef.current = room;

  const update = (next) => {
    setMine(next);
    rememberAnswer(room.roomId, next);
    roomRef.current.publish(next);
  };

  const { pace, players } = room.combined ?? { pace: null, players: [] };
  const { stage, index, left } = useStage(pace, config);
  const own = scoreOf(mine, config);

  if (!mine.nickname) {
    return <NicknameForm t={t} onSubmit={(nickname) => update({ ...mine, nickname })} />;
  }

  if (stage === 'lobby') {
    return (
      <Panel t={t} title="You are in">
        <p role="status" style={{ fontSize: 18, fontWeight: 700, color: t.ink, margin: '0 0 8px' }}>
          Welcome, {mine.nickname}.
        </p>
        <p style={{ fontSize: 15, color: t.inkDim, margin: 0, lineHeight: 1.6 }}>
          The quiz starts when the facilitator is ready. {players.length} {players.length === 1 ? 'player' : 'players'} so far.
        </p>
      </Panel>
    );
  }

  if (stage === 'over') {
    const place = players.findIndex((player) => player.nickname === mine.nickname) + 1;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Panel t={t} title="That is the quiz">
          <p role="status" className="placer-disp" style={{ fontSize: 32, fontWeight: 700, color: t.ink, margin: 0,
            letterSpacing: '-0.02em' }}>
            {own.score} points
          </p>
          <p style={{ fontSize: 15, color: t.inkDim, margin: '8px 0 0' }}>
            {own.correct} of {quizQuestions(config).length} right{place > 0 ? `, and number ${place} of ${players.length}.` : '.'}
          </p>
        </Panel>
        <Scoreboard t={t} players={players} me={mine.nickname} title="Final scores" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <QuestionCard t={t} config={config} index={index} left={left} closed={stage === 'answer'}
        answer={answerTo(mine, index)}
        onAnswer={(value) => update(withAnswer(mine, index, record(value, pace, config)))} />
      {stage === 'answer' && <Scoreboard t={t} players={players} me={mine.nickname} />}
    </div>
  );
}

/** The facilitator of a room: they set the pace, and watch the scores. */
function HostGame({ t, room }) {
  const config = room.config;
  const total = quizQuestions(config).length;
  const { pace: heard, players } = room.combined ?? { pace: null, players: [] };
  // The pace as this browser last set it, which shows straight away rather than once
  // the room has heard. Undefined until this browser has touched it.
  const [own, setOwn] = useState(undefined);
  const pace = own !== undefined ? own : heard;
  const roomRef = useRef(room);
  roomRef.current = room;

  const setPace = (next) => {
    setOwn(next);
    roomRef.current.publish({ host: next });
  };

  const { stage, index, left } = useStage(pace, config);

  if (stage === 'lobby') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Panel t={t} title="Ready when you are">
          <p style={{ fontSize: 15, color: t.inkDim, margin: '0 0 16px', lineHeight: 1.6 }}>
            {total} {total === 1 ? 'question' : 'questions'}, {quizSeconds(config)} seconds each. People join with the
            room&rsquo;s PIN or QR code and pick a nickname; start once everybody is in.
          </p>
          <Btn t={t} variant="primary" icon="play" onClick={() => setPace(paceAt(0))}>Start the quiz</Btn>
        </Panel>
        <Scoreboard t={t} players={players} title="Players" />
      </div>
    );
  }

  if (stage === 'over') {
    return <Scoreboard t={t} players={players} title="Final scores" />;
  }

  const last = index >= total - 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <QuestionCard t={t} config={config} index={index} left={left} closed={stage === 'answer'} canAnswer={false}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {stage === 'question' ? (
            <Btn t={t} variant="primary" onClick={() => setPace(paceShown(pace))}>Show the answer</Btn>
          ) : (
            <Btn t={t} variant="primary" icon="arrowRight" onClick={() => setPace(paceAt(index + 1))}>
              {last ? 'Show the final scores' : 'Next question'}
            </Btn>
          )}
          <span role="status" className="placer-mono" style={{ fontSize: 12, color: t.inkDim }}>
            {answeredCount(players, index)} of {players.length} answered
          </span>
        </div>
      </QuestionCard>
      {stage === 'answer' && <Scoreboard t={t} players={players} />}
    </div>
  );
}

/** Outside a room: write a quiz, then play it alone to see how it goes. */
function SoloGame({ t }) {
  const [quiz, setQuiz] = useState(sampleQuiz);
  const [tried, setTried] = useState(false);
  const [phase, setPhase] = useState('write'); // 'write' | 'name' | 'play'
  const [mine, setMine] = useState(emptyQuizState);
  const [pace, setPace] = useState(null);
  const problems = useMemo(() => quizSetupProblems(quiz), [quiz]);
  const { stage, index, left } = useStage(phase === 'play' ? pace : null, quiz);
  const total = quizQuestions(quiz).length;

  const play = (nickname = mine.nickname) => {
    setMine({ nickname, answers: {} });
    setPace(paceAt(0));
    setPhase('play');
  };

  if (phase === 'write') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(260px, 1fr)', gap: 20, alignItems: 'start' }}>
        <Panel t={t} title="Write your quiz">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <QuestionsEditor t={t} questions={quiz.questions} onChange={(questions) => setQuiz({ ...quiz, questions })} />
            <TimeField t={t} seconds={quiz.seconds} onChange={(seconds) => setQuiz({ ...quiz, seconds })} />
            {tried && problems.length > 0 && (
              <ul role="alert" style={{ listStyle: 'none', margin: 0, padding: '12px 16px', borderRadius: 12,
                background: t.surfaceAlt, border: `1px solid ${t.line}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {problems.map((problem) => <li key={problem} style={{ fontSize: 14, color: t.ink }}>{problem}</li>)}
              </ul>
            )}
            <div>
              <Btn t={t} variant="primary" icon="play"
                onClick={() => { setTried(true); if (problems.length === 0) setPhase('name'); }}>
                Play this quiz
              </Btn>
            </div>
          </div>
        </Panel>

        <Panel t={t} title="How it works">
          <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, margin: 0 }}>
            Write up to twenty questions, each with four choices or a blank to fill in, and play them through
            here to try it out. A right answer scores 500 points and up to 500 more for speed; a wrong one, a
            skipped one or none in time scores nothing.
          </p>
          <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, margin: '12px 0 0' }}>
            To play with a group, add Pop Quiz to a project and set it up from the project&rsquo;s dashboard.
            Everybody joins the room with its PIN or QR code and picks a nickname, you put the questions up one
            at a time, and the scoreboard follows. A quiz written here is not saved.
          </p>
        </Panel>
      </div>
    );
  }

  if (phase === 'name') return <NicknameForm t={t} action="Start the quiz" onSubmit={play} />;

  if (stage === 'over') {
    const own = scoreOf(mine, quiz);
    return (
      <Panel t={t} title="That is the quiz">
        <p role="status" className="placer-disp" style={{ fontSize: 32, fontWeight: 700, color: t.ink, margin: 0,
          letterSpacing: '-0.02em' }}>
          {own.score} points
        </p>
        <p style={{ fontSize: 15, color: t.inkDim, margin: '8px 0 20px' }}>
          {mine.nickname}, you got {own.correct} of {total} right.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn t={t} variant="primary" icon="play" onClick={() => play()}>Play again</Btn>
          <Btn t={t} variant="outline" icon="pencil" onClick={() => setPhase('write')}>Edit the quiz</Btn>
        </div>
      </Panel>
    );
  }

  // Alone there is nobody to wait for, so an answer closes the question at once.
  const answer = (value) => {
    setMine(withAnswer(mine, index, record(value, pace, quiz)));
    setPace(paceShown(pace));
  };

  return (
    <QuestionCard t={t} config={quiz} index={index} left={left} closed={stage === 'answer'}
      answer={answerTo(mine, index)} onAnswer={answer}>
      {stage === 'answer' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Btn t={t} variant="primary" icon="arrowRight" onClick={() => setPace(paceAt(index + 1))}>
            {index >= total - 1 ? 'See your score' : 'Next question'}
          </Btn>
          <span className="placer-mono" style={{ fontSize: 12, color: t.inkDim }}>
            {scoreOf(mine, quiz).score} points so far
          </span>
        </div>
      )}
    </QuestionCard>
  );
}

export function PopQuiz({ t, room }) {
  if (room?.status === 'open') {
    if (!room.config) {
      return (
        <Panel t={t} title="No quiz here">
          <p style={{ fontSize: 15, color: t.inkDim, margin: 0 }}>This room was opened without a quiz to play.</p>
        </Panel>
      );
    }
    return room.isHost ? <HostGame t={t} room={room} /> : <PlayerGame t={t} room={room} />;
  }
  return <SoloGame t={t} />;
}

export default PopQuiz;
