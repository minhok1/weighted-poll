import { Pressable, Text } from 'react-native';

type Props = {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
};

export function PrimaryActionButton({ label, icon, onPress, color, disabled }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`h-[54px] w-full flex-row items-center justify-center rounded-xl ${disabled ? 'opacity-50' : ''}`}
      style={{ backgroundColor: color ?? '#2E9A98' }}
      hitSlop={8}
      pressRetentionOffset={16}
    >
      {icon}
      <Text className="ml-2 text-[17px] font-bold text-white">{label}</Text>
    </Pressable>
  );
}

