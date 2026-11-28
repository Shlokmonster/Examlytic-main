import { useState } from 'react';
import './exams/Exams.css';
import ExamsHeader from './exams/ExamsHeader';
import ExamStats from './exams/ExamStats';
import HeroBanner from './exams/HeroBanner';
import ManageExams from './exams/ManageExams';
import SubjectInsights from './exams/SubjectInsights';
import SubjectScores from './exams/SubjectScores';

export default function Exams() {
  const [search, setSearch] = useState('');

  return (
    <div className="v2-exams">
      <ExamsHeader search={search} onSearch={setSearch} />

      <div className="v2-exams__grid">
        <div className="v2-exams__main">
          <ExamStats />
          <HeroBanner />
          <ManageExams search={search} />
        </div>
        <aside className="v2-exams__side">
          <SubjectInsights />
          <SubjectScores />
        </aside>
      </div>
    </div>
  );
}
