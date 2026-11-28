import { useState } from 'react';
import { LuDownload } from 'react-icons/lu';
import './results/Results.css';
import PageHeader from '../components/PageHeader';
import { Button } from '../components/ui';
import ResultStats from './results/ResultStats';
import SubjectHeatmap from './results/SubjectHeatmap';
import AccelerationTable from './results/AccelerationTable';
import QuestionAnalysis from './results/QuestionAnalysis';
import ConversionCard from './results/ConversionCard';
import RecommendationsCard from './results/RecommendationsCard';
import AttemptGrowth from './results/AttemptGrowth';
import UpgradePromo from './results/UpgradePromo';
import NotificationBell from '../components/notifications/NotificationBell';

export default function Results() {
  const [search, setSearch] = useState('');

  return (
    <div className="v2-results-page">
      <PageHeader title="Results & Analytics" search={search} onSearch={setSearch}>
        <NotificationBell />
        <Button>
          <LuDownload aria-hidden="true" /> Export Report
        </Button>
      </PageHeader>

      <ResultStats />

      <div className="v2-results-page__grid">
        <div className="v2-results-page__col">
          <SubjectHeatmap />
          <AccelerationTable />
        </div>
        <div className="v2-results-page__col">
          <QuestionAnalysis />
          <div className="v2-results-page__pair">
            <ConversionCard />
            <RecommendationsCard />
          </div>
          <div className="v2-results-page__pair v2-results-page__pair--grow">
            <AttemptGrowth />
            <UpgradePromo />
          </div>
        </div>
      </div>
    </div>
  );
}
