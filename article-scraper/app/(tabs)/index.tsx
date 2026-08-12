import { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useArticles } from '../../src/hooks/useArticles';
import { ArticleCard } from '../../src/components/ArticleCard';
import { LoadingSpinner } from '../../src/components/LoadingSpinner';
import { Colors } from '../../src/constants/Colors';
import { Article } from '../../src/types';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { articles, loading, error, fetchArticles } = useArticles();

  // Refresh list when tab comes into focus (e.g. after adding an article)
  useFocusEffect(
    useCallback(() => {
      fetchArticles();
    }, [fetchArticles])
  );

  const handleArticlePress = (article: Article) => {
    router.push(`/article/${article.id}`);
  };

  if (loading && articles.length === 0) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          {error}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {articles.length === 0 ? (
        <View style={styles.centered}>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {'記事がありません\nAdd タブからURLを追加してください'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={articles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ArticleCard
              article={item}
              onPress={() => handleArticlePress(item)}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchArticles}
              tintColor={colors.tint}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  list: { padding: 16, gap: 12 },
  message: { fontSize: 16, textAlign: 'center', lineHeight: 26 },
});
