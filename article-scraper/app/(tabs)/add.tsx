import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../src/constants/Colors';
import { supabase } from '../../src/lib/supabase';
import { scrapeArticle } from '../../src/lib/scraper';
import { summarizeArticle } from '../../src/lib/openai';

export default function AddScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const handleSave = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      Alert.alert('エラー', 'URLを入力してください');
      return;
    }

    const targetUrl =
      trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : `https://${trimmed}`;

    setLoading(true);
    try {
      setStatusMessage('記事を取得中...');
      const { title, content } = await scrapeArticle(targetUrl);

      setStatusMessage('AIで要約中...');
      const { summary, tags } = await summarizeArticle(title, content);

      const { error } = await supabase
        .from('articles')
        .insert({ url: targetUrl, title, summary, tags });

      if (error) throw error;

      setUrl('');
      Alert.alert('保存完了', '記事を保存しました', [
        { text: 'OK', onPress: () => router.replace('/') },
      ]);
    } catch (e) {
      Alert.alert(
        'エラー',
        e instanceof Error ? e.message : '記事の保存に失敗しました'
      );
    } finally {
      setLoading(false);
      setStatusMessage('');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.label, { color: colors.text }]}>記事URL</Text>

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          value={url}
          onChangeText={setUrl}
          placeholder="https://example.com/article"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={!loading}
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />

        {loading && (
          <View style={styles.status}>
            <ActivityIndicator size="small" color={colors.tint} />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              {statusMessage}
            </Text>
          </View>
        )}

        <Pressable
          style={[styles.button, { backgroundColor: colors.tint }, loading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? '処理中...' : '取得して保存'}
          </Text>
        </Pressable>

        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          URLを入力すると、記事のタイトル取得・AI要約・タグ生成を自動で行います。
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, gap: 16 },
  label: { fontSize: 14, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 52,
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusText: { fontSize: 14 },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 13, lineHeight: 20 },
});
