import { BookOpen, Clock3, UserRound, Users } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import type { Tab } from '../types/poll';

type Props = {
  activeTab: Tab;
  onChange: (tab: Tab) => void;
};

export function BottomTabBar({ activeTab, onChange }: Props) {
  return (
    <View className="h-[74px] w-full self-stretch flex-row items-center justify-between border-t border-[#EEF1F5] bg-white px-[10px]">
      <TabButton
        label="Current"
        icon={<BookOpen size={22} color={activeTab === 'current' ? '#2E9A98' : '#63718B'} strokeWidth={2.2} />}
        isActive={activeTab === 'current'}
        onPress={() => onChange('current')}
      />
      <TabButton
        label="Past"
        icon={<Clock3 size={22} color={activeTab === 'past' ? '#2E9A98' : '#63718B'} strokeWidth={2.2} />}
        isActive={activeTab === 'past'}
        onPress={() => onChange('past')}
      />
      <TabButton
        label="Groups"
        icon={
          <Users size={22} color={activeTab === 'groups' ? '#2E9A98' : '#63718B'} strokeWidth={2.2} />
        }
        isActive={activeTab === 'groups'}
        onPress={() => onChange('groups')}
      />
      <TabButton
        label="Account"
        icon={
          <UserRound size={22} color={activeTab === 'account' ? '#2E9A98' : '#63718B'} strokeWidth={2.2} />
        }
        isActive={activeTab === 'account'}
        onPress={() => onChange('account')}
      />
    </View>
  );
}

type TabButtonProps = {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onPress: () => void;
};

function TabButton({ label, icon, isActive, onPress }: TabButtonProps) {
  return (
    <Pressable
      className={`h-[54px] flex-1 items-center justify-center rounded-xl ${isActive ? 'bg-[#EDFFF8]' : ''}`}
      onPress={onPress}
    >
      {icon}
      <Text className={`text-sm font-semibold ${isActive ? 'text-[#2E9A98]' : 'text-[#63718B]'}`}>{label}</Text>
    </Pressable>
  );
}

