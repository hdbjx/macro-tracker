import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FoodRow } from '@/components/FoodRow';
import { CloseIcon, SearchIcon } from '@/components/icons';
import { colors, radius, space } from '@/components/theme';
import { ErrorText, Segmented, T, webNoOutline } from '@/components/ui';
import { addLog, getFood, myFoods, recentFoods, remoteSearch, searchFoods } from '@/lib/db';
import { MEAL_LABEL, mealForNow, toISODate } from '@/lib/format';
import { logName, portionOptions, scaleMacros } from '@/lib/portion';
import { MEALS, type Food, type Meal, type RecentFood } from '@/lib/types';

type Tab = 'recent' | 'mine';

export default function LogFood() {
  const params = useLocalSearchParams<{ meal?: string; day?: string }>();
  const day = params.day ?? toISODate();
  const [meal, setMeal] = useState<Meal>(
    MEALS.includes(params.meal as Meal) ? (params.meal as Meal) : mealForNow(),
  );
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('recent');
  const [results, setResults] = useState<Food[]>([]);
  const [recents, setRecents] = useState<RecentFood[]>([]);
  const [mine, setMine] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  useFocusEffect(
    useCallback(() => {
      recentFoods().then(setRecents).catch(() => {});
      myFoods().then(setMine).catch(() => {});
    }, []),
  );

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        // Instant: your foods + anything already cached. Then: USDA via the edge function.
        const local = await searchFoods(query);
        if (id !== reqId.current) return;
        setResults(local);
        let remote: Food[] = [];
        try {
          remote = await remoteSearch(query);
          setError(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : `Food search failed: ${String(e)}`);
        }
        if (id !== reqId.current) return;
        const seen = new Set<string>();
        const merged = [...local.filter((f) => f.owner_id), ...remote, ...local.filter((f) => !f.owner_id)].filter(
          (f) => !seen.has(f.id) && !!seen.add(f.id),
        );
        setResults(merged);
      } catch (e) {
        if (id === reqId.current) setError(e instanceof Error ? e.message : 'Search failed');
      } finally {
        if (id === reqId.current) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const openFood = (foodId: string, extra?: { qty?: number; servingId?: string | null }) =>
    router.push({
      pathname: '/food/[id]',
      params: {
        id: foodId,
        meal,
        day,
        ...(extra?.qty ? { qty: String(extra.qty) } : {}),
        ...(extra?.servingId ? { serving: extra.servingId } : {}),
      },
    });

  /** One-tap log of a recent food using the last portion. */
  async function quickLog(r: RecentFood) {
    try {
      setAdded((a) => ({ ...a, [r.food_id]: true }));
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const data = await getFood(r.food_id);
      if (!data) throw new Error('Food not found');
      const qty = Number(r.last_quantity) || 1;
      const opt = portionOptions(data.food, data.servings).find((o) => o.id === r.last_serving_id) ?? {
        id: null,
        factor: 1,
      };
      await addLog({
        food_id: data.food.id,
        serving_id: opt.id && opt.id !== 'g' ? opt.id : null,
        logged_on: day,
        meal,
        quantity: qty,
        name: logName(data.food),
        method: 'recent',
        ...scaleMacros(data.food, opt.factor, qty),
      });
    } catch (e) {
      setAdded((a) => ({ ...a, [r.food_id]: false }));
      setError(e instanceof Error ? e.message : 'Could not log');
    }
  }

  const showingSearch = q.trim().length >= 2;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <T v="h2">Add food</T>
          <Pressable hitSlop={12} onPress={() => router.back()} style={styles.close}>
            <CloseIcon color={colors.text} size={18} />
          </Pressable>
        </View>

        <View style={styles.meals}>
          {MEALS.map((m) => (
            <Pressable key={m} onPress={() => setMeal(m)} style={[styles.chip, meal === m && styles.chipOn]}>
              <T v="small" color={meal === m ? colors.accentInk : colors.muted} style={{ fontWeight: '700' }}>
                {MEAL_LABEL[m]}
              </T>
            </Pressable>
          ))}
        </View>

        <View style={styles.search}>
          <SearchIcon color={colors.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search foods"
            placeholderTextColor={colors.faint}
            style={styles.searchInput}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            selectionColor={colors.accent}
          />
          {searching ? <ActivityIndicator color={colors.muted} /> : null}
        </View>

        <View style={styles.actions}>
          <Action label="Scan" onPress={() => router.push({ pathname: '/scan', params: { meal, day } })} />
          <Action label="Quick add" onPress={() => router.push({ pathname: '/quick-add', params: { meal, day } })} />
          <Action label="Create food" onPress={() => router.push({ pathname: '/food/new', params: { meal, day, name: q } })} />
        </View>
        <ErrorText>{error}</ErrorText>
      </View>

      {showingSearch ? (
        <FlatList
          data={results}
          keyExtractor={(f) => f.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <FoodRow
              name={item.name}
              detail={[item.brand, item.serving_label].filter(Boolean).join(' · ')}
              calories={Number(item.calories)}
              verified={item.verified}
              onPress={() => openFood(item.id)}
            />
          )}
          ListEmptyComponent={
            searching ? undefined : (
              <Empty
                title={`No results for "${q.trim()}"`}
                sub="Try fewer words, or tap Create food — it'll stay in My foods after that."
              />
            )
          }
        />
      ) : (
        <>
          <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
            <Segmented
              options={[
                { value: 'recent', label: 'Recent' },
                { value: 'mine', label: 'My foods' },
              ]}
              value={tab}
              onChange={setTab}
            />
          </View>
          {tab === 'recent' ? (
            <FlatList
              data={recents}
              keyExtractor={(r) => r.food_id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <FoodRow
                  name={item.name}
                  detail={`${Number(item.last_quantity) !== 1 ? `${Number(item.last_quantity)} × ` : ''}${item.serving_label}`}
                  calories={Number(item.calories) * (Number(item.last_quantity) || 1)}
                  onPress={() => openFood(item.food_id, { qty: Number(item.last_quantity), servingId: item.last_serving_id })}
                  onQuickAdd={() => quickLog(item)}
                  added={added[item.food_id]}
                />
              )}
              ListEmptyComponent={<Empty title="No recent foods yet" sub="Foods you log show up here for one-tap adding." />}
            />
          ) : (
            <FlatList
              data={mine}
              keyExtractor={(f) => f.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <FoodRow
                  name={item.name}
                  detail={[item.brand, item.serving_label].filter(Boolean).join(' · ')}
                  calories={Number(item.calories)}
                  onPress={() => openFood(item.id)}
                />
              )}
              ListEmptyComponent={<Empty title="No custom foods" sub="Tap Create food to add your own." />}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}>
      <T v="small" style={{ fontWeight: '700' }}>{label}</T>
    </Pressable>
  );
}

function Empty({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={{ padding: space.xxl, alignItems: 'center' }}>
      <T style={{ fontWeight: '700', textAlign: 'center' }}>{title}</T>
      <T v="small" color={colors.muted} style={{ textAlign: 'center', marginTop: space.sm }}>{sub}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.md, gap: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meals: { flexDirection: 'row', gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
  },
  searchInput: { flex: 1, height: 50, color: colors.text, fontSize: 17, fontWeight: '600', ...webNoOutline },
  actions: { flexDirection: 'row', gap: space.sm },
  action: {
    flex: 1,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.cardHi,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
