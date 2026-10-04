import { Navigate, Route, Routes } from 'react-router-dom';
import { VC_Alert } from './components/VC_Alert';
import { VC_Nav } from './components/VC_Nav';
import { CourseDetailsScreen } from './screens/CourseDetailsScreen';
import { CoursesScreen } from './screens/CoursesScreen';
import { DiscoverScreen } from './screens/DiscoverScreen';
import { GenerationScreen } from './screens/GenerationScreen';
import { LessonEditorScreen } from './screens/LessonEditorScreen';
import { ResearchScreen } from './screens/ResearchScreen';
import { TeasersScreen } from './screens/TeasersScreen';

/**
 * App shell.
 *
 * VC_Alert is mounted once here, which is what makes "every server error shows
 * an alert" true for the whole application: sharedService raises the alert,
 * this component renders it, and no screen has to think about it.
 */
export function App() {
  return (
    <div className="vc-app">
      <VC_Nav />
      <VC_Alert />

      <main className="vc-main">
        <Routes>
          <Route path="/" element={<Navigate to="/discover" replace />} />
          <Route path="/discover" element={<DiscoverScreen />} />
          <Route path="/research/:topicId" element={<ResearchScreen />} />
          <Route path="/courses" element={<CoursesScreen />} />
          <Route path="/courses/:courseId" element={<CourseDetailsScreen />} />
          <Route path="/lessons/:lessonId" element={<LessonEditorScreen />} />
          <Route path="/teasers" element={<TeasersScreen />} />
          <Route path="/generation" element={<GenerationScreen />} />
          <Route path="*" element={<Navigate to="/discover" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
