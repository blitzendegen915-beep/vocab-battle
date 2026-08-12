import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { Colors } from '../constants/Colors';
import { Article } from '../types';
import { TagBadge } from './TagBadge';

interface Props {
  article: Article;
  onPress: () => void;
}

export function ArticleCard({ article, onPress }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const date = new Date(article.created_at).toLocaleDateString('ja-JP');
  const firstSummaryLine = article.summary?.split('\n')[0] ?? '';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
        {article.title || 'Untitled'}
      </Text>

      {firstSummaryLine ? (
        <Text
          style={[styles.summary, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {firstSummaryLine}
        </Text>
      ) : null}

      {article.tags.length > 0 && (
        <View style={styles.tags}>
          {article.tags.slice(0, 3).map((tag) => (
            <TagBadge key={tag} tag={tag} small />
          ))}
        </View>
      )}

      <Text style={[styles.date, { color: colors.textSecondary }]}>{date}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  pressed: { opacity: 0.75 },
  title: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  summary: { fontSize: 14, lineHeight: 20 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  date: { fontSize: 11, marginTop: 2 },
});
