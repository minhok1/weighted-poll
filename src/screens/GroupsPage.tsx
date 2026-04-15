import * as Clipboard from 'expo-clipboard';
import { ArrowLeft, Info, Settings, User } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { GroupRow } from '../types/poll';

type Props = {
  groups: GroupRow[];
  activeGroupId: string | null;
  error: string | null;
  onCreateGroup: (groupName: string) => Promise<boolean>;
  onJoinGroup: (inviteCode: string) => Promise<boolean>;
  onSelectGroup: (groupId: string) => void;
  onUpdateGroupSettings: (
    groupId: string,
    settings: { baseWeight: number; ratingSplit: number; ratingLookback: number; firstPickLookback: number }
  ) => Promise<boolean>;
  loading: boolean;
};

const THUMB_SIZE = 28;

function WeightSlider({
  base,
  split,
  onChange,
}: {
  base: number;
  split: number;
  onChange: (newBase: number, newSplit: number) => void;
}) {
  const trackRef = useRef<View>(null);
  const trackMetaRef = useRef({ width: 0, pageX: 0 });
  const baseRef = useRef(base);
  const splitRef = useRef(split);
  baseRef.current = base;
  splitRef.current = split;

  const [trackWidth, setTrackWidth] = useState(0);
  const [tooltip, setTooltip] = useState<'base' | 'rating' | 'pick' | null>(null);

  const measureTrack = useCallback(() => {
    trackRef.current?.measure((_x, _y, w, _h, pageX) => {
      trackMetaRef.current = { width: w, pageX };
    });
  }, []);

  const clampFrac = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const basePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: measureTrack,
      onPanResponderMove: (_, gs) => {
        const { width, pageX } = trackMetaRef.current;
        if (!width) return;
        const frac = clampFrac((gs.moveX - pageX) / width, 0, splitRef.current);
        onChange(frac, splitRef.current);
      },
    })
  ).current;

  const splitPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: measureTrack,
      onPanResponderMove: (_, gs) => {
        const { width, pageX } = trackMetaRef.current;
        if (!width) return;
        const frac = clampFrac((gs.moveX - pageX) / width, baseRef.current, 1);
        onChange(baseRef.current, frac);
      },
    })
  ).current;

  const baseLeft = Math.max(0, Math.min(base * trackWidth - THUMB_SIZE / 2, trackWidth - THUMB_SIZE));
  const splitLeft = Math.max(
    0,
    Math.min(split * trackWidth - THUMB_SIZE / 2, trackWidth - THUMB_SIZE)
  );

  return (
    <View style={{ marginVertical: 4 }}>
      <View
        ref={trackRef}
        style={{ height: THUMB_SIZE + 16, justifyContent: 'center' }}
        onLayout={(e) => {
          setTrackWidth(e.nativeEvent.layout.width);
          measureTrack();
        }}
      >
        {/* Segmented track */}
        <View style={{ height: 8, borderRadius: 4, flexDirection: 'row', overflow: 'hidden', backgroundColor: '#E0E0E0' }}>
          <View style={{ flex: base, backgroundColor: '#90A4AE' }} />
          <View style={{ flex: Math.max(split - base, 0), backgroundColor: '#4DB6AC' }} />
          <View style={{ flex: Math.max(1 - split, 0), backgroundColor: '#00897B' }} />
        </View>

        {trackWidth > 0 ? (
          <>
            {/* Base circle */}
            <View
              style={{
                position: 'absolute',
                top: 8,
                left: baseLeft,
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                borderRadius: THUMB_SIZE / 2,
                backgroundColor: '#546E7A',
                borderWidth: 3,
                borderColor: '#FFFFFF',
                elevation: 4,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 3,
                zIndex: 2,
              }}
              {...basePan.panHandlers}
            />
            {/* Split circle */}
            <View
              style={{
                position: 'absolute',
                top: 8,
                left: splitLeft,
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                borderRadius: THUMB_SIZE / 2,
                backgroundColor: '#00695C',
                borderWidth: 3,
                borderColor: '#FFFFFF',
                elevation: 5,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 3,
                zIndex: 3,
              }}
              {...splitPan.panHandlers}
            />
          </>
        ) : null}
      </View>

      {/* Segment labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Pressable
          style={{ flex: 1, alignItems: 'flex-start' }}
          onPress={() => setTooltip((t) => (t === 'base' ? null : 'base'))}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text style={{ fontSize: 11, color: '#546E7A', fontWeight: '700', letterSpacing: 0.4 }}>
              BASE
            </Text>
            <Info size={11} color="#90A4AE" strokeWidth={2.5} />
          </View>
          <Text style={{ fontSize: 12, color: '#546E7A' }}>{(base * 100).toFixed(0)}%</Text>
        </Pressable>
        <Pressable
          style={{ flex: 1, alignItems: 'center' }}
          onPress={() => setTooltip((t) => (t === 'rating' ? null : 'rating'))}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text style={{ fontSize: 11, color: '#2E9A98', fontWeight: '700', letterSpacing: 0.4 }}>
              AVERAGE RATING
            </Text>
            <Info size={11} color="#4DB6AC" strokeWidth={2.5} />
          </View>
          <Text style={{ fontSize: 12, color: '#2E9A98' }}>
            {((split - base) * 100).toFixed(0)}%
          </Text>
        </Pressable>
        <Pressable
          style={{ flex: 1, alignItems: 'flex-end' }}
          onPress={() => setTooltip((t) => (t === 'pick' ? null : 'pick'))}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text style={{ fontSize: 11, color: '#004D40', fontWeight: '700', letterSpacing: 0.4 }}>
              PREFERRED CHOSEN
            </Text>
            <Info size={11} color="#2E7D6A" strokeWidth={2.5} />
          </View>
          <Text style={{ fontSize: 12, color: '#004D40' }}>{((1 - split) * 100).toFixed(0)}%</Text>
        </Pressable>
      </View>

      {/* Inline tooltip */}
      {tooltip === 'base' ? (
        <View style={{ marginTop: 8, backgroundColor: '#EEF3F7', borderRadius: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: '#546E7A' }}>
          <Text style={{ fontSize: 12, color: '#2A3550', lineHeight: 18 }}>
            <Text style={{ fontWeight: '700' }}>Base weight</Text> is the minimum voting power
            every member receives, regardless of their past session history. Everyone is guaranteed
            at least this share of influence.
          </Text>
        </View>
      ) : null}
      {tooltip === 'rating' ? (
        <View style={{ marginTop: 8, backgroundColor: '#E8F8F7', borderRadius: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: '#2E9A98' }}>
          <Text style={{ fontSize: 12, color: '#2A3550', lineHeight: 18 }}>
            <Text style={{ fontWeight: '700' }}>Average rating</Text> rewards members who
            consistently rate sessions highly. It is calculated from each member's own post-session
            star ratings over the last N sessions.
          </Text>
        </View>
      ) : null}
      {tooltip === 'pick' ? (
        <View style={{ marginTop: 8, backgroundColor: '#E0F2EE', borderRadius: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: '#00897B' }}>
          <Text style={{ fontSize: 12, color: '#2A3550', lineHeight: 18 }}>
            <Text style={{ fontWeight: '700' }}>Preferred chosen</Text> rewards members whose
            top-ranked pick ended up being the group's winner. It is calculated as the fraction of
            past sessions where the member's first choice matched the final result.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function GroupsPage({
  groups,
  activeGroupId,
  error,
  onCreateGroup,
  onJoinGroup,
  onSelectGroup,
  onUpdateGroupSettings,
  loading,
}: Props) {
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [copiedGroupId, setCopiedGroupId] = useState<string | null>(null);

  const [settingsGroupId, setSettingsGroupId] = useState<string | null>(null);
  const [draftBase, setDraftBase] = useState(0.6);
  const [draftSplit, setDraftSplit] = useState(0.8);
  const [draftRatingLookback, setDraftRatingLookback] = useState(2);
  const [draftFirstPickLookback, setDraftFirstPickLookback] = useState(2);
  const [saving, setSaving] = useState(false);

  const settingsGroup = useMemo(
    () => groups.find((g) => g.id === settingsGroupId) ?? null,
    [settingsGroupId, groups]
  );

  const openSettings = useCallback(
    (group: GroupRow) => {
      setSettingsGroupId(group.id);
      setDraftBase(group.base_weight ?? 0.6);
      setDraftSplit(group.rating_split ?? 0.8);
      setDraftRatingLookback(group.rating_lookback ?? 2);
      setDraftFirstPickLookback(group.first_pick_lookback ?? 2);
    },
    []
  );

  const handleSaveSettings = useCallback(async () => {
    if (!settingsGroupId) return;
    setSaving(true);
    const ok = await onUpdateGroupSettings(settingsGroupId, {
      baseWeight: draftBase,
      ratingSplit: draftSplit,
      ratingLookback: draftRatingLookback,
      firstPickLookback: draftFirstPickLookback,
    });
    setSaving(false);
    if (ok) setSettingsGroupId(null);
  }, [settingsGroupId, draftBase, draftSplit, draftRatingLookback, draftFirstPickLookback, onUpdateGroupSettings]);

  const handleSliderChange = useCallback((newBase: number, newSplit: number) => {
    setDraftBase(Math.round(newBase * 100) / 100);
    setDraftSplit(Math.round(newSplit * 100) / 100);
  }, []);

  if (settingsGroupId && settingsGroup) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        {/* Header */}
        <View style={{ backgroundColor: '#111D35', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 14 }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' }}>
            {settingsGroup.name}
          </Text>
          <Text style={{ fontSize: 14, color: '#D6DEEA', marginTop: 4 }}>Voting settings</Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 40 }}
        >
          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
            onPress={() => setSettingsGroupId(null)}
          >
            <ArrowLeft size={16} color="#4D5A71" strokeWidth={2.2} />
            <Text style={{ fontSize: 14, color: '#4D5A71', marginLeft: 5 }}>Back to Groups</Text>
          </Pressable>
          {/* Weight spectrum card */}
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#E7ECF2',
              padding: 18,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#111D35', marginBottom: 4 }}>
              Voting Weights
            </Text>
            <Text style={{ fontSize: 14, color: '#4D5A71', marginBottom: 16, lineHeight: 20 }}>
              Drag the grey circle to set the base weight everyone receives. Drag the teal circle to
              split the remaining weight between average session rating and preferred chosen rate.
            </Text>

            <WeightSlider
              base={draftBase}
              split={draftSplit}
              onChange={handleSliderChange}
            />

            <View
              style={{
                marginTop: 16,
                padding: 12,
                backgroundColor: '#F5F8FA',
                borderRadius: 10,
              }}
            >
              <Text style={{ fontSize: 13, color: '#4D5A71', lineHeight: 18 }}>
                Formula:{' '}
                <Text style={{ fontWeight: '600', color: '#111D35' }}>
                  weight = {(draftBase * 100).toFixed(0)}% base
                  {draftSplit - draftBase > 0
                    ? ` + ${((draftSplit - draftBase) * 100).toFixed(0)}% × average rating`
                    : ''}
                  {1 - draftSplit > 0
                    ? ` + ${((1 - draftSplit) * 100).toFixed(0)}% × preferred chosen`
                    : ''}
                </Text>
              </Text>
            </View>
          </View>

          {/* Lookback sessions card */}
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#E7ECF2',
              padding: 18,
              marginBottom: 20,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#111D35', marginBottom: 4 }}>
              Session Lookback
            </Text>
            <Text style={{ fontSize: 14, color: '#4D5A71', marginBottom: 16, lineHeight: 20 }}>
              How many past sessions to consider when calculating each component.
            </Text>

            <View
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, color: '#111D35', fontWeight: '500' }}>
                  Avg rating lookback
                </Text>
                <Text style={{ fontSize: 13, color: '#6D7890', marginTop: 2 }}>
                  Past sessions for avg rating
                </Text>
              </View>
              <TextInput
                style={{
                  width: 60,
                  height: 42,
                  borderWidth: 1,
                  borderColor: '#D0D8E4',
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  textAlign: 'center',
                  fontSize: 17,
                  fontWeight: '600',
                  color: '#111D35',
                  backgroundColor: '#F9FAFC',
                }}
                value={String(draftRatingLookback)}
                onChangeText={(v) => {
                  const n = parseInt(v, 10);
                  if (!isNaN(n) && n >= 1) setDraftRatingLookback(n);
                  else if (v === '') setDraftRatingLookback(1);
                }}
                keyboardType="numeric"
                maxLength={3}
              />
            </View>

            <View style={{ height: 1, backgroundColor: '#F0F3F7', marginBottom: 14 }} />

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, color: '#111D35', fontWeight: '500' }}>
                  Preferred chosen lookback
                </Text>
                <Text style={{ fontSize: 13, color: '#6D7890', marginTop: 2 }}>
                  Past sessions for preferred chosen
                </Text>
              </View>
              <TextInput
                style={{
                  width: 60,
                  height: 42,
                  borderWidth: 1,
                  borderColor: '#D0D8E4',
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  textAlign: 'center',
                  fontSize: 17,
                  fontWeight: '600',
                  color: '#111D35',
                  backgroundColor: '#F9FAFC',
                }}
                value={String(draftFirstPickLookback)}
                onChangeText={(v) => {
                  const n = parseInt(v, 10);
                  if (!isNaN(n) && n >= 1) setDraftFirstPickLookback(n);
                  else if (v === '') setDraftFirstPickLookback(1);
                }}
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
          </View>

          <Pressable
            style={{
              height: 48,
              backgroundColor: '#2E9A98',
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={handleSaveSettings}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                Save Settings
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    );
  }

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
              if (ok) setGroupName('');
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
              if (ok) setInviteCode('');
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
            <Text className="text-[15px] text-[#4D5A71]">
              You are not in any groups yet. Join with an invite link.
            </Text>
          </View>
        ) : (
          groups.map((group) => {
            const isActive = group.id === activeGroupId;
            const weightDisplay =
              group.my_weight !== undefined ? group.my_weight.toFixed(2) : null;

            return (
              <Pressable
                key={group.id}
                className={`mb-[10px] rounded-[14px] border p-[14px] ${
                  isActive ? 'border-[#2E9A98] bg-[#EDFFF8]' : 'border-[#E7ECF2] bg-white'
                }`}
                onPress={() => onSelectGroup(group.id)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text
                      className={`text-[18px] font-bold ${isActive ? 'text-[#1F6E6C]' : 'text-[#111D35]'}`}
                    >
                      {group.name}
                    </Text>
                    <View className="mt-[6px] flex-row items-center gap-1">
                      <User size={14} color="#6D7890" strokeWidth={2.2} />
                      <Text className="text-[13px] text-[#6D7890]">{group.member_count ?? 0}</Text>
                      {weightDisplay !== null ? (
                        <>
                          <Text className="text-[13px] text-[#6D7890]"> · </Text>
                          <Text
                            style={{
                              fontSize: 13,
                              color: isActive ? '#1F6E6C' : '#4D5A71',
                              fontWeight: '600',
                            }}
                          >
                            Your weight: {weightDisplay}
                          </Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                  <Pressable
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8,
                      backgroundColor: isActive ? '#F0FFFE' : '#FAFBFC',
                      borderWidth: 1,
                      borderColor: isActive ? '#C8EDEB' : '#E7ECF2',
                    }}
                    onPress={(e) => {
                      e.stopPropagation();
                      openSettings(group);
                    }}
                  >
                    <Settings size={14} color={isActive ? '#1F6E6C' : '#4D5A71'} strokeWidth={2} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: isActive ? '#1F6E6C' : '#4D5A71' }}>
                      Settings
                    </Text>
                  </Pressable>
                </View>

                <View className="mt-[8px] flex-row items-center gap-2">
                  <Text className="text-[14px] text-[#4D5A71]">Invite code: {group.invite_code}</Text>
                  <Pressable
                    className="rounded-md bg-[#ECEEF3] px-2 py-1"
                    onPress={async (e) => {
                      e.stopPropagation();
                      await Clipboard.setStringAsync(group.invite_code);
                      setCopiedGroupId(group.id);
                    }}
                  >
                    <Text className="text-[12px] font-bold text-[#273655]">Copy</Text>
                  </Pressable>
                  {copiedGroupId === group.id ? (
                    <Text className="text-[12px] font-bold text-[#177245]">Copied</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
