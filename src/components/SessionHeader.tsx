import { Text, View } from 'react-native';
import type { SessionPhase } from '../types/poll';

type Props = {
  groupName: string;
  sessionName: string;
  phase: SessionPhase | null;
};

export function SessionHeader({ groupName, sessionName, phase }: Props) {
  return (
    <View className="bg-[#111D35] px-[18px] py-[14px]">
      <View className="flex-row items-center justify-between">
        <View className="max-w-[230px]">
          <Text className="text-[14px] font-semibold text-[#D6DEEA]">{groupName}</Text>
          <Text className="mt-[2px] text-[20px] font-bold tracking-[0.2px] text-white">{sessionName}</Text>
        </View>
        <View className={`rounded-full px-[14px] py-[6px] ${phaseBgClass(phase)}`}>
          <Text className="text-[15px] font-bold text-white">{phaseLabel(phase)}</Text>
        </View>
      </View>
      {phase === 'results' ? (
        <Text className="mt-[10px] text-[14px] font-semibold text-[#B9FFE8]">Weighted ranking ready</Text>
      ) : null}
    </View>
  );
}

function phaseLabel(phase: SessionPhase | null) {
  if (!phase) {
    return 'No active session';
  }
  if (phase === 'brainstorming') {
    return 'Brainstorming';
  }
  if (phase === 'voting') {
    return 'Voting';
  }
  if (phase === 'results') {
    return 'Results';
  }
  return 'Closed';
}

function phaseBgClass(phase: SessionPhase | null) {
  return 'bg-[#22B6AA]';
}

