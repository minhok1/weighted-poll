import { Calendar } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';
import type { SessionRow } from '../types/poll';

type Props = {
  sessions: SessionRow[];
  loading: boolean;
};

export function PastPage({ sessions, loading }: Props) {
  return (
    <View className="flex-1 w-full self-stretch bg-white">
      <View className="w-full bg-[#111D35] px-[18px] py-[14px]">
        <Text className="text-[20px] font-bold text-white">Past Sessions</Text>
        <Text className="mt-[6px] text-[15px] text-[#D6DEEA]">
          {loading ? 'Loading...' : `${sessions.length} sessions completed`}
        </Text>
      </View>

      <ScrollView className="flex-1 w-full" contentContainerClassName="w-full px-[14px] pb-[22px] pt-[14px]">
        {sessions.length === 0 ? (
          <View className="mb-[14px] rounded-[14px] border border-[#E7ECF2] bg-white p-[14px]">
            <Text className="text-[15px] text-[#4D5A71]">No past sessions yet.</Text>
          </View>
        ) : (
          sessions.map((session) => {
            const firstResult = Array.isArray(session.final_ranking)
              ? (session.final_ranking[0] as { title?: string } | undefined)
              : undefined;

            return (
              <View key={session.id} className="mb-[14px] rounded-[14px] border border-[#E7ECF2] bg-white p-[14px]">
                <View className="mb-[6px] flex-row items-center">
                  <Calendar size={15} color="#5B6780" strokeWidth={2.2} />
                  <Text className="ml-[6px] text-[15px] text-[#5B6780]">{formatDate(session.created_at)}</Text>
                </View>
                <Text className="text-[18px] font-bold text-[#111D35]">{session.title}</Text>
                <Text className="mt-[2px] text-[15px] text-[#4D5A71]">
                  Chosen book: {firstResult?.title ?? 'Not published'}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function formatDate(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

