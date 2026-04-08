import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

type Props = {
  userId: string | null;
  displayName: string;
  error: string | null;
  onSignUp: (email: string, password: string, displayName?: string) => Promise<boolean>;
  onSignIn: (email: string, password: string) => Promise<boolean>;
  onSignOut: () => Promise<boolean>;
  onUpdateDisplayName: (nextDisplayName: string) => Promise<boolean>;
  loading: boolean;
};

export function IdentityPage({
  userId,
  displayName,
  error,
  onSignUp,
  onSignIn,
  onSignOut,
  onUpdateDisplayName,
  loading,
}: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signUpDisplayName, setSignUpDisplayName] = useState('');
  const [draftDisplayName, setDraftDisplayName] = useState(displayName);
  const [signUpNotice, setSignUpNotice] = useState('');

  useEffect(() => {
    setDraftDisplayName(displayName);
  }, [displayName]);

  return (
    <View className="flex-1 w-full self-stretch bg-white">
      <View className="w-full bg-[#111D35] px-[18px] py-[14px]">
        <Text className="text-[20px] font-bold text-white">Account</Text>
        <Text className="mt-[6px] text-[15px] text-[#D6DEEA]">Sign-in identity and account context</Text>
      </View>

      <ScrollView className="flex-1 w-full" contentContainerClassName="w-full px-[14px] pb-[22px] pt-[14px]">
        {userId ? (
          <View className="mb-[14px] rounded-[14px] border border-[#E7ECF2] bg-white p-[14px]">
            <Text className="mb-[8px] text-[16px] font-bold text-[#111D35]">Display name</Text>
            <TextInput
              className="mb-[10px] h-12 rounded-xl border border-[#E7ECF2] px-[14px] text-[17px] text-[#111D35]"
              value={draftDisplayName}
              onChangeText={setDraftDisplayName}
              placeholder="Display name"
              placeholderTextColor="#A2AABC"
            />
            <Pressable
              className="h-11 items-center justify-center rounded-[10px] bg-[#2E9A98]"
              onPress={() => void onUpdateDisplayName(draftDisplayName)}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-[15px] font-bold text-white">Save display name</Text>
              )}
            </Pressable>
            <Pressable
              className="mt-2 h-11 items-center justify-center rounded-[10px] bg-[#273655]"
              onPress={() => void onSignOut()}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-[15px] font-bold text-white">Sign out</Text>
              )}
            </Pressable>
            {error ? <Text className="mt-[10px] text-[13px] text-[#9F1D1D]">{error}</Text> : null}
          </View>
        ) : (
          <View className="mb-[14px] rounded-[14px] border border-[#E7ECF2] bg-white p-[14px]">
            <View className="mb-[10px] flex-row rounded-[10px] bg-[#EEF1F5] p-[4px]">
              <Pressable
                className={`flex-1 items-center rounded-[8px] py-[8px] ${mode === 'signin' ? 'bg-white' : ''}`}
                onPress={() => {
                  setMode('signin');
                  setSignUpNotice('');
                }}
              >
                <Text className={`font-bold ${mode === 'signin' ? 'text-[#111D35]' : 'text-[#66728A]'}`}>Log in</Text>
              </Pressable>
              <Pressable
                className={`flex-1 items-center rounded-[8px] py-[8px] ${mode === 'signup' ? 'bg-white' : ''}`}
                onPress={() => {
                  setMode('signup');
                  setSignUpNotice('');
                }}
              >
                <Text className={`font-bold ${mode === 'signup' ? 'text-[#111D35]' : 'text-[#66728A]'}`}>Sign up</Text>
              </Pressable>
            </View>

            <TextInput
              className="mb-[10px] h-12 rounded-xl border border-[#E7ECF2] px-[14px] text-[17px] text-[#111D35]"
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="#A2AABC"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {mode === 'signup' ? (
              <TextInput
                className="mb-[10px] h-12 rounded-xl border border-[#E7ECF2] px-[14px] text-[17px] text-[#111D35]"
                value={signUpDisplayName}
                onChangeText={setSignUpDisplayName}
                placeholder="Display name"
                placeholderTextColor="#A2AABC"
              />
            ) : null}
            <TextInput
              className="mb-[10px] h-12 rounded-xl border border-[#E7ECF2] px-[14px] text-[17px] text-[#111D35]"
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#A2AABC"
              secureTextEntry
            />

            <Pressable
              className="h-11 items-center justify-center rounded-[10px] bg-[#2E9A98]"
              onPress={async () => {
                const ok =
                  mode === 'signin'
                    ? await onSignIn(email, password)
                    : await onSignUp(email, password, signUpDisplayName);
                if (ok) {
                  setPassword('');
                  if (mode === 'signup') {
                    setSignUpNotice('Email sent! Please verify your email address.');
                  } else {
                    setSignUpNotice('');
                  }
                }
              }}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-[15px] font-bold text-white">
                  {mode === 'signin' ? 'Log in with email' : 'Sign up with email'}
                </Text>
              )}
            </Pressable>

            {mode === 'signup' && signUpNotice ? (
              <Text className="mt-[10px] text-[13px] text-[#177245]">{signUpNotice}</Text>
            ) : null}
            {error ? <Text className="mt-[10px] text-[13px] text-[#9F1D1D]">{error}</Text> : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

