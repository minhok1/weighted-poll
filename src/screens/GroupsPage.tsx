import * as Clipboard from 'expo-clipboard';
import { User } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { GroupRow } from '../types/poll';

type Props = {
  groups: GroupRow[];
  activeGroupId: string | null;
  error: string | null;
  onCreateGroup: (groupName: string) => Promise<boolean>;
  onJoinGroup: (inviteCode: string) => Promise<boolean>;
  onSelectGroup: (groupId: string) => void;
  loading: boolean;
};

export function GroupsPage({
  groups,
  activeGroupId,
  error,
  onCreateGroup,
  onJoinGroup,
  onSelectGroup,
  loading,
}: Props) {
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [copiedGroupId, setCopiedGroupId] = useState<string | null>(null);

  return (
    <View className="flex-1 w-full self-stretch bg-white">
      <View className="w-full bg-[#111D35] px-[18px] py-[14px]">
        <Text className="text-[20px] font-bold text-white">Groups</Text>
        <Text className="mt-[6px] text-[15px] text-[#D6DEEA]">{groups.length} groups joined</Text>
      </View>

      <ScrollView className="flex-1 w-full" contentContainerClassName="w-full px-[14px] pb-[22px] pt-[14px]">
        <View className="mb-[14px] rounded-[14px] border border-[#E7ECF2] bg-white p-[14px]">
          <Text className="mb-2 text-[18px] font-bold text-[#111D35]">Create a group</Text>
          <TextInput
            className="mb-[10px] h-12 rounded-xl border border-[#E7ECF2] px-[14px] text-[17px] text-[#111D35]"
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Group name"
            placeholderTextColor="#A2AABC"
          />
          <Pressable
            className="mt-2 h-11 items-center justify-center rounded-[10px] bg-[#2E9A98]"
            onPress={async () => {
              const ok = await onCreateGroup(groupName);
              if (ok) {
                setGroupName('');
              }
            }}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-[15px] font-bold text-white">Create Group</Text>
            )}
          </Pressable>
        </View>

        <View className="mb-[14px] rounded-[14px] border border-[#E7ECF2] bg-white p-[14px]">
          <Text className="mb-2 text-[18px] font-bold text-[#111D35]">Join with invite code</Text>
          <TextInput
            className="mb-[10px] h-12 rounded-xl border border-[#E7ECF2] px-[14px] text-[17px] text-[#111D35]"
            value={inviteCode}
            onChangeText={setInviteCode}
            placeholder="Invite code"
            placeholderTextColor="#A2AABC"
            autoCapitalize="characters"
          />
          <Pressable
            className="mt-2 h-11 items-center justify-center rounded-[10px] bg-[#273655]"
            onPress={async () => {
              const ok = await onJoinGroup(inviteCode);
              if (ok) {
                setInviteCode('');
              }
            }}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-[15px] font-bold text-white">Join Group</Text>
            )}
          </Pressable>
        </View>

        {error ? <Text className="mb-[10px] text-[13px] text-[#9F1D1D]">{error}</Text> : null}

        <Text className="mb-[10px] mt-1 text-[16px] font-bold text-[#2A3550]">Your groups</Text>
        {groups.length === 0 ? (
          <View className="mb-[14px] rounded-[14px] border border-[#E7ECF2] bg-white p-[14px]">
            <Text className="text-[15px] text-[#4D5A71]">You are not in any groups yet. Join with an invite link.</Text>
          </View>
        ) : (
          groups.map((group) => (
            <Pressable
              key={group.id}
              className={`mb-[10px] rounded-[14px] border p-[14px] ${
                group.id === activeGroupId ? 'border-[#2E9A98] bg-[#EDFFF8]' : 'border-[#E7ECF2] bg-white'
              }`}
              onPress={() => onSelectGroup(group.id)}
            >
              <Text className={`text-[18px] font-bold ${group.id === activeGroupId ? 'text-[#1F6E6C]' : 'text-[#111D35]'}`}>
                {group.name}
              </Text>
              <View className="mt-[6px] flex-row items-center gap-1">
                <User size={14} color="#6D7890" strokeWidth={2.2} />
                <Text className="text-[13px] text-[#6D7890]">{group.member_count ?? 0}</Text>
              </View>
              <View className="mt-[8px] flex-row items-center gap-2">
                <Text className="text-[14px] text-[#4D5A71]">Invite code: {group.invite_code}</Text>
                <Pressable
                  className="rounded-md bg-[#ECEEF3] px-2 py-1"
                  onPress={async () => {
                    await Clipboard.setStringAsync(group.invite_code);
                    setCopiedGroupId(group.id);
                  }}
                >
                  <Text className="text-[12px] font-bold text-[#273655]">Copy</Text>
                </Pressable>
                {copiedGroupId === group.id ? <Text className="text-[12px] font-bold text-[#177245]">Copied</Text> : null}
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

