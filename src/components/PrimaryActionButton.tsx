import { useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';

type Props = {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  loading?: boolean;
};

export function PrimaryActionButton({ label, icon, onPress, color, disabled, loading }: Props) {
  const isDisabled = Boolean(disabled || loading);
  const [isPressed, setIsPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`h-[54px] w-full flex-row items-center justify-center rounded-xl ${
        isDisabled ? 'opacity-50' : isPressed ? 'opacity-80' : ''
      }`}
      style={{ backgroundColor: color ?? '#2E9A98' }}
      hitSlop={8}
      pressRetentionOffset={16}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
    >
      {loading === true ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <>
          {icon}
          <Text className="ml-2 text-[17px] font-bold text-white">{label}</Text>
        </>
      )}
    </Pressable>
  );
}

