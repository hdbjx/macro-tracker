import { Pressable, StyleSheet, View } from 'react-native';
import { CheckIcon, PlusIcon } from './icons';
import { colors, space } from './theme';
import { T } from './ui';
import { fmt } from '@/lib/format';

export function FoodRow({
  name,
  detail,
  calories,
  verified,
  onPress,
  onQuickAdd,
  added,
}: {
  name: string;
  detail: string;
  calories: number;
  verified?: boolean;
  onPress: () => void;
  onQuickAdd?: () => void;
  added?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.card }]}>
      <View style={{ flex: 1, paddingRight: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T numberOfLines={1} style={{ flexShrink: 1 }}>{name}</T>
          {verified ? <CheckIcon color={colors.accent} size={14} /> : null}
        </View>
        <T v="small" color={colors.muted} numberOfLines={1}>
          {detail} · {fmt(calories)} cal
        </T>
      </View>
      {onQuickAdd ? (
        <Pressable
          hitSlop={8}
          onPress={onQuickAdd}
          disabled={added}
          style={[styles.add, added && { backgroundColor: colors.accent }]}
        >
          {added ? <CheckIcon color={colors.accentInk} size={18} /> : <PlusIcon color={colors.text} size={18} />}
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  add: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
