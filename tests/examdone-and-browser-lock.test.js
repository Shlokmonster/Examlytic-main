import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('ExamDone Score Counting, Answer Key & PDF Preparation', () => {
  it('normalizes both optionA-D objects and options array formats without losing correctAnswer', () => {
    const rawQuestions = [
      {
        id: 'uuid-1',
        question: 'What is 2 + 2?',
        optionA: '3',
        optionB: '4',
        optionC: '5',
        optionD: '6',
        correct_answer: 'B'
      },
      {
        question_text: 'Capital of France?',
        options: ['Berlin', 'Madrid', 'Paris', 'Rome'],
        correctAnswer: 'C'
      }
    ];

    const optionLetters = ['A', 'B', 'C', 'D'];
    const normalized = rawQuestions.map((q, i) => {
      const fallbackId = `q-${i}`;
      let options = [];
      if (Array.isArray(q.options) && q.options.length > 0) {
        options = q.options.map((opt, oidx) => ({
          letter: optionLetters[oidx],
          text: String(opt),
          value: optionLetters[oidx]
        }));
      } else {
        optionLetters.forEach(letter => {
          const key = `option${letter}`;
          if (q[key]) options.push({ letter, text: String(q[key]), value: letter });
        });
      }
      return {
        ...q,
        id: q.id || fallbackId,
        fallbackId,
        text: q.question || q.question_text,
        options,
        correctAnswer: String(q.correct_answer ?? q.correctAnswer ?? '').trim()
      };
    });

    assert.strictEqual(normalized[0].options.length, 4);
    assert.strictEqual(normalized[0].options[1].letter, 'B');
    assert.strictEqual(normalized[0].options[1].text, '4');
    assert.strictEqual(normalized[0].correctAnswer, 'B');

    assert.strictEqual(normalized[1].id, 'q-1');
    assert.strictEqual(normalized[1].options.length, 4);
    assert.strictEqual(normalized[1].options[2].letter, 'C');
    assert.strictEqual(normalized[1].options[2].text, 'Paris');
    assert.strictEqual(normalized[1].correctAnswer, 'C');
  });

  it('selects latest submitted attempt instead of abandoned null-submitted_at rows', () => {
    const attempts = [
      { id: 'abandoned-1', submitted_at: null, status: 'abandoned', answers: {} },
      { id: 'submitted-1', submitted_at: '2026-11-25T10:00:00Z', status: 'completed', answers: { 'q-0': 'B', 'q-1': 'C' } }
    ];

    const submittedOnly = attempts
      .filter(a => a.submitted_at !== null)
      .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

    assert.strictEqual(submittedOnly.length, 1);
    assert.strictEqual(submittedOnly[0].id, 'submitted-1');
    assert.strictEqual(submittedOnly[0].answers['q-0'], 'B');
  });

  it('counts correct answers accurately across letter and text answer formats', () => {
    const questions = [
      { id: 'q-0', fallbackId: 'q-0', options: [{ letter: 'A', text: '3' }, { letter: 'B', text: '4' }], correctAnswer: 'B' },
      { id: 'uuid-2', fallbackId: 'q-1', options: [{ letter: 'A', text: 'London' }, { letter: 'C', text: 'Paris' }], correctAnswer: 'C' }
    ];
    const answersMap = { 'q-0': 'b', 'q-1': 'Paris' };

    let correctCount = 0;
    questions.forEach((q, idx) => {
      const rawAns = answersMap[q.id] ?? answersMap[q.fallbackId] ?? answersMap[`q-${idx}`];
      const uNorm = String(rawAns || '').trim().toUpperCase();
      const cNorm = String(q.correctAnswer || '').trim().toUpperCase();
      const uOpt = q.options.find(o => o.letter.toUpperCase() === uNorm || o.text.toUpperCase() === uNorm);
      const cOpt = q.options.find(o => o.letter.toUpperCase() === cNorm || o.text.toUpperCase() === cNorm);
      if (uNorm === cNorm || (uOpt && cOpt && uOpt.letter === cOpt.letter)) {
        correctCount++;
      }
    });

    assert.strictEqual(correctCount, 2);
  });
});

describe('Diagnostics Camera Search & Browser Lock Enforcement', () => {
  it('filters videoinput devices when scanning available cameras', () => {
    const devices = [
      { kind: 'audioinput', deviceId: 'mic-1', label: 'Built-in Mic' },
      { kind: 'videoinput', deviceId: 'cam-1', label: 'FaceTime HD Camera' },
      { kind: 'videoinput', deviceId: 'cam-2', label: 'USB External Webcam' },
      { kind: 'audiooutput', deviceId: 'spk-1', label: 'Speakers' }
    ];

    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    assert.strictEqual(videoDevices.length, 2);
    assert.strictEqual(videoDevices[0].deviceId, 'cam-1');
    assert.strictEqual(videoDevices[1].deviceId, 'cam-2');
  });
});

