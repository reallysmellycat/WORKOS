import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { useSettingsQuery, type Settings } from '@/lib/settings';
import { FeedbackProvider } from '@/components/feedback';
import { Layout } from './Layout';
import { Loading } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { requestPersistentStorage } from '@/lib/db';
import { resolveColor } from '@/lib/tokens';
import { ensureBuiltInTemplates } from '@/lib/templates';

const Dashboard = lazy(() => import('@/features/dashboard/Dashboard'));
const MyDay = lazy(() => import('@/features/myday/MyDay'));
const CalendarPage = lazy(() => import('@/features/calendar/CalendarPage'));
const TasksPage = lazy(() => import('@/features/tasks/TasksPage'));
const ProjectsPage = lazy(() => import('@/features/projects/ProjectsPage'));
const ProjectDetail = lazy(() => import('@/features/projects/ProjectDetail'));
const CampaignsPage = lazy(() => import('@/features/campaigns/CampaignsPage'));
const CampaignDetail = lazy(() => import('@/features/campaigns/CampaignDetail'));
const ContentStudio = lazy(() => import('@/features/content/ContentStudio'));
const IdeasPage = lazy(() => import('@/features/ideas/IdeasPage'));
const LibraryPage = lazy(() => import('@/features/library/LibraryPage'));
const NotesPage = lazy(() => import('@/features/notes/NotesPage'));
const DocumentsPage = lazy(() => import('@/features/documents/DocumentsPage'));
const DocumentEditor = lazy(() => import('@/features/documents/DocumentEditor'));
const AnalyticsPage = lazy(() => import('@/features/analytics/AnalyticsPage'));
const ReviewsPage = lazy(() => import('@/features/reviews/ReviewsPage'));
const AssistantPage = lazy(() => import('@/features/assistant/AssistantPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const NotFound = lazy(() => import('@/features/NotFound'));

function useThemeSync(s: Settings | undefined) {
  useEffect(() => {
    if (!s) return;
    const apply = () => {
      const dark = s.theme === 'dark' || (s.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', dark);
      if (s.accent === 'sage') delete document.documentElement.dataset.accent;
      else document.documentElement.dataset.accent = s.accent;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolveColor('rgb(var(--bg))'));
      try {
        localStorage.setItem('workos-theme', s.theme);
        localStorage.setItem('workos-accent', s.accent === 'sage' ? '' : s.accent);
      } catch {
        /* private mode */
      }
    };
    apply();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [s?.theme, s?.accent]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function App() {
  const settings = useSettingsQuery();
  useThemeSync(settings);
  const location = useLocation();

  useEffect(() => {
    void requestPersistentStorage();
    void ensureBuiltInTemplates();
  }, []);

  if (!settings) return <Loading />;

  return (
    <FeedbackProvider>
      {!settings.onboarded ? (
        <Onboarding />
      ) : (
        <Layout settings={settings}>
          <ErrorBoundary inline key={location.pathname}>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/my-day" element={<MyDay />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/projects/:id" element={<ProjectDetail />} />
                <Route path="/campaigns" element={<CampaignsPage />} />
                <Route path="/campaigns/:id" element={<CampaignDetail />} />
                <Route path="/content" element={<ContentStudio />} />
                <Route path="/ideas" element={<IdeasPage />} />
                <Route path="/library" element={<LibraryPage />} />
                <Route path="/notes" element={<NotesPage />} />
                <Route path="/notes/:id" element={<NotesPage />} />
                <Route path="/documents" element={<DocumentsPage />} />
                <Route path="/documents/:id" element={<DocumentEditor />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/reviews" element={<ReviewsPage />} />
                <Route path="/reviews/:month" element={<ReviewsPage />} />
                <Route path="/assistant" element={<AssistantPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </Layout>
      )}
      <UpdatePrompt />
    </FeedbackProvider>
  );
}
