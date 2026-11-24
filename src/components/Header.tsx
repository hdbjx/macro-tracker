import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { ChevronIcon } from './icons';
import { colors, space } from './theme';
import { T } from './ui';

export function Header({ title }: { title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xl }}>
      <Pressable
        hitSlop={12}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.card,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ChevronIcon dir="left" color={colors.text} />
      </Pressable>
      <T v="h2" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </T>
    </View>
  );
}

/** After logging: pop back to Today (closing the add-food modal too). */
export function backToToday() {
  if (router.canDismiss()) router.dismissAll();
  else router.replace('/');
}
