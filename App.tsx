import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBar } from './src/components/BottomTabBar';
import { usePollData } from './src/hooks/usePollData';
import { CurrentPage } from './src/screens/CurrentPage';
import { GroupsPage } from './src/screens/GroupsPage';
import { IdentityPage } from './src/screens/IdentityPage';
import { PastPage } from './src/screens/PastPage';
import type { Tab } from './src/types/poll';
import './global.css';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>('current');
  const poll = usePollData();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    void poll.refresh();
    // Initial load only; depending on poll.refresh causes re-fetch loops
    // because refresh callback identity changes with hook state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-white" style={{ width }} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <View className="flex-1 bg-white" style={{ width }}>
        {activeTab === 'current' ? (
          <CurrentPage
            loading={poll.loading}
            error={poll.errorScope === 'current' ? poll.error : null}
            activeGroupName={poll.activeGroup?.name ?? null}
            currentSession={poll.currentSession}
            options={poll.options}
            submissions={poll.submissions}
            memberDisplayNames={poll.memberDisplayNames}
            sessionRatings={poll.sessionRatings}
            userId={poll.userId}
            onCreateSession={(title) => poll.createSession({ title })}
            onAddOption={(title, details) => poll.addOption({ title, details })}
            onRemoveOption={poll.removeOption}
            onUpdateOption={poll.updateOption}
            onUpdateSessionPhase={poll.updateSessionPhase}
            onSubmitRanking={poll.submitRanking}
            onSubmitSessionRating={poll.submitSessionRating}
          />
        ) : null}
        {activeTab === 'past' ? <PastPage sessions={poll.pastSessions} loading={poll.loading} /> : null}
        {activeTab === 'groups' ? (
          <GroupsPage
            groups={poll.groups}
            activeGroupId={poll.activeGroupId}
            error={poll.errorScope === 'groups' ? poll.error : null}
            onCreateGroup={poll.createGroup}
            onJoinGroup={poll.joinGroup}
            onSelectGroup={poll.selectActiveGroup}
            loading={poll.loading}
          />
        ) : null}
        {activeTab === 'account' ? (
          <IdentityPage
            userId={poll.userId}
            displayName={poll.displayName}
            error={poll.errorScope === 'account' ? poll.error : null}
            onSignUp={poll.signUpWithEmail}
            onSignIn={poll.signInWithEmail}
            onSignOut={poll.signOutUser}
            onUpdateDisplayName={poll.updateDisplayName}
            loading={poll.loading}
          />
        ) : null}

        <BottomTabBar activeTab={activeTab} onChange={setActiveTab} bottomInset={insets.bottom} />
      </View>
    </SafeAreaView>
  );
}
