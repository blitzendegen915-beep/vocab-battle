import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Pressable,
  Linking,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { Colors } from '../../src/constants/Colors';
import { TagBadge } from '../../src/components/TagBadge';
import { LoadingSpinner } from '../../src/components/LoadingSpinner';
import { Article } from '../../src/types';

export default function ArticleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('articles')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (!error) setArticle(data);
        setLoading(false);
      });
  }, [id]);

  const handleDelete = () => {
    Alert.alert('削除確認', 'この記事を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('articles')
            .delete()
            .eq('id', id);
          if (!error) router.back();
        },
      },
    ]);
  };

  if (loading) return <LoadingSpinner />;

  if (!article) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>記事が見つかりません</Text>
      </View>
    );
  }

  const summaryLines = (article.summary ?? '').split('\n').filter(Boolean);
  const date = new Date(article.created_at).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: colors.text }]}>
        {article.title || 'Untitled'}
      </Text>

      <Pressable onPress={() => Linking.openURL(article.url)}>
        <Text style={[styles.url, { color: colors.tint }]} numberOfLines={2}>
          {article.url}
        </Text>
      </Pressable>

      <Text style={[styles.date, { color: colors.textSecondary }]}>{date}</Text>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <Text style={[styles.sectionTitle, { color: colors.text }]}>要約</Text>
      {summaryLines.length > 0 ? (
        summaryLines.map((line, i) => (
          <View key={i} style={styles.summaryRow}>
            <Text style={[styles.bullet, { color: colors.tint }]}>•</Text>
            <Text style={[styles.summaryText, { color: colors.text }]}>{line}</Text>
          </View>
        ))
      ) : (
        <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
          要約がありません
        </Text>
      )}

      {article.tags.length > 0 && (
        <>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>タグ</Text>
          <View style={styles.tags}>
            {article.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </View>
        </>
      )}

      <Pressable
        style={[styles.deleteButton, { borderColor: colors.destructive }]}
        onPress={handleDelete}
      >
        <Ionicons name="trash-outline" size={16} color={colors.destructive} />
        <Text style={[styles.deleteText, { color: colors.destructive }]}>削除</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '700', lineHeight: 32 },
  url: { fontSize: 13, lineHeight: 18 },
  date: { fontSize: 12 },
  divider: { height: 1, marginVertical: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bullet: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  summaryText: { fontSize: 16, lineHeight: 26, flex: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  deleteText: { fontSize: 14, fontWeight: '600' },
});
